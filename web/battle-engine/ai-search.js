"use strict";

// Actions are still resolved as one simultaneous turn. The tree conservatively
// models each round as our choice followed by the opponent's worst response so
// PVS/alpha-beta can establish bounds without changing combat resolution order.

const SEARCH_TIMEOUT = Object.freeze({ name: "AI_SEARCH_TIMEOUT" });
const SCORE_INF = Number.POSITIVE_INFINITY;
const PVS_EPSILON = 0.01;
const ROOT_POLICY_WEIGHT = 0.04;
const DEFAULT_ROOT_CHANCE_SAMPLES = 3;
const FIGHTER_STATE_KEYS_BEFORE_DREAM = Object.freeze([
  "adventureAllSkillCostMultiplier", "adventureBattleRhythm", "adventureCommonAttackPowerBonus",
  "adventureCommonDefenseReductionBonus", "adventureDamageMultiplier", "adventureMeditationRecoveryBonus",
  "adventureMpRecoveryBonus", "adventureRelic", "adventureSkillAccuracyModifiers",
  "adventureSkillCostMultipliers", "adventureSkillPowerMultipliers", "adventureSkillPriorityModifiers",
  "adventureSkipNextAction", "adventureSkipNextActionLabel", "adventureSurviveDefeatCount",
  "adventureTurnEndFixedDamage", "adventureTurnEndHpRecovery", "attackSelectionCount1To5",
  "baseAtk", "baseDef", "baseSpd", "costEffects", "counters", "defenseMult", "defenseName",
  "defenseStreak",
]);
const FIGHTER_STATE_KEYS_BETWEEN_OPTIONALS = Object.freeze([
  "ementoForecastActionKey", "ementoForgottenActionKey",
]);
const FIGHTER_STATE_KEYS_AFTER_PROPHECY = Object.freeze([
  "evasionChance", "forbiddenActionKey", "forbiddenActionKeys", "forbiddenRemaining",
  "guaranteedEvasion", "hitRecords", "hp", "inscriptionId", "lastMeditationSuccessTurn",
  "lastSuccessfulActionKey", "maxHp", "maxMp", "mp", "selectedAttackActiveHistory",
  "selectedHistory", "side", "statEffects", "statuses",
]);

function nowMs() {
  return globalThis.performance && typeof globalThis.performance.now === "function"
    ? globalThis.performance.now()
    : Date.now();
}

function selectSearchAction({ battle, actor, target, personalityId, tuning, legal, rootScoreGap = 0 }) {
  const startedAt = nowMs();
  const context = {
    rootSide: actor.side,
    personalityId,
    deadline: startedAt + Math.max(1, Number(tuning.timeLimitMs || 100)),
    maxNodes: Math.max(100, Number(tuning.maxNodes || 20000)),
    nodes: 0,
    pairSimulations: 0,
    multiSampleTransitions: 0,
    extraChanceSimulations: 0,
    cutoffs: 0,
    researches: 0,
    rootExactResearches: 0,
    rootGapRejected: 0,
    ttHits: 0,
    ttStores: 0,
    timedOut: false,
    tt: new Map(),
    stateInfo: new WeakMap(),
    actionHashes: new WeakMap(),
    legalActions: new WeakMap(),
    orderScores: new WeakMap(),
    evaluations: new WeakMap(),
    rootChanceTransitions: new WeakMap(),
    choiceMetrics: new WeakMap(),
    history: new WeakMap(),
    killers: new Map(),
    turnStartState: reusableTurnStartState(battle),
    seedSalt: hashText(`VERSUS-AI|${personalityId}`),
    activeRootDepth: 0,
    rootChanceSamples: Math.max(1, Math.trunc(Number(
      tuning.rootChanceSamples || DEFAULT_ROOT_CHANCE_SAMPLES,
    ))),
    rootScoreGap: Math.max(0, Number(rootScoreGap) || 0),
    fullOrderMinDepth: Math.max(1, Number(tuning.fullOrderMinDepth) || 3),
  };

  const fallbackScores = orderScoreMap(battle, actor, personalityId, context, "full");
  const fallback = orderActions(battle, actor, target, legal, personalityId, null, context, "full", 0)
    .map((action) => ({
      action,
      score: cachedActionScore(
        battle,
        actor,
        target,
        action,
        personalityId,
        fallbackScores,
        "full",
        context,
      ),
    }));
  let completed = fallback;
  let completedDepth = 0;
  let principalActionKey = fallback[0]?.action.key || null;
  const requestedDepth = normalizeEvenDepth(tuning.depth || 4);

  const iterationDepths = Array.isArray(tuning.iterationDepths)
    ? tuning.iterationDepths.filter((depth) => depth >= 2 && depth <= requestedDepth && depth % 2 === 0)
    : Array.from({ length: requestedDepth / 2 }, (_, index) => (index + 1) * 2);
  for (const depth of iterationDepths) {
    try {
      context.activeRootDepth = depth;
      const iteration = searchRoot(battle, actor, target, legal, depth, principalActionKey, context);
      completed = iteration.scored;
      principalActionKey = iteration.bestActionKey;
      completedDepth = depth;
    } catch (error) {
      if (error !== SEARCH_TIMEOUT) throw error;
      context.timedOut = true;
      break;
    }
  }

  if (completedDepth > 0) {
    try {
      context.activeRootDepth = completedDepth;
      const exactified = exactifyNearBestRootScores(
        battle,
        completed,
        completedDepth,
        principalActionKey,
        context,
      );
      completed = exactified.scored;
      principalActionKey = exactified.bestActionKey;
    } catch (error) {
      if (error !== SEARCH_TIMEOUT) throw error;
      context.timedOut = true;
      // The principal move is exact. If optional variation scoring cannot
      // finish in budget, discard unproven bounds and keep exact moves only.
      completed = completed.filter((item) => item.exact);
    }

    completed = completed.map((item) => ({
      ...item,
      score: item.score + rootPolicyBonus(item, fallbackScores),
    }));
    principalActionKey = completed.reduce(
      (best, item) => (!best || item.score > best.score ? item : best),
      null,
    )?.action.key || principalActionKey;
  }

  return {
    scored: completed,
    diagnostics: {
      algorithm: "iterative-pvs-alpha-beta",
      requestedDepth,
      completedDepth,
      elapsedMs: round2(nowMs() - startedAt),
      nodes: context.nodes,
      pairSimulations: context.pairSimulations,
      rootChanceSamples: context.rootChanceSamples,
      multiSampleTransitions: context.multiSampleTransitions,
      extraChanceSimulations: context.extraChanceSimulations,
      cutoffs: context.cutoffs,
      researches: context.researches,
      rootExactResearches: context.rootExactResearches,
      rootGapRejected: context.rootGapRejected,
      ttHits: context.ttHits,
      ttStores: context.ttStores,
      timedOut: context.timedOut,
      rootPolicyWeight: ROOT_POLICY_WEIGHT,
      bestActionKey: principalActionKey,
      rootScores: completed.map(({ action, score }) => ({ key: action.key, name: action.name, score: round2(score) })),
    },
  };
}

function searchRoot(battle, actor, target, legal, depth, preferredKey, context) {
  const actions = orderActions(battle, actor, target, legal, context.personalityId, preferredKey, context, "full", depth);
  const scored = [];
  let alpha = -SCORE_INF;
  const beta = SCORE_INF;
  let scoutBeta = beta;
  let bestActionKey = actions[0]?.key || null;

  for (let index = 0; index < actions.length; index += 1) {
    checkBudget(context, true);
    const action = actions[index];
    let score = -negaScout(
      battle,
      depth - 1,
      -scoutBeta,
      -alpha,
      -1,
      action,
      context,
    );
    if (index > 0 && score > alpha && score < beta) {
      context.researches += 1;
      score = -negaScout(battle, depth - 1, -beta, -score, -1, action, context);
    }
    scored.push({ action, score, exact: index === 0 || score > alpha });
    if (score > alpha) {
      alpha = score;
      bestActionKey = action.key;
    }
    scoutBeta = Math.min(beta, alpha + PVS_EPSILON);
  }

  return { scored, bestActionKey };
}

function exactifyNearBestRootScores(battle, scored, depth, bestActionKey, context) {
  let best = Math.max(...scored.map((item) => item.score));
  const nearBestThreshold = best - context.rootScoreGap;
  for (const item of scored) {
    if (item.exact || item.score < nearBestThreshold) continue;
    checkBudget(context, true);
    const lowerWindow = nearBestThreshold - PVS_EPSILON;
    const upperWindow = best + PVS_EPSILON;
    item.score = -negaScout(
      battle,
      depth - 1,
      -upperWindow,
      -lowerWindow,
      -1,
      item.action,
      context,
    );
    context.rootExactResearches += 1;
    if (item.score < nearBestThreshold) {
      context.rootGapRejected += 1;
      continue;
    }
    item.exact = true;
    if (item.score > best) {
      best = item.score;
      bestActionKey = item.action.key;
    }
  }
  return { scored, bestActionKey };
}

function rootPolicyBonus(item, rootPolicyScores) {
  return Number(rootPolicyScores.get(item.action.key) || 0) * ROOT_POLICY_WEIGHT;
}

function negaScout(battle, depth, alpha, beta, color, pendingAction, context) {
  visitNode(context);
  if (battle.gameOver || depth <= 0) {
    return color * evaluateLeaf(battle, context);
  }

  const originalAlpha = alpha;
  const originalBeta = beta;
  const phase = pendingAction ? `response:${pendingAction.key}` : "action";
  const info = stateInfo(battle, context);
  const tableKey = `${color}|${phase}|${info.hash}`;
  const tableEntry = context.tt.get(tableKey);
  const cached = tableEntry?.stateKey === info.key ? tableEntry : null;
  let preferredKey = cached?.bestMoveKey || null;
  if (cached && cached.depth >= depth) {
    context.ttHits += 1;
    if (cached.flag === "EXACT") return cached.value;
    if (cached.flag === "LOWER") alpha = Math.max(alpha, cached.value);
    else if (cached.flag === "UPPER") beta = Math.min(beta, cached.value);
    if (alpha >= beta) return cached.value;
  }

  const rootActor = battle.fighterBySide(context.rootSide);
  const opponent = battle.opponent(rootActor);
  const movingActor = pendingAction ? opponent : rootActor;
  const movingTarget = pendingAction ? rootActor : opponent;
  const movingPersonality = pendingAction ? "R" : context.personalityId;
  let actions = legalActions(battle, movingActor, movingTarget, context);
  if (!actions.length) actions = battle.availableActions(movingActor).slice(0, 1);
  actions = orderActions(
    battle,
    movingActor,
    movingTarget,
    actions,
    movingPersonality,
    preferredKey,
    context,
    depth >= context.fullOrderMinDepth ? "full" : "quick",
    depth,
  );

  let best = -SCORE_INF;
  let bestMoveKey = actions[0]?.key || null;
  let scoutBeta = beta;
  for (let index = 0; index < actions.length; index += 1) {
    checkBudget(context, false);
    const action = actions[index];
    let score;
    if (pendingAction) {
      const sampleCount = rootTransitionSampleCount(depth, context);
      const transition = chanceCorrectedTransition(
        battle,
        rootActor,
        opponent,
        pendingAction,
        action,
        info.hash,
        sampleCount,
        context,
      );
      score = -negaScout(
        transition.childBattle,
        depth - 1,
        -(scoutBeta + transition.correction),
        -(alpha + transition.correction),
        -color,
        null,
        context,
      ) - transition.correction;
    } else {
      score = -negaScout(
        battle,
        depth - 1,
        -scoutBeta,
        -alpha,
        -color,
        action,
        context,
      );
    }

    if (index > 0 && score > alpha && score < beta) {
      context.researches += 1;
      if (pendingAction) {
        const transition = chanceCorrectedTransition(
          battle,
          rootActor,
          opponent,
          pendingAction,
          action,
          info.hash,
          rootTransitionSampleCount(depth, context),
          context,
        );
        score = -negaScout(
          transition.childBattle,
          depth - 1,
          -(beta + transition.correction),
          -(score + transition.correction),
          -color,
          null,
          context,
        ) - transition.correction;
      } else {
        score = -negaScout(battle, depth - 1, -beta, -score, -color, action, context);
      }
    }
    if (score > best) {
      best = score;
      bestMoveKey = action.key;
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) {
      context.cutoffs += 1;
      recordCutoff(context, movingActor.side, action, depth);
      break;
    }
    scoutBeta = Math.min(beta, alpha + PVS_EPSILON);
  }

  const flag = best <= originalAlpha ? "UPPER" : best >= originalBeta ? "LOWER" : "EXACT";
  context.tt.set(tableKey, { stateKey: info.key, depth, value: best, flag, bestMoveKey });
  context.ttStores += 1;
  return best;
}

function rootTransitionSampleCount(depth, context) {
  return depth === context.activeRootDepth - 1 ? context.rootChanceSamples : 1;
}

function chanceCorrectedTransition(
  battle,
  rootActor,
  opponent,
  actorAction,
  responseAction,
  stateHash,
  sampleCount,
  context,
) {
  if (sampleCount <= 1) {
    return {
      childBattle: simulatePairSample(
        battle,
        rootActor,
        opponent,
        actorAction,
        responseAction,
        stateHash,
        0,
        context,
      ),
      correction: 0,
    };
  }

  let battleTransitions = context.rootChanceTransitions.get(battle);
  if (!battleTransitions) {
    battleTransitions = new Map();
    context.rootChanceTransitions.set(battle, battleTransitions);
  }
  const cacheKey = `${actorAction.key}|${responseAction.key}|${sampleCount}`;
  const cached = battleTransitions.get(cacheKey);
  if (cached) return cached;

  checkBudget(context, true);
  const childBattle = simulatePairSample(
    battle,
    rootActor,
    opponent,
    actorAction,
    responseAction,
    stateHash,
    0,
    context,
  );
  const primaryValue = evaluateLeaf(childBattle, context);
  let total = primaryValue;
  for (let sampleIndex = 1; sampleIndex < sampleCount; sampleIndex += 1) {
    checkBudget(context, true);
    const sampleBattle = simulatePairSample(
      battle,
      rootActor,
      opponent,
      actorAction,
      responseAction,
      stateHash,
      sampleIndex,
      context,
    );
    total += evaluateLeaf(sampleBattle, context);
  }
  const transition = {
    childBattle,
    correction: total / sampleCount - primaryValue,
  };
  context.multiSampleTransitions += 1;
  battleTransitions.set(cacheKey, transition);
  return transition;
}

function simulatePairSample(
  battle,
  rootActor,
  opponent,
  actorAction,
  responseAction,
  stateHash,
  sampleIndex,
  context,
) {
  const pairSeed = pairSearchSeed(stateHash, actorAction, responseAction, context, sampleIndex);
  const childBattle = battle.simulateActionPair(
    context.rootSide,
    actorAction,
    responseAction,
    {
      rngState: pairSeed,
      silent: true,
      canonicalActions: true,
      actorChoiceMetrics: completeChoiceMetrics(battle, rootActor, actorAction, context),
      targetChoiceMetrics: completeChoiceMetrics(battle, opponent, responseAction, context),
    },
  );
  context.pairSimulations += 1;
  if (sampleIndex > 0) context.extraChanceSimulations += 1;
  if (!childBattle.gameOver) {
    childBattle.turn += 1;
    childBattle.startTurn();
  }
  return childBattle;
}

function orderActions(battle, actor, target, actions, personalityId, preferredKey, context, mode, depth) {
  const scores = orderScoreMap(battle, actor, personalityId, context, mode);
  return actions
    .map((action) => ({
      action,
      preferred: action.key === preferredKey ? 1 : 0,
      killer: killerRank(context, actor.side, action, depth),
      history: Number(context.history.get(action) || 0),
      score: cachedActionScore(battle, actor, target, action, personalityId, scores, mode, context),
    }))
    .sort((left, right) => (
      right.preferred - left.preferred
      || right.killer - left.killer
      || right.history - left.history
      || right.score - left.score
      || String(left.action.key).localeCompare(String(right.action.key))
    ))
    .map((item) => item.action);
}

function orderScoreMap(battle, actor, personalityId, context, mode) {
  let battleScores = context.orderScores.get(battle);
  if (!battleScores) {
    battleScores = new Map();
    context.orderScores.set(battle, battleScores);
  }
  const cacheKey = `${actor.side}|${personalityId}|${mode}`;
  let scores = battleScores.get(cacheKey);
  if (!scores) {
    scores = new Map();
    battleScores.set(cacheKey, scores);
  }
  return scores;
}

function recordCutoff(context, side, action, depth) {
  context.history.set(action, Number(context.history.get(action) || 0) + depth * depth);
  const killerKey = `${side}|${depth}`;
  const killers = context.killers.get(killerKey) || [];
  if (killers[0] !== action) context.killers.set(killerKey, [action, killers[0]].filter(Boolean));
}

function killerRank(context, side, action, depth) {
  const killers = context.killers.get(`${side}|${depth}`) || [];
  if (killers[0] === action) return 2;
  if (killers[1] === action) return 1;
  return 0;
}

function cachedActionScore(battle, actor, target, action, personalityId, scores, mode, context) {
  if (scores.has(action.key)) return scores.get(action.key);
  const score = mode === "full"
    ? battle.scoreAction(actor, target, action, personalityId, choiceCost(battle, actor, action, context))
    : quickActionScore(actor, target, action);
  scores.set(action.key, score);
  return score;
}

function quickActionScore(actor, target, action) {
  let score = Number(action.priority || 0) * 12 - Number(action.mp || 0) * 0.8;
  if (action.isAttack) {
    const accuracy = action.accuracy == null ? 100 : Number(action.accuracy);
    score += Number(action.power || 0) * Math.max(0, accuracy) * 0.04;
    if (Number(action.power || 0) >= target.hp) score += 500;
  } else if (action.isDefense) {
    score += actor.hp < actor.maxHp * 0.45 ? 160 : 70;
  } else if (action.isCommonAction("meditation")) {
    score += Math.max(0, actor.maxMp - actor.mp) * 1.5;
  } else if (action.isActive) {
    score += 55;
  }
  return score;
}

function legalActions(battle, actor, target, context) {
  let battleActions = context.legalActions.get(battle);
  if (!battleActions) {
    battleActions = new Map();
    context.legalActions.set(battle, battleActions);
  }
  if (!battleActions.has(actor.side)) {
    battleActions.set(actor.side, battle.searchLegalActions(
      actor,
      target,
      (action) => choiceCost(battle, actor, action, context),
    ));
  }
  return battleActions.get(actor.side);
}

function choiceMetricsFor(battle, actor, action, context) {
  let battleMetrics = context.choiceMetrics.get(battle);
  if (!battleMetrics) {
    battleMetrics = new Map();
    context.choiceMetrics.set(battle, battleMetrics);
  }
  let actorMetrics = battleMetrics.get(actor.side);
  if (!actorMetrics) {
    actorMetrics = new WeakMap();
    battleMetrics.set(actor.side, actorMetrics);
  }
  let metrics = actorMetrics.get(action);
  if (!metrics) {
    metrics = { cost: battle.effectiveCost(actor, action), priority: undefined };
    actorMetrics.set(action, metrics);
  }
  return metrics;
}

function choiceCost(battle, actor, action, context) {
  return choiceMetricsFor(battle, actor, action, context).cost;
}

function completeChoiceMetrics(battle, actor, action, context) {
  const metrics = choiceMetricsFor(battle, actor, action, context);
  if (metrics.priority === undefined) metrics.priority = battle.effectivePriority(actor, action);
  return metrics;
}

function evaluateLeaf(battle, context) {
  if (!context.evaluations.has(battle)) {
    context.evaluations.set(
      battle,
      battle.evaluatePosition(context.rootSide, context.personalityId, true),
    );
  }
  return context.evaluations.get(battle);
}

function visitNode(context) {
  context.nodes += 1;
  checkBudget(context, (context.nodes & 7) === 0);
}

function checkBudget(context, checkClock) {
  if (context.nodes >= context.maxNodes || (checkClock && nowMs() >= context.deadline)) {
    throw SEARCH_TIMEOUT;
  }
}

function stateInfo(battle, context) {
  const cached = context.stateInfo.get(battle);
  if (cached) return cached;
  const parts = ["B"];
  appendStable(parts, battle.turn);
  parts.push(",");
  appendStable(parts, battle.maxTurns);
  parts.push(",", battle.gameOver ? "1" : "0", ",");
  appendStable(parts, battle.winner?.side || null);
  parts.push(",");
  appendStable(parts, battle.loser?.side || null);
  parts.push("|P");
  appendFighter(parts, battle.player);
  parts.push("|A");
  appendFighter(parts, battle.ai);
  parts.push("|R");
  if (context.turnStartState) parts.push(context.turnStartState.recordKey);
  else appendStable(parts, battle.record);
  parts.push("|O");
  if (context.turnStartState) parts.push(context.turnStartState.orderKey);
  else appendStable(parts, battle.turnOrder);
  const key = parts.join("");
  const info = { key, hash: hashText(key) };
  context.stateInfo.set(battle, info);
  return info;
}

function reusableTurnStartState(battle) {
  if (Object.keys(battle.record?.selected || {}).length > 0) return null;
  if (Object.keys(battle.turnOrder || {}).length > 0) return null;
  const recordParts = [];
  const orderParts = [];
  appendStable(recordParts, battle.record);
  appendStable(orderParts, battle.turnOrder);
  return { recordKey: recordParts.join(""), orderKey: orderParts.join("") };
}

function appendFighter(parts, fighter) {
  appendStable(parts, fighter.characterId);
  parts.push(",");
  for (const key of FIGHTER_STATE_KEYS_BEFORE_DREAM) {
    appendStable(parts, fighter[key]);
    parts.push(",");
  }
  if (Object.hasOwn(fighter, "ementoDreamFailurePending")) {
    parts.push("1:");
    appendStable(parts, fighter.ementoDreamFailurePending);
    parts.push(",");
  } else {
    parts.push("0,");
  }
  for (const key of FIGHTER_STATE_KEYS_BETWEEN_OPTIONALS) {
    appendStable(parts, fighter[key]);
    parts.push(",");
  }
  if (Object.hasOwn(fighter, "ementoProphecyRemaining")) {
    parts.push("1:");
    appendStable(parts, fighter.ementoProphecyRemaining);
    parts.push(",");
  } else {
    parts.push("0,");
  }
  for (const key of FIGHTER_STATE_KEYS_AFTER_PROPHECY) {
    appendStable(parts, fighter[key]);
    parts.push(",");
  }
}

function appendStable(parts, value) {
  if (value === null) {
    parts.push("null");
  } else if (value === undefined) {
    parts.push("undefined");
  } else if (typeof value === "number" || typeof value === "boolean") {
    parts.push(String(value));
  } else if (typeof value === "string") {
    parts.push(JSON.stringify(value));
  } else if (value instanceof Set) {
    parts.push("set[");
    const entries = [...value].map((item) => String(item)).sort();
    for (const entry of entries) parts.push(JSON.stringify(entry), ",");
    parts.push("]");
  } else if (Array.isArray(value)) {
    parts.push("[");
    for (const item of value) {
      appendStable(parts, item);
      parts.push(",");
    }
    parts.push("]");
  } else if (typeof value === "object") {
    parts.push("{");
    for (const key of Object.keys(value).sort()) {
      parts.push(JSON.stringify(key), ":");
      appendStable(parts, value[key]);
      parts.push(",");
    }
    parts.push("}");
  }
}

function pairSearchSeed(stateHash, actorAction, responseAction, context, sampleIndex = 0) {
  let value = mix32(stateHash ^ context.seedSalt, actionHash(actorAction, context));
  value = mix32(value, actionHash(responseAction, context));
  if (sampleIndex > 0) value = mix32(value, sampleIndex ^ 0xa511e9b3);
  return value || 0x6d2b79f5;
}

function actionHash(action, context) {
  const cached = context.actionHashes.get(action);
  if (cached !== undefined) return cached;
  const value = hashText(`${action.key}|${action.name}|${action.number}`);
  context.actionHashes.set(action, value);
  return value;
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mix32(left, right) {
  let value = (left ^ right ^ 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
}

function normalizeEvenDepth(value) {
  const depth = Math.max(2, Math.floor(Number(value) || 2));
  return depth % 2 === 0 ? depth : depth - 1;
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function searchStateFingerprint(battle) {
  return stateInfo(battle, { stateInfo: new WeakMap() });
}

module.exports = { searchStateFingerprint, selectSearchAction };
