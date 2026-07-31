"use strict";

const characterLogic = require("./character-logic");
const {
  DEFAULT_INSCRIPTION_ID,
  RANDOM_INSCRIPTION_ID,
  normalizeInscriptions,
  inscriptionById,
  hasInscription,
  resolveInscriptionId,
  randomInscriptionId,
  whitePowerPenalty,
  redPowerBonus,
} = require("./inscriptions");
const { Mulberry32 } = require("./rng");

const MAX_MP = 100;
const START_MP = 30;
const DEFENSE_MULTIPLIERS = [0.5, 0.6, 0.7, 0.8, 0.9];
const AI_PERSONALITY_TUNING = {
  R: { temperature: 35, topGap: 120, exploration: 0.02, repeatPenalty: 45 },
  C: { temperature: 60, topGap: 220, exploration: 0.05, repeatPenalty: 30 },
  D: { temperature: 30, topGap: 100, exploration: 0.015, repeatPenalty: 25 },
  G: { temperature: 110, topGap: 420, exploration: 0.12, repeatPenalty: 20 },
  E: { temperature: 55, topGap: 180, exploration: 0.04, repeatPenalty: 35 },
  J: { temperature: 85, topGap: 280, exploration: 0.08, repeatPenalty: 80 },
  A: { temperature: 65, topGap: 220, exploration: 0.05, repeatPenalty: 55 },
};
const AI_SEARCH_TUNING = {
  R: { depth: 2, beam: 4, responses: 5, timeLimitMs: 1250, discount: 0.68 },
  C: { depth: 2, beam: 5, responses: 4, timeLimitMs: 1150, discount: 0.62 },
  D: { depth: 2, beam: 4, responses: 6, timeLimitMs: 1350, discount: 0.70 },
  G: { depth: 2, beam: 5, responses: 4, timeLimitMs: 1200, discount: 0.64 },
  E: { depth: 3, beam: 4, responses: 5, timeLimitMs: 2600, discount: 0.78 },
  J: { depth: 2, beam: 4, responses: 5, timeLimitMs: 1350, discount: 0.70 },
  A: { depth: 2, beam: 4, responses: 6, timeLimitMs: 1450, discount: 0.70 },
};

const AI_PERSONALITIES = [
  { id: "R", name: "합리" },
  { id: "C", name: "돌격" },
  { id: "D", name: "방어" },
  { id: "M", name: "광기" },
  { id: "G", name: "도박" },
  { id: "E", name: "인내" },
  { id: "J", name: "교란" },
  { id: "A", name: "적응" },
];

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function floorInt(value) {
  return Math.floor(value);
}

function roundStat(value) {
  if (typeof value !== "number") return value;
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? Math.trunc(rounded) : rounded;
}

function pct(value) {
  return `${Number(value).toFixed(1)}%`;
}

function defenseMultiplierForStreak(streak, bonusReduction = 0) {
  const base = streak >= 1 && streak <= DEFENSE_MULTIPLIERS.length ? DEFENSE_MULTIPLIERS[streak - 1] : 1;
  const reduction = clamp(1 - base + bonusReduction, 0, 1);
  return 1 - reduction;
}

function defenseReductionPercentForStreak(streak, bonusReduction = 0) {
  return Math.round((1 - defenseMultiplierForStreak(streak, bonusReduction)) * 100);
}

function skillKey(characterId, slot) {
  return `${characterId}:${slot}`;
}

function commonActionKey(kind) {
  return `common:${kind}`;
}

class Action {
  constructor({
    number,
    name,
    target,
    mp,
    power = null,
    accuracy = null,
    priority,
    description,
    common = false,
    kind = "skill",
    characterId = null,
    slot = null,
  }) {
    this.number = Number(number);
    this.name = String(name);
    this.target = String(target);
    this.mp = Number(mp || 0);
    this.power = power == null ? null : Number(power);
    this.accuracy = accuracy == null ? null : Number(accuracy);
    this.priority = Number(priority || 0);
    this.description = String(description || "");
    this.common = Boolean(common);
    this.kind = kind;
    this.characterId = characterId;
    this.slot = slot;
  }

  get isAttack() {
    return this.power !== null;
  }

  get isActive() {
    return !this.common;
  }

  get isDefense() {
    return this.kind === "defense" || this.name === "일반 방어" || this.description.includes("자신이 이 턴에 입는 공격 피해를 경감");
  }

  get key() {
    if (this.common) return commonActionKey(this.kind);
    if (this.characterId != null && this.slot != null) return skillKey(this.characterId, this.slot);
    return this.name;
  }

  isCommonAction(kind) {
    return this.common && this.kind === kind;
  }

  isSkill(characterId, slot) {
    return this.characterId === characterId && this.slot === slot;
  }
}

class Choice {
  constructor(actor, action, cost, priority) {
    this.actor = actor;
    this.action = action;
    this.cost = Number(cost || 0);
    this.priority = Number(priority || 0);
    this.power = action.power;
    this.accuracy = action.accuracy;
    this.hitCount = 1;
    this.selectedBullets = null;
    this.prevAttackActive = null;
    this.copiedFrom = null;
    this.consumedMpExtra = 0;
    this.selectedActionKey = action.key;
    this.madnessReplaced = false;
    this.madnessOriginalActionKey = null;
    this.guaranteedHit = false;
    this.defenseBonusReduction = 0;
  }

  get totalCost() {
    return this.cost + this.consumedMpExtra;
  }
}

class TurnRecord {
  constructor() {
    this.selected = {};
    this.selectedKey = {};
    this.selectedKind = {};
    this.actionSuccess = {};
    this.attackHit = {};
    this.attackDamageTaken = {};
    this.activeAttackMpSpent = {};
    this.freezeRemoved = {};
    this.defenseReduced = {};
    this.gainedInsight = {};
    this.madnessDecided = {};
  }
}

class Fighter {
  constructor(side, data, inscription, inscriptions) {
    this.side = side;
    this.data = structuredCloneCompat(data);
    this.inscription = inscriptionById(normalizeInscriptions([inscription]), inscription?.id);
    this.inscriptionId = this.inscription.id;
    this.maxHp = Number(this.data.stats.hp);
    this.hp = this.maxHp;
    this.maxMp = MAX_MP;
    this.mp = START_MP;
    if (hasInscription(this, "blue")) this.mp += 10;
    this.mp = Math.min(this.maxMp, this.mp);
    this.baseAtk = Number(this.data.stats.atk);
    this.baseDef = Number(this.data.stats.def);
    this.baseSpd = Number(this.data.stats.spd);
    this.statuses = {};
    this.statEffects = [];
    this.costEffects = [];
    this.counters = {};
    this.defenseStreak = 0;
    this.defenseMult = null;
    this.defenseName = null;
    this.evasionChance = 0;
    this.guaranteedEvasion = false;
    this.selectedHistory = [];
    this.selectedAttackActiveHistory = [];
    this.hitRecords = new Set();
    this.lastSuccessfulActionKey = null;
    this.forbiddenActionKey = null;
    this.forbiddenRemaining = 0;
    this.attackSelectionCount1To5 = 0;
    this.lastMeditationSuccessTurn = null;
    characterLogic.adjustInitialStats(this);
    characterLogic.initUniqueState(this, new Set((this.data.unique_statuses || []).map((item) => item.name)));
    this.inscriptions = inscriptions;
  }

  get name() {
    return this.data.name;
  }

  get title() {
    return this.data.title;
  }

  get characterId() {
    return String(this.data.id || "");
  }

  get label() {
    return `${this.name} - ${this.title}`;
  }

  get inscriptionName() {
    return this.inscription.name || titleCase(this.inscriptionId);
  }

  get inscriptionDescription() {
    return this.inscription.description || "효과 없음";
  }
}

class Battle {
  constructor({
    characters,
    inscriptions,
    playerIndex,
    aiIndex,
    personalityId = "R",
    seed = null,
    rng = null,
    playerInscriptionId = DEFAULT_INSCRIPTION_ID,
    aiInscriptionId = DEFAULT_INSCRIPTION_ID,
    hidePersonalityUntilGameOver = false,
    maxTurns = 200,
  }) {
    this.characters = characters;
    this.inscriptions = normalizeInscriptions(inscriptions);
    this.rng = rng || new Mulberry32(seed);
    this.player = new Fighter("PLAYER", characters[playerIndex], inscriptionById(this.inscriptions, playerInscriptionId), this.inscriptions);
    this.ai = new Fighter("AI", characters[aiIndex], inscriptionById(this.inscriptions, aiInscriptionId), this.inscriptions);
    this.personality = findPersonality(personalityId);
    this.turn = 1;
    this.record = new TurnRecord();
    this.logs = [];
    this.maxTurns = Number(maxTurns || 200);
    this.hidePersonalityUntilGameOver = Boolean(hidePersonalityUntilGameOver);
    this.gameOver = false;
    this.winner = null;
    this.loser = null;
    this.turnOrder = {};
  }

  visiblePersonality() {
    if (this.hidePersonalityUntilGameOver && !this.gameOver) {
      return { id: "random", name: "RANDOM" };
    }
    return this.personality;
  }

  startTurn() {
    this.record = new TurnRecord();
    this.turnOrder = {};
    for (const fighter of [this.player, this.ai]) {
      fighter.defenseMult = null;
      fighter.defenseName = null;
      fighter.evasionChance = 0;
      fighter.guaranteedEvasion = false;
      characterLogic.resetTurnFlags(this, fighter);
      this.record.attackDamageTaken[fighter.side] = 0;
      this.record.freezeRemoved[fighter.side] = false;
      this.record.defenseReduced[fighter.side] = 0;
      this.record.gainedInsight[fighter.side] = false;
    }
  }

  opponent(fighter) {
    return fighter === this.player ? this.ai : this.player;
  }

  kindIsAttack(kind) {
    return kind === "공격" || kind === "액티브 공격";
  }

  skillKey(characterId, slot) {
    return skillKey(characterId, slot);
  }

  commonActionKey(kind) {
    return commonActionKey(kind);
  }

  displayActionName(fighter, actionKey) {
    if (!actionKey) return "";
    return availableActions(fighter).find((action) => action.key === actionKey)?.name || actionKey;
  }

  actionKeyIsAttack(fighter, actionKey) {
    return Boolean(availableActions(fighter).find((action) => action.key === actionKey)?.isAttack);
  }

  actionKeyIsDefense(fighter, actionKey) {
    return Boolean(availableActions(fighter).find((action) => action.key === actionKey)?.isDefense);
  }

  recentKindCounts(fighter, limit = 4) {
    const counts = { attack: 0, defense: 0, meditation: 0 };
    let history = fighter.selectedHistory;
    if (Object.hasOwn(this.record.selected, fighter.side)) history = history.slice(0, -1);
    for (const actionKey of history.slice(-limit)) {
      if (actionKey === commonActionKey("meditation")) counts.meditation += 1;
      else if (this.actionKeyIsDefense(fighter, actionKey)) counts.defense += 1;
      else if (this.actionKeyIsAttack(fighter, actionKey)) counts.attack += 1;
    }
    return counts;
  }

  isActorFirst(choice) {
    return this.turnOrder[choice.actor.side] === 0;
  }

  findActionByInput(fighter, raw) {
    const value = String(raw || "").trim();
    return availableActions(fighter).find((action) => String(action.number) === value || action.key === value || action.name === value) || null;
  }

  makeChoice(fighter, action) {
    const choice = new Choice(fighter, action, this.effectiveCost(fighter, action), this.effectivePriority(fighter, action));
    characterLogic.onMakeChoice(this, fighter, action, choice);
    this.record.selected[fighter.side] = action.name;
    this.record.selectedKey[fighter.side] = action.key;
    this.record.selectedKind[fighter.side] = actionKind(action);
    fighter.selectedHistory.push(action.key);
    return choice;
  }

  isLegalChoice(fighter, action) {
    if (fighter.forbiddenActionKey === action.key && fighter.forbiddenRemaining > 0) return false;
    const characterResult = characterLogic.isLegalChoice(this, fighter, action);
    if (characterResult !== null && characterResult !== undefined) return Boolean(characterResult);
    return fighter.mp >= this.effectiveCost(fighter, action);
  }

  effectiveCost(fighter, action) {
    let cost = Number(action.mp || 0);
    if (action.isActive) {
      cost = characterLogic.modifyCost(this, fighter, action, cost);
      for (const effect of fighter.costEffects) cost = floorInt(cost * effect.multiplier);
      if (hasInscription(fighter, "red") && action.isAttack) cost += 3;
    }
    let history = fighter.selectedHistory;
    if (Object.hasOwn(this.record.selected, fighter.side)) history = history.slice(0, -1);
    if (history.at(-1) === action.key) {
      if (hasInscription(fighter, "indigo")) cost += 2;
      if (hasInscription(this.opponent(fighter), "indigo")) cost += 5;
    }
    return Math.max(0, Number(cost));
  }

  effectivePriority(fighter, action) {
    return characterLogic.modifyPriority(this, fighter, action, Number(action.priority || 0));
  }

  selectAiAction(actor = this.ai, target = this.player, personality = this.personality) {
    let legal = availableActions(actor).filter((action) => this.isLegalChoice(actor, action));
    if (!legal.length) return availableActions(actor)[0];
    const viable = legal.filter((action) => !characterLogic.wouldConditionFail(this, actor, target, action));
    if (viable.length) legal = viable;
    if (personality.id === "M") return this.rng.choice(legal);
    const tuning = AI_SEARCH_TUNING[personality.id] || AI_SEARCH_TUNING.R;
    const deadline = Date.now() + tuning.timeLimitMs;
    const scored = legal.map((action) => ({
      action,
      score: this.searchActionScore(actor, target, action, personality.id, tuning, deadline)
        + this.scoreAction(actor, target, action, personality.id) * 0.18,
    }));
    return this.weightedPersonalityChoice(scored, personality.id);
  }

  scoreAction(actor, target, action, personalityId) {
    const baseDamage = this.estimateActionDamage(actor, target, action, false);
    const maxDamage = this.estimateActionDamage(actor, target, action, true);
    const hitRate = this.estimateHitRate(actor, target, action) / 100;
    const expectedDamage = baseDamage * hitRate;
    const conditionFails = characterLogic.wouldConditionFail(this, actor, target, action);
    const cost = this.effectiveCost(actor, action);
    let score = expectedDamage * 3;

    if (!conditionFails && maxDamage >= target.hp && action.isAttack) score += 10000 + maxDamage - target.hp;
    else if (!conditionFails && expectedDamage >= target.hp && action.isAttack) score += 7000;
    if (action.isDefense) {
      const incoming = this.estimateBestIncomingDamage(target, actor);
      const mult = defenseMultiplierForStreak(
        actor.defenseStreak + 1,
        characterLogic.defenseScoreBonusReduction(actor, action),
      );
      const prevented = incoming * (1 - mult);
      score += prevented * 1.8;
      if (actor.hp <= incoming && actor.hp > incoming * mult) score += 2500;
    }
    if (action.isCommonAction("meditation")) {
      score += Math.min(this.meditationRecovery(actor), actor.maxMp - actor.mp) * 8;
      if (actor.mp < 40) score += 80;
    }
    if (!action.isAttack && action.isActive) score += this.setupValue(actor, target, action);
    if (["마비", "빙결", "회진"].some((word) => action.description.includes(word))) score += 120 * hitRate;
    if (["ATK", "DEF", "SPD"].some((word) => action.description.includes(word))) score += 80;
    if (action.isDefense && action.isActive) score += 60;
    if (action.description.includes("[연격]")) score += maxDamage * 0.5;
    if (action.description.includes("고정 피해")) score += 70;
    score += characterLogic.aiScore(this, actor, target, action, expectedDamage, hitRate);
    score -= cost * 1.2;
    if (cost > actor.mp) score -= 9999;
    if (conditionFails) score -= 12000;
    score -= this.repetitionPenalty(actor, action, personalityId);

    if (personalityId === "C") {
      score += expectedDamage * 1.4 + maxDamage + (action.isAttack ? 120 : 0);
    } else if (personalityId === "D") {
      if (actor.hp < actor.maxHp * 0.45 && (action.isDefense || action.description.includes("회복") || action.isCommonAction("meditation"))) score += 350;
      score -= cost * 0.4;
    } else if (personalityId === "G") {
      score += maxDamage * 2;
      if (action.accuracy !== null && action.accuracy < 85) score += 160;
    } else if (personalityId === "E") {
      if (!action.isAttack) score += 230;
      if (["중첩", "4턴", "3턴", "MP"].some((word) => action.description.includes(word))) score += 160;
    } else if (personalityId === "J") {
      if (["실패", "선택할 수 없", "회피", "감소", "상태"].some((word) => action.description.includes(word))) score += 260;
    } else if (personalityId === "A") {
      score += this.adaptiveBonus(actor, target, action);
    }
    return score;
  }

  weightedPersonalityChoice(scored, personalityId) {
    const tuning = AI_PERSONALITY_TUNING[personalityId] || AI_PERSONALITY_TUNING.R;
    const best = Math.max(...scored.map((item) => item.score));
    const candidates = scored.filter((item) => best - item.score <= tuning.topGap);
    if (candidates.length === 1) return candidates[0].action;
    if (this.rng.next() < tuning.exploration) return this.rng.choice(candidates).action;
    const weights = candidates.map((item) => Math.exp((item.score - best) / Math.max(1, tuning.temperature)));
    const total = weights.reduce((sum, value) => sum + value, 0);
    let point = this.rng.next() * total;
    for (let index = 0; index < candidates.length; index += 1) {
      point -= weights[index];
      if (point <= 0) return candidates[index].action;
    }
    return candidates[candidates.length - 1].action;
  }

  setupValue(actor, target, action) {
    let value = 0;
    const description = action.description;
    if (description.includes("ATK")) value += 120;
    if (description.includes("DEF")) value += 70;
    if (description.includes("SPD") || description.includes("우선도")) value += 80;
    if (description.includes("회복")) value += 70;
    if (description.includes("중첩")) value += 90;
    value += characterLogic.setupValue(this, actor, target, action);
    if (target.hp < this.estimateBestIncomingDamage(actor, target)) value -= 150;
    return value;
  }

  repetitionPenalty(actor, action, personalityId) {
    let streak = 0;
    for (let index = actor.selectedHistory.length - 1; index >= 0 && actor.selectedHistory[index] === action.key; index -= 1) streak += 1;
    if (!streak) return 0;
    const tuning = AI_PERSONALITY_TUNING[personalityId] || AI_PERSONALITY_TUNING.R;
    let penalty = tuning.repeatPenalty * (1 + (streak - 1) * 1.4);
    if (personalityId === "D" && action.isDefense) penalty *= 0.45;
    if (personalityId === "C" && action.isAttack) penalty *= 0.65;
    if (personalityId === "E" && ["중첩", "4턴", "3턴", "MP"].some((word) => action.description.includes(word))) penalty *= 0.55;
    if (personalityId === "J") penalty *= 1.25;
    if (action.isCommonAction("meditation") && actor.mp >= 70) penalty *= 1.8;
    return penalty;
  }

  adaptiveBonus(actor, target, action) {
    let history = target.selectedHistory;
    if (Object.hasOwn(this.record.selected, target.side)) history = history.slice(0, -1);
    const recent = history.slice(-3);
    const attacks = recent.filter((key) => this.actionKeyIsAttack(target, key)).length;
    const defenses = recent.filter((key) => this.actionKeyIsDefense(target, key)).length;
    const meditations = recent.filter((key) => key === commonActionKey("meditation")).length;
    let bonus = 0;
    if (attacks >= 2 && action.isDefense) bonus += 350;
    if (defenses >= 2 && (action.isDefense || action.priority >= 1)) bonus += 120;
    if (meditations >= 1 && action.isAttack) bonus += 180;
    return bonus;
  }

  searchActionScore(actor, target, action, personalityId, tuning, deadline) {
    let responses = availableActions(target).filter((candidate) => this.isLegalChoice(target, candidate));
    if (!responses.length) responses = [normalActions()[0]];
    const weights = this.responseWeights(target, actor, responses);
    const outcomes = [];
    for (let index = 0; index < responses.length; index += 1) {
      const response = responses[index];
      const simulation = this.simulateActionPair(actor.side, action, response);
      let value = this.evaluateSimulation(simulation, actor, target, action, response, personalityId);
      if (tuning.depth > 1 && !simulation.gameOver && Date.now() < deadline) {
        simulation.turn += 1;
        simulation.startTurn();
        const future = simulation.lookaheadPositionValue(actor.side, personalityId, tuning.depth - 1, tuning, deadline);
        value = value * (1 - tuning.discount) + future * tuning.discount;
      }
      outcomes.push({ value, weight: weights[index], response });
    }
    const expected = outcomes.reduce((sum, item) => sum + item.value * item.weight, 0);
    const worst = Math.min(...outcomes.map((item) => item.value));
    const best = Math.max(...outcomes.map((item) => item.value));
    const likely = outcomes.reduce((current, item) => item.weight > current.weight ? item : current, outcomes[0]);
    if (personalityId === "D") return expected * 0.35 + worst * 0.65;
    if (personalityId === "G") return expected * 0.35 + best * 0.65;
    if (personalityId === "C") return expected * 0.7 + best * 0.3 + (action.isAttack ? 180 : -80);
    if (personalityId === "E") return expected * 0.82 + best * 0.12 - action.mp * 0.35;
    if (personalityId === "J") return expected * 0.65 + likely.value * 0.35 + this.disruptionBonus(action, likely.response);
    if (personalityId === "A") return expected + this.adaptiveBonus(actor, target, action) * 1.6;
    return expected;
  }

  lookaheadPositionValue(actorSide, personalityId, depth, tuning, deadline) {
    const actor = this.fighterBySide(actorSide);
    const target = this.opponent(actor);
    if (this.gameOver || depth <= 0 || Date.now() >= deadline) return this.evaluatePosition(actorSide, personalityId);
    let legal = availableActions(actor).filter((action) => this.isLegalChoice(actor, action));
    if (!legal.length) legal = [normalActions()[0]];
    legal = this.prioritizedActions(actor, target, legal, personalityId, tuning.beam);
    const values = [];
    for (const action of legal) {
      if (Date.now() >= deadline) break;
      values.push(this.lookaheadActionValue(actorSide, action, personalityId, depth, tuning, deadline));
    }
    if (!values.length) return this.evaluatePosition(actorSide, personalityId);
    if (personalityId === "D") return Math.max(...values) * 0.78 + Math.min(...values) * 0.22;
    if (personalityId === "G") return Math.max(...values);
    if (personalityId === "E") {
      values.sort((a, b) => b - a);
      const top = values.slice(0, 3);
      return values[0] * 0.82 + (top.reduce((sum, value) => sum + value, 0) / top.length) * 0.18;
    }
    return Math.max(...values);
  }

  lookaheadActionValue(actorSide, action, personalityId, depth, tuning, deadline) {
    const actor = this.fighterBySide(actorSide);
    const target = this.opponent(actor);
    let responses = availableActions(target).filter((candidate) => this.isLegalChoice(target, candidate));
    if (!responses.length) responses = [normalActions()[0]];
    responses = this.prioritizedActions(target, actor, responses, "R", tuning.responses);
    const weights = this.responseWeights(target, actor, responses);
    let value = 0;
    let handledWeight = 0;
    for (let index = 0; index < responses.length && Date.now() < deadline; index += 1) {
      const response = responses[index];
      const simulation = this.simulateActionPair(actorSide, action, response);
      const immediate = this.evaluateSimulation(simulation, actor, target, action, response, personalityId);
      let outcome = immediate;
      if (depth > 1 && !simulation.gameOver && Date.now() < deadline) {
        simulation.turn += 1;
        simulation.startTurn();
        const future = simulation.lookaheadPositionValue(actorSide, personalityId, depth - 1, tuning, deadline);
        outcome = immediate * (1 - tuning.discount) + future * tuning.discount;
      }
      value += outcome * weights[index];
      handledWeight += weights[index];
    }
    if (handledWeight <= 0) return this.evaluatePosition(actorSide, personalityId);
    value /= handledWeight;
    if (personalityId === "C" && action.isAttack) value += 120;
    if (personalityId === "E" && !action.isAttack) value += 90;
    return value;
  }

  prioritizedActions(actor, target, actions, personalityId, limit) {
    if (actions.length <= limit) return actions;
    return actions
      .map((action, index) => ({ action, index, score: this.scoreAction(actor, target, action, personalityId) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, limit)
      .map((item) => item.action);
  }

  responseWeights(actor, target, actions) {
    const scores = actions.map((action) => this.scoreAction(actor, target, action, "R"));
    const best = Math.max(...scores);
    const weights = scores.map((score) => Math.exp((score - best) / 95));
    const total = weights.reduce((sum, value) => sum + value, 0);
    return total > 0 ? weights.map((value) => value / total) : weights.map(() => 1 / weights.length);
  }

  simulateActionPair(actorSide, actorAction, targetAction) {
    const simulation = this.cloneForSimulation();
    const actor = simulation.fighterBySide(actorSide);
    const target = simulation.opponent(actor);
    const ownAction = simulation.matchAction(actor, actorAction);
    const response = simulation.matchAction(target, targetAction);
    const ownChoice = simulation.makeChoice(actor, ownAction);
    const targetChoice = simulation.makeChoice(target, response);
    if (actor === simulation.player) simulation.resolveTurn(ownChoice, targetChoice);
    else simulation.resolveTurn(targetChoice, ownChoice);
    return simulation;
  }

  cloneForSimulation() {
    const clone = Object.create(Battle.prototype);
    clone.characters = this.characters;
    clone.inscriptions = this.inscriptions;
    clone.rng = new Mulberry32(0);
    clone.rng.state = this.rng.state;
    clone.player = cloneFighter(this.player);
    clone.ai = cloneFighter(this.ai);
    clone.personality = { ...this.personality };
    clone.turn = this.turn;
    clone.record = cloneTurnRecord(this.record);
    clone.logs = [];
    clone.maxTurns = this.maxTurns;
    clone.hidePersonalityUntilGameOver = this.hidePersonalityUntilGameOver;
    clone.gameOver = this.gameOver;
    clone.winner = this.winner ? clone.fighterBySide(this.winner.side) : null;
    clone.loser = this.loser ? clone.fighterBySide(this.loser.side) : null;
    clone.turnOrder = { ...this.turnOrder };
    return clone;
  }

  fighterBySide(side) {
    return this.player.side === side ? this.player : this.ai;
  }

  matchAction(fighter, action) {
    const actions = availableActions(fighter);
    return actions.find((candidate) => candidate.number === action.number && candidate.name === action.name)
      || actions.find((candidate) => candidate.name === action.name)
      || normalActions()[0];
  }

  evaluateSimulation(simulation, actor, target, action, response, personalityId) {
    const me = simulation.fighterBySide(actor.side);
    const opponent = simulation.opponent(me);
    if (simulation.gameOver) {
      if (simulation.winner?.side === actor.side) return 240000 - simulation.turn * 250;
      if (simulation.loser?.side === actor.side) return -240000 + simulation.turn * 250;
      return 0;
    }
    const damageDealt = Math.max(0, target.hp - opponent.hp);
    const damageTaken = Math.max(0, actor.hp - me.hp);
    const hpScore = (me.hp / me.maxHp - opponent.hp / opponent.maxHp) * 6200;
    const mpScore = (me.mp - opponent.mp) * 14;
    const statScore = simulation.statAdvantageValue(me, opponent);
    const statusScore = simulation.statusPressureValue(opponent) - simulation.statusPressureValue(me) * 1.15;
    const resourceScore = simulation.resourceValue(me) - simulation.resourceValue(opponent) * 0.85;
    let value = hpScore + mpScore + statScore + statusScore + resourceScore + damageDealt * 48 - damageTaken * 58;
    if (personalityId === "C") value += damageDealt * 42 - damageTaken * 18 + (opponent.maxHp - opponent.hp) * 12;
    else if (personalityId === "D") value += (me.hp / me.maxHp) * 2600 - damageTaken * 52 + (action.isDefense ? 320 : 0);
    else if (personalityId === "G") value += damageDealt * (action.accuracy !== null && action.accuracy < 90 ? 70 : 35) + (action.accuracy !== null && action.accuracy < 85 ? 260 : 0);
    else if (personalityId === "E") value += me.mp * 18 + simulation.resourceValue(me) * 1.5 + statusScore * 0.6 + simulation.futurePotentialScore(me.side) * 0.55;
    else if (personalityId === "J") value += simulation.statusPressureValue(opponent) * 1.8 + Math.max(0, target.mp - opponent.mp) * 28 + this.disruptionBonus(action, response);
    else if (personalityId === "A") value += this.matchupBonus(actionKind(action), actionKind(response)) * 360;
    return value;
  }

  evaluatePosition(actorSide, personalityId) {
    const me = this.fighterBySide(actorSide);
    const opponent = this.opponent(me);
    if (this.gameOver) {
      if (this.winner?.side === actorSide) return 240000 - this.turn * 250;
      if (this.loser?.side === actorSide) return -240000 + this.turn * 250;
      return 0;
    }
    const statusScore = this.statusPressureValue(opponent) - this.statusPressureValue(me) * 1.15;
    let value = (me.hp / me.maxHp - opponent.hp / opponent.maxHp) * 6200
      + (me.mp - opponent.mp) * 14
      + this.statAdvantageValue(me, opponent)
      + statusScore
      + this.resourceValue(me) - this.resourceValue(opponent) * 0.85;
    if (personalityId === "C") value += (opponent.maxHp - opponent.hp) * 32 - (me.maxHp - me.hp) * 10;
    else if (personalityId === "D") value += (me.hp / me.maxHp) * 2600 - this.estimateBestIncomingDamage(opponent, me) * 42;
    else if (personalityId === "G") value += (opponent.maxHp - opponent.hp) * 18 + Math.max(...availableActions(me).map((action) => this.estimateActionDamage(me, opponent, action, true))) * 40;
    else if (personalityId === "E") value += me.mp * 24 + this.resourceValue(me) * 1.7 + this.futurePotentialScore(me.side) * 0.5;
    else if (personalityId === "J") value += this.statusPressureValue(opponent) * 1.9 - this.statusPressureValue(me) * 0.55;
    else if (personalityId === "A") value += this.patternReadValue(me, opponent) * 320;
    return value;
  }

  statAdvantageValue(me, opponent) {
    const [myAtk, myDef, mySpd] = this.currentStats(me);
    const [opAtk, opDef, opSpd] = this.currentStats(opponent);
    return (myAtk - opAtk) * 10 + (myDef - opDef) * 7 + (mySpd - opSpd) * 4;
  }

  statusPressureValue(fighter) {
    let value = 0;
    for (const status of Object.values(fighter.statuses)) {
      let base = 60 + status.remaining * 24 + status.stacks * 36;
      if (["마비", "빙결"].includes(status.name)) base *= 1.8;
      else if (["화상", "역병", "갈증"].includes(status.name)) base *= 1.35;
      value += base;
    }
    return value;
  }

  resourceValue(fighter) {
    let value = 0;
    for (const [name, raw] of Object.entries(fighter.counters)) {
      const handled = characterLogic.counterResourceValue(fighter, name, raw);
      if (handled !== null && handled !== undefined) value += Number(handled);
      else if (typeof raw === "number" && Number.isInteger(raw)) value += raw * (["탄환", "집광", "과령", "권의", "통찰"].includes(name) ? 70 : 35);
      else if (typeof raw === "string") value += 45;
    }
    return value;
  }

  disruptionBonus(action, response) {
    let bonus = ["실패", "선택할 수 없다", "MP", "감소", "회피", "상태"].some((word) => action.description.includes(word)) ? 260 : 0;
    bonus += this.matchupBonus(actionKind(action), actionKind(response)) * 180;
    return bonus;
  }

  matchupBonus(ownKind, opponentKind) {
    if (opponentKind === "명상" && this.kindIsAttack(ownKind)) return 1;
    if (this.kindIsAttack(opponentKind) && ownKind === "방어") return 1;
    if (opponentKind === "방어" && ownKind === "명상") return 1;
    return 0;
  }

  futurePotentialScore(actorSide) {
    const future = this.cloneForSimulation();
    if (future.gameOver) return 0;
    future.startTurn();
    const actor = future.fighterBySide(actorSide);
    const target = future.opponent(actor);
    const actorScores = availableActions(actor).filter((action) => future.isLegalChoice(actor, action)).map((action) => future.scoreAction(actor, target, action, "E"));
    const targetScores = availableActions(target).filter((action) => future.isLegalChoice(target, action)).map((action) => future.scoreAction(target, actor, action, "R"));
    const actorBest = actorScores.length ? Math.max(...actorScores) : 0;
    const targetBest = targetScores.length ? Math.max(...targetScores) : 0;
    return actorBest - targetBest * 0.45
      + (future.resourceValue(actor) - future.resourceValue(target) * 0.85) * 1.2
      + (actor.mp - target.mp) * 14
      + (future.statusPressureValue(target) - future.statusPressureValue(actor)) * 0.6;
  }

  patternReadValue(actor, target) {
    const recent = target.selectedHistory.slice(-4);
    const attacks = recent.filter((key) => this.actionKeyIsAttack(target, key)).length;
    const defenses = recent.filter((key) => this.actionKeyIsDefense(target, key)).length;
    let repeats = 0;
    for (let index = 1; index < recent.length; index += 1) if (recent[index - 1] === recent[index]) repeats += 1;
    let value = attacks * 0.35 + defenses * 0.18 + repeats * 0.45;
    if (actor.selectedHistory.length && target.selectedHistory.at(-1) === actor.selectedHistory.at(-1)) value -= 0.15;
    return value;
  }

  resolveTurn(playerChoice, aiChoice) {
    const order = this.actionOrder(playerChoice, aiChoice);
    this.logs.push(`${playerChoice.actor.name} 선택: ${playerChoice.action.name}`);
    this.logs.push(`${aiChoice.actor.name} 선택: ${aiChoice.action.name}`);
    for (const [index, choice] of order.entries()) {
      if (this.gameOver) break;
      this.turnOrder[choice.actor.side] = index;
      this.executeAction(choice);
    }
    if (!this.gameOver) characterLogic.afterActionPhase(this);
    if (!this.gameOver) this.endTurn();
  }

  actionOrder(a, b) {
    if (a.priority !== b.priority) return a.priority > b.priority ? [a, b] : [b, a];
    const aSpd = this.currentStats(a.actor)[2];
    const bSpd = this.currentStats(b.actor)[2];
    const total = aSpd + bSpd;
    const aProb = total <= 0 ? 50 : (aSpd / total) * 100;
    return this.roll("turn order") < aProb ? [a, b] : [b, a];
  }

  executeAction(choice) {
    const actor = choice.actor;
    const target = this.opponent(actor);
    const action = choice.action;
    if (actor.hp <= 0) return;
    this.logs.push(`[${actor.name} 행동]`);
    this.logs.push(`${actor.name}은 ${action.name}을 사용했다.`);
    if (this.applyActionStartEffects(choice)) {
      this.finishAction(choice, false, false);
      return;
    }
    const resolvedAction = choice.action;
    if (actor.mp < choice.totalCost) {
      this.logs.push(`MP 부족으로 행동에 실패했다. MP ${actor.mp}/${choice.totalCost}`);
      this.finishAction(choice, false, false);
      return;
    }
    const beforeMp = actor.mp;
    actor.mp -= choice.totalCost;
    if (choice.totalCost) this.logs.push(`MP ${beforeMp} -> ${actor.mp}`);
    if (resolvedAction.isActive && choice.totalCost > 0) {
      if (resolvedAction.isAttack) {
      this.record.activeAttackMpSpent[actor.side] = choice.cost;
      }
      characterLogic.onActiveMpSpent(this, actor);
      if ((actor.data.unique_statuses || []).some((status) => status.name === "잔류")) {
        actor.counters["잔류"] = Math.min(4, Number(actor.counters["잔류"] || 0) + 1);
      }
    }
    let hit = true;
    if (resolvedAction.accuracy !== null) {
      hit = this.accuracyCheck(choice);
      if (!hit) {
        this.finishAction(choice, false, false, true);
        return;
      }
    }
    if (!this.applyConditionEffects(choice)) {
      this.logs.push("조건을 만족하지 못해 행동에 실패했다.");
      this.finishAction(choice, false, hit);
      return;
    }
    if (resolvedAction.isAttack) {
      const totalDamage = this.applyAttackDamage(choice);
      if (this.gameOver) return;
      this.applyOnHitEffects(choice, totalDamage);
      if (this.gameOver) return;
      this.finishAction(choice, true, true);
    } else {
      this.applyNonAttackEffects(choice);
      if (this.gameOver) return;
      this.finishAction(choice, true, hit);
    }
  }

  applyActionStartEffects(choice) {
    const actor = choice.actor;
    if (characterLogic.onActionStartBeforeCommon(this, choice)) return true;
    if (actor.statuses["마비"]) {
      const roll = this.roll("마비");
      this.logs.push(`마비 판정 20% / 판정값 ${roll.toFixed(2)}`);
      if (roll < 20) {
        this.logs.push("마비로 행동에 실패했다.");
        return true;
      }
    }
    if (characterLogic.onActionStartAfterParalysis(this, choice)) return true;
    return characterLogic.onActionStartAfterCommon(this, choice);
  }

  accuracyCheck(choice) {
    const target = this.opponent(choice.actor);
    const accuracy = this.modifiedAccuracy(choice);
    if (accuracy >= 100) {
      this.logs.push(`명중률 ${pct(accuracy)} - 명중 판정 성공.`);
    } else {
      const roll = this.roll("명중");
      this.logs.push(`명중률 ${pct(accuracy)} / 판정값 ${roll.toFixed(2)}`);
      if (roll >= accuracy) {
        this.logs.push("명중 판정 실패. 공격이 빗나갔다.");
        return false;
      }
      this.logs.push("명중 판정 성공.");
    }
    if (choice.guaranteedHit && choice.action.isAttack) {
      this.logs.push("필중 효과로 회피 판정을 통과한다.");
      return true;
    }
    const evasion = this.targetEvasion(target, choice);
    if (target.guaranteedEvasion && choice.action.isAttack) {
      this.logs.push("공격을 회피했다.");
      return false;
    }
    if (evasion > 0) {
      const roll = this.roll("회피");
      this.logs.push(`${target.name} 회피 확률 ${pct(evasion)} / 판정값 ${roll.toFixed(2)}`);
      if (roll < evasion) {
        this.logs.push("공격을 회피했다.");
        return false;
      }
      this.logs.push("회피 판정 실패.");
    }
    return true;
  }

  modifiedAccuracy(choice) {
    if (choice.action.accuracy === null) return 100;
    let accuracy = Number(choice.action.accuracy);
    accuracy = characterLogic.modifyAccuracy(this, choice, this.opponent(choice.actor), accuracy);
    if (hasInscription(choice.actor, "orange")) accuracy += 10;
    if (hasInscription(choice.actor, "violet")) accuracy -= 5;
    return clamp(accuracy, 0, 100);
  }

  targetEvasion(target, choice) {
    let evasion = Number(target.evasionChance || 0);
    if (hasInscription(target, "yellow") && target.hp < target.maxHp * 0.3 && choice.action.isAttack) evasion += 10;
    evasion = characterLogic.targetEvasion(this, target, choice, evasion);
    return clamp(evasion, 0, 100);
  }

  applyConditionEffects(choice) {
    choice.power = choice.action.power;
    return characterLogic.applyConditionEffects(this, choice);
  }

  applyAttackDamage(choice) {
    const actor = choice.actor;
    const target = this.opponent(actor);
    const hits = Math.max(1, Number(choice.hitCount || 1));
    let total = 0;
    for (let index = 1; index <= hits; index += 1) {
      const damage = this.calculateAttackDamage(choice);
      const before = target.hp;
      const result = this.damage(target, damage, `${choice.action.name} 공격 피해`, true, actor);
      const applied = result.amount;
      total += applied;
      this.logs.push(`${target.name}에게 ${applied}의 피해. HP ${before} -> ${target.hp}`);
      if (result.revived) characterLogic.printDefeatEscape(this, target, result.revived);
      if (this.gameOver) break;
    }
    this.record.attackHit[actor.side] = true;
    return total;
  }

  applyOnHitEffects(choice, totalDamage) {
    characterLogic.onHitPreDefense(this, choice, totalDamage);
    if (this.gameOver) return;
    characterLogic.onDefenseHit(this, choice, totalDamage);
    if (this.gameOver) return;
    characterLogic.onHitAfterDefense(this, choice, totalDamage);
  }

  calculateAttackDamage(choice) {
    const actor = choice.actor;
    const target = this.opponent(actor);
    let targetDef = this.currentStats(target)[1];
    targetDef = characterLogic.targetDefenseForAttack(this, choice, target, targetDef);
    let power = Math.max(0, Number(choice.power || 0));
    power = characterLogic.modifyAttackPower(this, choice, power);
    if (hasInscription(actor, "white")) power = Math.max(0, power - whitePowerPenalty(choice.action));
    if (hasInscription(actor, "red")) power += redPowerBonus(choice.action);
    const atk = choice.attackAtkOverride == null ? this.currentStats(actor)[0] : Number(choice.attackAtkOverride);
    let mult = 1;
    for (const value of characterLogic.attackDamageMultipliers(this, choice)) mult *= Number(value || 1);
    let damage = Math.max(1, floorInt((power * (atk + 50)) / (targetDef + 50) * mult));
    damage = characterLogic.modifyAttackDamage(this, choice, target, damage);
    if (hasInscription(actor, "white") && choice.action.isCommonAction("normal_attack")) damage += 1;
    return Math.max(1, Math.trunc(damage));
  }

  applyNonAttackEffects(choice) {
    const actor = choice.actor;
    const action = choice.action;
    if (action.isCommonAction("defense")) {
      this.applyDefense(actor, action.name, choice.defenseBonusReduction);
      return;
    }
    if (action.isCommonAction("meditation")) {
      this.restoreMp(actor, this.meditationRecovery(actor), "명상");
      characterLogic.onMeditationEffect(this, choice);
      return;
    }
    if (!characterLogic.applyNonAttackEffects(this, choice)) {
      this.logs.push("효과를 처리했다.");
    }
  }

  meditationRecovery(fighter) {
    return 15 + (hasInscription(fighter, "white") ? 1 : 0);
  }

  finishAction(choice, success, hit, missNotFailure = false) {
    const actor = choice.actor;
    const action = choice.action;
    const failed = !success && !missNotFailure;
    this.record.actionSuccess[actor.side] = Boolean(success);
    if (success) actor.lastSuccessfulActionKey = action.key;
    if (action.isDefense && success) actor.defenseStreak += 1;
    else if (!failed) actor.defenseStreak = 0;
    characterLogic.finishAction(this, choice, success, hit, missNotFailure);
  }

  applyDefense(actor, name, bonusReduction = 0) {
    actor.defenseName = name;
    actor.defenseMult = defenseMultiplierForStreak(actor.defenseStreak + 1, bonusReduction);
    this.logs.push(`[방어] 성공. 이번 턴 공격 피해를 ${defenseReductionPercentForStreak(actor.defenseStreak + 1, bonusReduction)}% 경감한다.`);
  }

  endTurn() {
    this.logs.push("[턴 종료]");
    for (const fighter of [this.player, this.ai]) {
      if (this.gameOver) return;
      characterLogic.applyPreMpTurnEnd(this, fighter);
    }
    for (const fighter of [this.player, this.ai]) {
      if (this.gameOver) return;
      this.restoreMp(fighter, this.turnEndMpRecovery(fighter), "턴 종료 기본 회복");
    }
    for (const fighter of [this.player, this.ai]) {
      if (this.gameOver) return;
      if (hasInscription(fighter, "green") && fighter.hp < fighter.maxHp) this.heal(fighter, 2, "Green");
    }
    for (const fighter of [this.player, this.ai]) {
      if (this.gameOver) return;
      characterLogic.applyOtherTurnEnd(this, fighter);
    }
    if (!this.gameOver) {
      for (const fighter of [this.player, this.ai]) this.decrementDurations(fighter);
    }
  }

  turnEndMpRecovery(fighter) {
    let base = 10;
    if (hasInscription(fighter, "green")) base -= 4;
    if (hasInscription(fighter, "blue")) base += 1;
    return Math.max(0, base + characterLogic.turnEndMpBonus(fighter));
  }

  decrementDurations(fighter) {
    for (const [name, status] of Object.entries({ ...fighter.statuses })) {
      status.remaining -= 1;
      if (status.remaining <= 0 || status.stacks <= 0) {
        delete fighter.statuses[name];
        this.logs.push(`${fighter.name}의 ${name} 효과가 사라졌다.`);
      }
    }
    for (const effect of [...fighter.statEffects]) {
      effect.remaining -= 1;
      if (effect.remaining <= 0) fighter.statEffects.splice(fighter.statEffects.indexOf(effect), 1);
    }
    for (const effect of [...fighter.costEffects]) {
      effect.remaining -= 1;
      if (effect.remaining <= 0) fighter.costEffects.splice(fighter.costEffects.indexOf(effect), 1);
    }
    if (fighter.forbiddenRemaining > 0) {
      fighter.forbiddenRemaining -= 1;
      if (fighter.forbiddenRemaining <= 0) fighter.forbiddenActionKey = null;
    }
    characterLogic.decrementCounters(fighter);
  }

  currentStats(fighter) {
    let atk = fighter.baseAtk;
    let defense = fighter.baseDef;
    let spd = fighter.baseSpd;
    if (fighter.statuses["마비"]) spd *= 0.8;
    [atk, defense, spd] = characterLogic.modifyStats(this, fighter, atk, defense, spd);
    for (const effect of fighter.statEffects) {
      if (effect.stat === "atk") atk *= effect.multiplier;
      if (effect.stat === "def") defense *= effect.multiplier;
      if (effect.stat === "spd") spd *= effect.multiplier;
    }
    if (hasInscription(fighter, "orange")) atk *= 0.9;
    if (hasInscription(fighter, "blue")) defense *= 0.9;
    if (hasInscription(fighter, "violet")) {
      atk *= 1.1;
      defense *= 1.1;
    }
    if (hasInscription(fighter, "yellow")) spd *= fighter.hp >= fighter.maxHp * 0.3 ? 0.7 : 1.7;
    return [atk, defense, spd];
  }

  damage(target, amount, reason, attack = false, source = null) {
    let value = Math.max(0, Math.trunc(amount));
    if (value <= 0) return { amount: 0, afterHp: target.hp, revived: null };
    const original = value;
    if (attack && target.defenseMult !== null) {
      const defenseMult = characterLogic.modifyDefenseMultiplier(
        this,
        target,
        value,
        source,
        reason,
        target.defenseMult,
      );
      value = Math.max(1, floorInt(value * defenseMult));
      const reduced = Math.max(0, original - value);
      this.record.defenseReduced[target.side] = (this.record.defenseReduced[target.side] || 0) + reduced;
      if (hasInscription(target, "white") && target.defenseName === "일반 방어") {
        const extraReduced = Math.min(1, Math.max(0, value - 1));
        value -= extraReduced;
        this.record.defenseReduced[target.side] += extraReduced;
      }
    }
    if (attack) {
      value = characterLogic.absorbAttackDamage(this, target, value, source, reason);
      if (value <= 0) return { amount: 0, afterHp: target.hp, revived: null };
    }
    const before = target.hp;
    target.hp = Math.max(0, target.hp - value);
    const actual = before - target.hp;
    if (attack) this.record.attackDamageTaken[target.side] = (this.record.attackDamageTaken[target.side] || 0) + actual;
    if (actual > 0) characterLogic.onDamageTaken(this, target, actual, attack, source);
    const afterHp = target.hp;
    let revived = null;
    if (target.hp <= 0) {
      revived = characterLogic.consumeDefeatEscape(this, target);
      if (revived == null) this.endBattle(source || this.opponent(target), target);
    }
    return { amount: actual, afterHp, revived };
  }

  heal(fighter, amount, reason) {
    const value = Math.max(0, Math.trunc(amount));
    if (value <= 0) return;
    const before = fighter.hp;
    fighter.hp = Math.min(fighter.maxHp, fighter.hp + value);
    this.logs.push(`${fighter.name} HP 회복 ${before} -> ${fighter.hp} (${reason})`);
  }

  fixedDamage(target, amount, reason, source = null) {
    const opponent = source || this.opponent(target);
    let value = Math.max(0, Math.trunc(amount));
    if (opponent !== target) value = characterLogic.modifyFixedDamageToOpponent(this, opponent, target, value);
    if (value <= 0) return;
    const before = target.hp;
    const result = this.damage(target, value, reason, false, opponent);
    this.logs.push(`${target.name}은 ${reason}로 ${result.amount}의 고정 피해를 입었다. HP ${before} -> ${result.afterHp}`);
    if (result.revived) characterLogic.printDefeatEscape(this, target, result.revived);
    if (!this.gameOver && opponent !== target) characterLogic.onFixedDamageToOpponent(this, opponent, target, value);
    return result.amount;
  }

  restoreMp(fighter, amount, reason) {
    const value = Math.max(0, Math.trunc(amount));
    if (value <= 0) return;
    const before = fighter.mp;
    fighter.mp = Math.min(fighter.maxMp, fighter.mp + value);
    this.logs.push(`${fighter.name} MP ${before} -> ${fighter.mp} (${reason})`);
  }

  reduceMp(fighter, amount, reason) {
    const value = Math.max(0, Math.trunc(amount));
    const before = fighter.mp;
    fighter.mp = Math.max(0, fighter.mp - value);
    const actual = before - fighter.mp;
    if (actual > 0) this.logs.push(`${fighter.name} MP ${before} -> ${fighter.mp} (${reason})`);
    return actual;
  }

  addStatus(fighter, name, turns, stacks = 1, source = "", stack = false, maxStacks = null) {
    if (stacks <= 0) return;
    const current = fighter.statuses[name];
    if (current) {
      current.stackable = current.stackable || stack;
      current.stacks = stack ? current.stacks + stacks : Math.max(current.stacks, stacks);
      if (maxStacks != null) current.stacks = Math.min(current.stacks, maxStacks);
      current.remaining = Math.max(current.remaining, turns);
    } else {
      fighter.statuses[name] = {
        name,
        remaining: Number(turns),
        stacks: maxStacks == null ? Number(stacks) : Math.min(Number(stacks), Number(maxStacks)),
        source,
        stackable: Boolean(stack),
      };
    }
    const status = fighter.statuses[name];
    if (status.stacks === 1 && !status.stackable) {
      this.logs.push(`${fighter.name}에게 ${name} 상태가 ${status.remaining}턴 동안 적용되었다.`);
    } else {
      this.logs.push(`${fighter.name}에게 ${name} ${status.stacks}중첩이 ${status.remaining}턴 동안 적용되었다.`);
    }
  }

  addStatEffect(fighter, stat, multiplier, turns, source) {
    const current = fighter.statEffects.find((effect) => effect.stat === stat && effect.source === source);
    if (current) {
      current.multiplier = Number(multiplier);
      current.remaining = Math.max(current.remaining, Number(turns));
      this.logs.push(`${fighter.name}의 ${stat.toUpperCase()} x${multiplier} 효과가 갱신되었다.`);
      return;
    }
    fighter.statEffects.push({ stat, multiplier: Number(multiplier), remaining: Number(turns), source });
    this.logs.push(`${fighter.name}의 ${stat.toUpperCase()}이 ${turns}턴 동안 x${multiplier}가 된다.`);
  }

  addCostEffect(fighter, multiplier, turns, source) {
    fighter.costEffects.push({ multiplier: Number(multiplier), remaining: Number(turns), source });
    this.logs.push(`${fighter.name}의 액티브 MP 소모량이 ${turns}턴 동안 ${multiplier}배가 된다.`);
  }

  addCounter(fighter, name, amount, maxValue = null) {
    const before = Number(fighter.counters[name] || 0);
    let after = before + Number(amount || 0);
    if (maxValue != null) after = Math.min(Number(maxValue), after);
    fighter.counters[name] = after;
    if (maxValue != null) this.logs.push(`${fighter.name}의 ${name} ${before}/${maxValue} -> ${after}/${maxValue}`);
    else this.logs.push(`${fighter.name}의 ${name} ${before} -> ${after}`);
    return after;
  }

  addVengeance(fighter) {
    const before = Number(fighter.counters["과령"] || 0);
    fighter.counters["과령"] = before + 1;
    this.logs.push(`${fighter.name}의 과령 ${before} -> ${fighter.counters["과령"]}`);
    if (fighter.counters["과령"] >= 6 && Number(fighter.counters["거포 강령"] || 0) <= 0) {
      this.triggerVengeanceOverflow(fighter, "과령 폭주");
    }
  }

  triggerVengeanceOverflow(fighter, reason) {
    const stacks = Number(fighter.counters["과령"] || 0);
    fighter.counters["과령"] = 0;
    this.fixedDamage(fighter, 25, reason);
    this.logs.push(`과령 ${stacks}을 모두 소모했다.`);
  }

  endBattle(winner, loser) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.winner = winner;
    this.loser = loser;
    this.logs.push(`GAME OVER: ${winner.label} 승리`);
  }

  roll() {
    return this.rng.next() * 100;
  }

  estimateActionDamage(actor, target, action, useMax = false) {
    if (!action.isAttack) return 0;
    let hits = 1;
    if (action.description.includes("[연격]")) {
      hits = characterLogic.estimatedHitCount(actor, action, useMax);
      if (hits == null) hits = useMax ? 3 : 2;
    }
    return this.calculateEstimatedDamage(actor, target, action) * Number(hits);
  }

  estimateHitRate(actor, target, action) {
    if (action.accuracy === null) return 100;
    const choice = new Choice(actor, action, this.effectiveCost(actor, action), this.effectivePriority(actor, action));
    let accuracy = this.modifiedAccuracy(choice);
    let evasion = Number(target.evasionChance || 0);
    if (hasInscription(target, "yellow") && target.hp < target.maxHp * 0.3 && action.isAttack) evasion += 10;
    evasion = characterLogic.estimateTargetEvasion(this, target, action, evasion);
    return clamp((accuracy / 100) * (1 - evasion / 100) * 100, 0, 100);
  }

  calculateEstimatedDamage(actor, target, action) {
    const [atk] = this.currentStats(actor);
    let targetDef = this.currentStats(target)[1];
    targetDef = characterLogic.estimatedTargetDefenseForAttack(this, actor, target, action, targetDef);
    let power = characterLogic.estimatedPower(this, actor, target, action, Number(action.power || 0));
    if (hasInscription(actor, "white")) power = Math.max(0, power - whitePowerPenalty(action));
    if (hasInscription(actor, "red")) power += redPowerBonus(action);
    let mult = 1;
    for (const value of characterLogic.estimatedDamageMultipliers(this, actor, target, action)) mult *= Number(value || 1);
    if (target.defenseMult !== null) mult *= target.defenseMult;
    let damage = Math.max(1, floorInt((power * (atk + 50)) / (targetDef + 50) * mult));
    if (hasInscription(actor, "white") && action.isCommonAction("normal_attack")) damage += 1;
    return damage;
  }

  estimateBestIncomingDamage(attacker, defender) {
    const legal = availableActions(attacker).filter((action) => this.isLegalChoice(attacker, action) && action.isAttack);
    return legal.length ? Math.max(...legal.map((action) => this.estimateActionDamage(attacker, defender, action, true))) : 0;
  }
}

function actionFromSkill(number, skill, characterId = null) {
  return new Action({
    number,
    name: skill.name,
    target: skill.target,
    mp: skill.mp,
    power: skill.power,
    accuracy: skill.accuracy,
    priority: skill.priority,
    description: skill.description,
    common: false,
    characterId,
    slot: number - 4,
  });
}

function normalActions() {
  return [
    new Action({ number: 1, name: "일반 공격", target: "상대", mp: 0, power: 10, accuracy: 100, priority: 0, description: "효과 없음.", common: true, kind: "normal_attack" }),
    new Action({ number: 2, name: "일반 방어", target: "자신", mp: 0, power: null, accuracy: null, priority: 3, description: "[방어] 자신이 이 턴에 입는 공격 피해를 경감한다.", common: true, kind: "defense" }),
    new Action({ number: 3, name: "명상", target: "자신", mp: 0, power: null, accuracy: null, priority: 0, description: "자신의 MP를 15 회복한다.", common: true, kind: "meditation" }),
  ];
}

function availableActions(fighter) {
  return [
    ...normalActions(),
    ...(fighter.data.skills || []).map((skill, index) => actionFromSkill(index + 4, skill, fighter.characterId)),
  ];
}

function actionKind(action) {
  if (action.isCommonAction("meditation")) return "명상";
  if (action.isDefense) return "방어";
  if (action.isAttack) return action.isActive ? "액티브 공격" : "공격";
  return action.isActive ? "액티브 비공격" : "비공격";
}

function renderAction(action, cost = null, priority = null) {
  const mp = cost == null ? action.mp : cost;
  const pr = priority == null ? action.priority : priority;
  const power = action.power == null ? "-" : String(action.power);
  const accuracy = action.accuracy == null ? "-" : String(action.accuracy);
  const mpText = cost != null && cost !== action.mp ? `MP ${mp} (기본 ${action.mp})` : `MP ${mp}`;
  const priorityText = priority != null && priority !== action.priority ? `우선도 ${pr} (기본 ${action.priority})` : `우선도 ${pr}`;
  return `[${action.number}] ${action.name}\n${action.target} / ${mpText} / 위력 ${power} / 명중률 ${accuracy} / ${priorityText}\n${action.description}`;
}

function findPersonality(id) {
  const requested = String(id || "R").toUpperCase();
  return AI_PERSONALITIES.find((item) => item.id === requested) || AI_PERSONALITIES[0];
}

function resolvePersonality(value, rng) {
  const requested = String(value || "").trim().toUpperCase();
  if (!requested || requested === "0" || requested === "RANDOM") return rng.choice(AI_PERSONALITIES).id;
  return AI_PERSONALITIES.some((item) => item.id === requested) ? requested : "R";
}

function resolveCharacterIndex(characters, value, rng) {
  if (value == null || value === "" || value === "random" || Number(value) === -1) return rng.range(characters.length);
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index >= characters.length) throw new Error("Character index is out of range.");
  return index;
}

function stateForBattle(battle, actionOwner = battle.player, forceActionsDisabled = false) {
  return {
    started: true,
    turn: battle.turn,
    is_over: battle.gameOver,
    gameOver: battle.gameOver,
    result: gameResultText(battle),
    winner: fighterSummary(battle.winner),
    loser: fighterSummary(battle.loser),
    player: fighterState(battle, battle.player),
    ai: fighterState(battle, battle.ai),
    personality: battle.visiblePersonality(),
    actions: actionStatesForFighter(battle, actionOwner, forceActionsDisabled),
  };
}

function fighterSummary(fighter) {
  if (!fighter) return null;
  return {
    side: fighter.side,
    id: fighter.data.id,
    name: fighter.name,
    title: fighter.title,
    label: fighter.label,
  };
}

function fighterState(battle, fighter, sideOverride = null) {
  const [atk, defense, spd] = battle.currentStats(fighter);
  const stateText = currentStateText(battle, fighter);
  const battleLog = [];
  if (characterLogic.needsBattleLog(fighter)) characterLogic.renderBattleLog(battle, fighter, battleLog);
  return {
    side: sideOverride || fighter.side,
    id: fighter.data.id,
    name: fighter.name,
    title: fighter.title,
    label: fighter.label,
    hp: fighter.hp,
    max_hp: fighter.maxHp,
    maxHp: fighter.maxHp,
    mp: fighter.mp,
    max_mp: fighter.maxMp,
    maxMp: fighter.maxMp,
    inscription: fighter.inscription,
    inscriptionId: fighter.inscriptionId,
    inscriptionName: fighter.inscriptionName,
    atk: roundStat(atk),
    defense: roundStat(defense),
    spd: roundStat(spd),
    stats: { atk: roundStat(atk), def: roundStat(defense), spd: roundStat(spd) },
    baseStats: { hp: fighter.maxHp, atk: fighter.baseAtk, def: fighter.baseDef, spd: fighter.baseSpd },
    status_text: stateText,
    stateText,
    defenseText: `${defenseReductionPercentForStreak(fighter.defenseStreak + 1)}%`,
    battleLog,
    passive: fighter.data.passive,
    uniqueStatuses: fighter.data.unique_statuses || [],
  };
}

function actionStatesForFighter(battle, fighter, forceDisabled = false) {
  return availableActions(fighter).map((action) => {
    const cost = battle.effectiveCost(fighter, action);
    const priority = battle.effectivePriority(fighter, action);
    const disabled = forceDisabled || battle.gameOver || !battle.isLegalChoice(fighter, action);
    const power = action.power == null ? "-" : String(action.power);
    const accuracy = action.accuracy == null ? "-" : String(action.accuracy);
    return {
      number: action.number,
      name: action.name,
      label: `[${action.number}] ${action.name}`,
      target: action.target,
      cost,
      baseCost: action.mp,
      cost_text: String(cost),
      power: action.power,
      accuracy: action.accuracy,
      priority,
      basePriority: action.priority,
      description: `${action.target} / 위력 ${power} / 명중률 ${accuracy} / 우선도 ${priority}\n${action.description}`,
      isAttack: action.isAttack,
      isDefense: action.isDefense,
      disabled,
      available: !disabled,
      display: renderAction(action, cost, priority),
    };
  });
}

function currentStateText(battle, fighter) {
  const parts = [];
  for (const [name, status] of Object.entries(fighter.statuses || {})) {
    parts.push(status.stacks > 1 ? `${name} ${status.stacks}중첩(${status.remaining}턴)` : `${name}(${status.remaining}턴)`);
  }
  for (const [name, value] of Object.entries(fighter.counters || {})) {
    if (!value) continue;
    const formatted = characterLogic.counterStateText(fighter, name, value);
    if (formatted.handled) {
      if (formatted.text) parts.push(formatted.text);
    } else {
      parts.push(`${name}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
    }
  }
  parts.push(...characterLogic.extraStateParts(battle, fighter));
  return parts.length ? parts.join(" / ") : "없음";
}

function gameResultText(battle) {
  if (!battle.gameOver) return null;
  if (!battle.winner) return "무승부";
  return `${battle.winner.label} 승리`;
}

function structuredCloneCompat(value) {
  return globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function cloneFighter(source) {
  const fighter = Object.create(Fighter.prototype);
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value instanceof Set) fighter[key] = new Set(value);
    else if (key === "data" || key === "inscription" || key === "statuses" || key === "statEffects" || key === "costEffects" || key === "counters") {
      fighter[key] = structuredCloneCompat(value);
    } else if (Array.isArray(value)) fighter[key] = structuredCloneCompat(value);
    else fighter[key] = value;
  }
  return fighter;
}

function cloneTurnRecord(source) {
  const record = Object.create(TurnRecord.prototype);
  for (const [key, value] of Object.entries(source)) record[key] = structuredCloneCompat(value);
  return record;
}

function titleCase(value) {
  return String(value).replace(/(^|[-_ ])(\w)/g, (_, prefix, char) => `${prefix}${char.toUpperCase()}`);
}

module.exports = {
  MAX_MP,
  START_MP,
  DEFAULT_INSCRIPTION_ID,
  RANDOM_INSCRIPTION_ID,
  AI_PERSONALITIES,
  AI_SEARCH_TUNING,
  Battle,
  Fighter,
  Action,
  Choice,
  Mulberry32,
  availableActions,
  actionFromSkill,
  normalActions,
  renderAction,
  resolveCharacterIndex,
  resolvePersonality,
  resolveInscriptionId,
  randomInscriptionId,
  normalizeInscriptions,
  stateForBattle,
  fighterState,
  fighterSummary,
  actionStatesForFighter,
};
