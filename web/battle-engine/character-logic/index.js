"use strict";

const monsterLogic = require("../monster-logic");
const EMPTY_LOGIC = Object.freeze({});
const LOGICS = Object.assign(Object.create(null), {
  toxiche: require("./toxiche"),
  cryne: require("./cryne"),
  plote: require("./plote"),
  ashend: require("./ashend"),
  karossy: require("./karossy"),
  nihfle: require("./nihfle"),
  serpen: require("./serpen"),
  melague: require("./melague"),
  balef: require("./balef"),
  revesha: require("./revesha"),
  gandrick: require("./gandrick"),
  charinel: require("./charinel"),
  dethus: require("./dethus"),
  zeroven: require("./zeroven"),
  neroko: require("./neroko"),
  happyrin: require("./happyrin"),
  librang: require("./librang"),
  dracle: require("./dracle"),
  saqua: require("./saqua"),
  queenas: require("./queenas"),
  jitrom: require("./jitrom"),
  fimit: require("./fimit"),
  emento: require("./emento"),
});

function registeredLogicFor(id) {
  return id ? LOGICS[id] || monsterLogic.logicFor(id) : null;
}

function logicFor(fighterOrId) {
  const id = typeof fighterOrId === "string" ? fighterOrId : fighterOrId?.characterId;
  return registeredLogicFor(id) || EMPTY_LOGIC;
}

function call(fighter, name, args = [], fallback = undefined) {
  const fn = logicFor(fighter)[name];
  return typeof fn === "function" ? fn(...args) : fallback;
}

function callFirst(fighter, names, args = [], fallback = undefined) {
  const logic = logicFor(fighter);
  for (const name of names) {
    if (typeof logic[name] === "function") return logic[name](...args);
  }
  return fallback;
}

function callById(id, name, args = [], fallback = undefined) {
  const fn = logicFor(id)[name];
  return typeof fn === "function" ? fn(...args) : fallback;
}

function callFirstById(id, names, args = [], fallback = undefined) {
  const logic = logicFor(id);
  for (const name of names) {
    if (typeof logic[name] === "function") return logic[name](...args);
  }
  return fallback;
}

function activeCharacterIdFor(battle, fighter) {
  const id = call(fighter, "activeCharacterId", [battle, fighter], null);
  return id || fighter?.characterId || null;
}

function actionLogicId(battle, fighter, action) {
  if (action?.isActive && action.characterId) return action.characterId;
  return activeCharacterIdFor(battle, fighter);
}

function fighterLogicIds(battle, fighter) {
  const ids = [];
  const own = fighter?.characterId || null;
  if (own) ids.push(own);
  const active = activeCharacterIdFor(battle, fighter);
  if (active && active !== own) ids.push(active);
  return ids;
}

function borrowedEffectIds(battle, fighter) {
  const current = new Set(fighterLogicIds(battle, fighter));
  const ids = Array.isArray(fighter?.counters?.["변신 효과 처리 대상"])
    ? fighter.counters["변신 효과 처리 대상"]
    : [];
  return [...new Set(ids.filter((id) => id && !current.has(id) && registeredLogicFor(id)))];
}

function callBorrowedEffect(id, name, args = [], fallback = undefined) {
  const fn = logicFor(id).borrowedEffects?.[name];
  return typeof fn === "function" ? fn(...args) : fallback;
}

function cloneStateValue(value) {
  if (value === undefined || value === null || typeof value !== "object") return value;
  return globalThis.structuredClone
    ? globalThis.structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function sameStateValue(left, right) {
  if (Object.is(left, right)) return true;
  if (left === undefined || right === undefined) return false;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

function callActionLogic(battle, fighter, action, name, args = [], fallback = undefined) {
  return callById(actionLogicId(battle, fighter, action), name, args, fallback);
}

const hooks = {
  register(id, logic) {
    if (id) LOGICS[id] = logic || EMPTY_LOGIC;
  },
  logicFor,
  activeCharacterId(battle, fighter) {
    return activeCharacterIdFor(battle, fighter);
  },
  adjustInitialStats(fighter) {
    call(fighter, "adjustInitialStats", [fighter]);
  },
  initUniqueState(fighter, uniqueNames) {
    call(fighter, "initUniqueState", [fighter, uniqueNames]);
  },
  initializeBorrowedState(battle, fighter, characterId) {
    const data = battle?.characterDataById?.(characterId);
    if (!data) return null;
    const before = Object.fromEntries(
      Object.entries(fighter.counters || {}).map(([name, value]) => [name, cloneStateValue(value)]),
    );
    const beforeKeys = new Set(Object.keys(fighter.counters || {}));
    callById(
      characterId,
      "initUniqueState",
      [fighter, new Set((data.unique_statuses || []).map((item) => item.name))],
    );
    const counters = {};
    for (const [name, value] of Object.entries(fighter.counters || {})) {
      if (!beforeKeys.has(name) || !sameStateValue(before[name], value)) {
        counters[name] = {
          existed: beforeKeys.has(name),
          value: cloneStateValue(before[name]),
        };
      }
    }
    return { characterId, counters };
  },
  clearBorrowedState(fighter, state) {
    if (!state || typeof state !== "object") return;
    for (const [name, snapshot] of Object.entries(state.counters || {})) {
      if (snapshot?.existed) fighter.counters[name] = cloneStateValue(snapshot.value);
      else delete fighter.counters[name];
    }
    callById(state.characterId, "onBorrowedStateCleared", [fighter]);
  },
  counterStateText(battle, fighter, name, value) {
    if (name === "고요한 밤") return { handled: true, text: null };
    const ids = [...fighterLogicIds(battle, fighter), ...borrowedEffectIds(battle, fighter)];
    for (const id of ids) {
      const logic = logicFor(id);
      if (logic.hiddenCounters?.includes?.(name) || logic.HIDDEN_COUNTERS?.has?.(name)) {
        return { handled: true, text: null };
      }
      const formatter = fighterLogicIds(battle, fighter).includes(id)
        ? logic.counterStateText
        : logic.borrowedEffects?.counterStateText;
      if (typeof formatter !== "function") continue;
      const text = formatter(fighter, name, value);
      if (text !== null && text !== undefined) return { handled: true, text };
    }
    return { handled: false, text: null };
  },
  extraStateParts(battle, fighter) {
    const parts = [];
    for (const id of fighterLogicIds(battle, fighter)) {
      parts.push(...(callById(id, "extraStateParts", [battle, fighter], []) || []));
    }
    for (const id of borrowedEffectIds(battle, fighter)) {
      parts.push(...(callBorrowedEffect(id, "extraStateParts", [battle, fighter], []) || []));
    }
    if (Number(fighter.counters["고요한 밤"] || 0) > 0) parts.push("고요한 밤");
    return parts;
  },
  resetTurnFlags(battle, fighter) {
    call("emento", "resetForgetStatus", [battle, fighter]);
    for (const id of fighterLogicIds(battle, fighter)) callById(id, "resetTurnFlags", [battle, fighter]);
    for (const id of borrowedEffectIds(battle, fighter)) callBorrowedEffect(id, "resetTurnFlags", [battle, fighter]);
  },
  needsBattleLog(battle, fighter) {
    return fighterLogicIds(battle, fighter).some((id) => Boolean(callById(id, "needsBattleLog", [fighter], false)));
  },
  renderBattleLog(battle, fighter, lines) {
    for (const id of fighterLogicIds(battle, fighter)) callById(id, "renderBattleLog", [battle, fighter, lines]);
  },
  counterResourceValue(battle, fighter, name, raw) {
    for (const id of fighterLogicIds(battle, fighter)) {
      const value = callById(id, "counterResourceValue", [fighter, name, raw], null);
      if (value !== null && value !== undefined) return value;
    }
    return null;
  },
  defenseScoreBonusReduction(battle, actor, action) {
    return Number(callActionLogic(battle, actor, action, "defenseScoreBonusReduction", [actor, action], 0) || 0);
  },
  setupValue(battle, actor, target, action) {
    return Number(callActionLogic(battle, actor, action, "setupValue", [battle, actor, target, action], 0) || 0);
  },
  onMakeChoice(battle, fighter, action, choice) {
    callActionLogic(battle, fighter, action, "onMakeChoice", [battle, fighter, action, choice]);
  },
  isLegalChoice(battle, fighter, action) {
    if (call("emento", "isLegalChoiceStatus", [battle, fighter, action], null) === false) return false;
    return callActionLogic(battle, fighter, action, "isLegalChoice", [battle, fighter, action], null);
  },
  modifyCost(battle, fighter, action, cost) {
    return Number(callActionLogic(battle, fighter, action, "modifyCost", [battle, fighter, action, cost], cost));
  },
  modifyPriority(battle, fighter, action, priority) {
    let value = Number(callActionLogic(battle, fighter, action, "modifyPriority", [battle, fighter, action, priority], priority));
    for (const id of borrowedEffectIds(battle, fighter)) {
      value = Number(callBorrowedEffect(id, "modifyPriority", [battle, fighter, action, value], value));
    }
    return value;
  },
  onActionStartBeforeCommon(battle, choice) {
    return Boolean(call("serpen", "onActionStartBeforeCommon", [battle, choice], false));
  },
  onActionStartAfterParalysis(battle, choice) {
    return Boolean(call("nihfle", "onActionStartAfterParalysis", [battle, choice], false));
  },
  onActionStartAfterCommon(battle, choice) {
    if (call("plote", "onActionStartStatus", [battle, choice], false)) return true;
    if (call("happyrin", "onActionStartStatus", [battle, choice], false)) return true;
    if (callActionLogic(battle, choice.actor, choice.action, "onActionStart", [battle, choice], false)) return true;
    for (const id of borrowedEffectIds(battle, choice.actor)) {
      if (callBorrowedEffect(id, "onActionStart", [battle, choice], false)) return true;
    }
    return false;
  },
  onActiveMpSpent(battle, actor, action) {
    callActionLogic(battle, actor, action, "onActiveMpSpent", [battle, actor]);
  },
  modifyAccuracy(battle, choice, target, accuracy) {
    let value = Number(call("ashend", "modifyAccuracyStatus", [battle, choice, target, accuracy], accuracy));
    const actorId = actionLogicId(battle, choice.actor, choice.action);
    value = Number(callById(actorId, "modifyAccuracyActorBeforeTarget", [battle, choice, target, value], value));
    for (const id of fighterLogicIds(battle, target)) {
      value = Number(callById(id, "modifyAccuracyTarget", [battle, choice, target, value], value));
    }
    value = Number(callById(actorId, "modifyAccuracyActorAfterTarget", [battle, choice, target, value], value));
    value = Number(callById(actorId, "modifyAccuracy", [battle, choice, target, value], value));
    return value;
  },
  targetEvasion(battle, target, choice, evasion) {
    let value = evasion;
    for (const id of fighterLogicIds(battle, target)) {
      value = Number(callById(id, "targetEvasion", [battle, target, choice, value], value));
    }
    for (const id of borrowedEffectIds(battle, target)) {
      value = Number(callBorrowedEffect(id, "targetEvasion", [battle, target, choice, value], value));
    }
    return value;
  },
  estimateTargetEvasion(battle, target, action, evasion) {
    let value = evasion;
    for (const id of fighterLogicIds(battle, target)) {
      value = Number(callById(id, "estimateTargetEvasion", [battle, target, action, value], value));
    }
    return value;
  },
  applyConditionEffects(battle, choice) {
    return callActionLogic(battle, choice.actor, choice.action, "applyConditionEffects", [battle, choice], true) !== false;
  },
  consumeForcedConditionFailure(battle, choice) {
    return Boolean(call("emento", "consumeForcedConditionFailure", [battle, choice], false));
  },
  modifyAttackPower(battle, choice, power) {
    return Number(callActionLogic(battle, choice.actor, choice.action, "modifyAttackPower", [battle, choice, power], power));
  },
  modifyAttackDamage(battle, choice, target, damage) {
    let value = Number(callActionLogic(battle, choice.actor, choice.action, "modifyAttackDamageAsActor", [battle, choice, target, damage], damage));
    for (const id of fighterLogicIds(battle, target)) {
      value = Number(callFirstById(id, ["modifyAttackDamageAsTarget", "modifyAttackDamage"], [battle, choice, target, value], value));
    }
    for (const id of borrowedEffectIds(battle, target)) {
      value = Number(callBorrowedEffect(id, "modifyAttackDamageAsTarget", [battle, choice, target, value], value));
    }
    return value;
  },
  modifyDefenseMultiplier(battle, target, amount, source, reason, multiplier) {
    let value = Number(callById(activeCharacterIdFor(battle, source), "modifyDefenseMultiplierAsActor", [battle, target, amount, source, reason, multiplier], multiplier));
    for (const id of fighterLogicIds(battle, target)) {
      value = Number(callById(id, "modifyDefenseMultiplier", [battle, target, amount, source, reason, value], value));
    }
    return value;
  },
  targetDefenseForAttack(battle, choice, target, defense) {
    let value = defense;
    for (const id of fighterLogicIds(battle, target)) {
      value = Number(callById(id, "targetDefenseForAttack", [battle, choice, target, value], value));
    }
    return value;
  },
  estimatedTargetDefenseForAttack(battle, actor, target, action, defense) {
    let value = defense;
    for (const id of fighterLogicIds(battle, target)) {
      value = Number(callById(id, "estimatedTargetDefenseForAttack", [battle, actor, target, action, value], value));
    }
    return value;
  },
  attackDamageMultipliers(battle, choice) {
    const target = battle.opponent(choice.actor);
    return [
      ...(callActionLogic(battle, choice.actor, choice.action, "attackDamageMultipliers", [battle, choice], []) || []),
      ...borrowedEffectIds(battle, choice.actor).flatMap((id) => callBorrowedEffect(id, "attackDamageMultipliers", [battle, choice], []) || []),
      ...fighterLogicIds(battle, target).flatMap((id) => callById(id, "targetDamageMultipliers", [battle, choice, target], []) || []),
      ...borrowedEffectIds(battle, target).flatMap((id) => callBorrowedEffect(id, "targetDamageMultipliers", [battle, choice, target], []) || []),
    ];
  },
  onHitPreDefense(battle, choice, totalDamage) {
    callActionLogic(battle, choice.actor, choice.action, "onHitPreDefenseAsActor", [battle, choice, totalDamage]);
    if (!battle.gameOver) {
      for (const id of fighterLogicIds(battle, battle.opponent(choice.actor))) {
        callById(id, "onHitPreDefenseAsTarget", [battle, choice, totalDamage]);
      }
    }
  },
  onHitAfterDefense(battle, choice, totalDamage) {
    callFirstById(actionLogicId(battle, choice.actor, choice.action), ["onHitAfterDefenseAsActor", "onHitAfterDefense"], [battle, choice, totalDamage]);
  },
  onDefenseHit(battle, choice, totalDamage) {
    for (const id of fighterLogicIds(battle, battle.opponent(choice.actor))) {
      callById(id, "onDefenseHit", [battle, choice, totalDamage]);
    }
  },
  applyNonAttackEffects(battle, choice) {
    return callActionLogic(battle, choice.actor, choice.action, "applyNonAttackEffects", [battle, choice], false) === true;
  },
  onMeditationEffect(battle, choice) {
    callActionLogic(battle, choice.actor, choice.action, "onMeditationEffect", [battle, choice]);
  },
  finishAction(battle, choice, success, hit, missNotFailure) {
    callActionLogic(battle, choice.actor, choice.action, "finishAction", [battle, choice, success, hit, missNotFailure]);
  },
  turnEndMpBonus(battle, fighter) {
    let value = 0;
    for (const id of fighterLogicIds(battle, fighter)) {
      value += Number(callById(id, "turnEndMpBonus", [fighter], 0) || 0);
    }
    return value;
  },
  applyPreMpTurnEnd(battle, fighter) {
    call("dethus", "preMpTurnEnd", [battle, fighter]);
  },
  applyOtherTurnEnd(battle, fighter) {
    call("melague", "preCharacterTurnEnd", [battle, fighter]);
    if (!battle.gameOver) {
      for (const id of fighterLogicIds(battle, fighter)) {
        callById(id, "onTurnEnd", [battle, fighter]);
        if (battle.gameOver) break;
      }
      if (!battle.gameOver) {
        for (const id of borrowedEffectIds(battle, fighter)) {
          callBorrowedEffect(id, "onTurnEnd", [battle, fighter]);
          if (battle.gameOver) break;
        }
      }
    }
  },
  afterActionPhase(battle) {
    for (const fighter of [battle.player, battle.ai]) {
      for (const id of fighterLogicIds(battle, fighter)) {
        callById(id, "afterActionPhase", [battle, fighter]);
        if (battle.gameOver) break;
      }
      if (battle.gameOver) break;
    }
  },
  decrementCounters(battle, fighter) {
    if (Number(fighter.counters["고요한 밤"] || 0) > 0) fighter.counters["고요한 밤"] -= 1;
    const currentIds = fighterLogicIds(battle, fighter);
    const borrowedIds = borrowedEffectIds(battle, fighter);
    const ownId = fighter?.characterId;
    for (const id of currentIds.filter((item) => item !== ownId)) {
      callById(id, "decrementCounters", [fighter, battle]);
    }
    for (const id of borrowedIds) callBorrowedEffect(id, "decrementCounters", [fighter, battle]);
    if (ownId && currentIds.includes(ownId)) callById(ownId, "decrementCounters", [fighter, battle]);
  },
  modifyStats(battle, fighter, atk, defense, spd) {
    let values = [atk, defense, spd];
    for (const id of fighterLogicIds(battle, fighter)) {
      values = callById(id, "modifyStats", [battle, fighter, values[0], values[1], values[2]], values) || values;
    }
    for (const id of borrowedEffectIds(battle, fighter)) {
      values = callBorrowedEffect(id, "modifyStats", [battle, fighter, values[0], values[1], values[2]], values) || values;
    }
    return values;
  },
  onFixedDamageToOpponent(battle, actor, target, amount) {
    callById(activeCharacterIdFor(battle, actor), "onFixedDamageToOpponent", [battle, actor, target, amount]);
  },
  modifyFixedDamageToOpponent(battle, actor, target, amount) {
    return Number(callById(activeCharacterIdFor(battle, actor), "modifyFixedDamageToOpponent", [battle, actor, target, amount], amount));
  },
  absorbAttackDamage(battle, target, amount, source, reason) {
    let value = amount;
    for (const id of fighterLogicIds(battle, target)) {
      value = Number(callById(id, "absorbAttackDamage", [battle, target, value, source, reason], value));
    }
    return value;
  },
  consumeDefeatEscape(battle, fighter) {
    for (const id of fighterLogicIds(battle, fighter)) {
      const result = callById(id, "consumeDefeatEscape", [battle, fighter], null);
      if (result) return result;
    }
    return null;
  },
  printDefeatEscape(battle, fighter, revive) {
    for (const id of fighterLogicIds(battle, fighter)) callById(id, "printDefeatEscape", [battle, fighter, revive]);
  },
  onDamageTaken(battle, target, amount, attack, source) {
    for (const id of fighterLogicIds(battle, target)) callById(id, "onDamageTaken", [battle, target, amount, attack, source]);
  },
  estimatedHitCount(actor, action, useMax) {
    return callById(action.characterId || actor.characterId, "estimatedHitCount", [actor, action, useMax], null);
  },
  estimatedPower(battle, actor, target, action, power) {
    return Number(callActionLogic(battle, actor, action, "estimatedPower", [battle, actor, target, action, power], power));
  },
  estimatedDamageMultipliers(battle, actor, target, action) {
    return [
      ...(callActionLogic(battle, actor, action, "estimatedDamageMultipliers", [battle, actor, target, action], []) || []),
      ...borrowedEffectIds(battle, actor).flatMap((id) => callBorrowedEffect(
        id,
        "estimatedDamageMultipliers",
        [battle, actor, target, action],
        [],
      ) || []),
    ];
  },
  wouldConditionFail(battle, actor, target, action) {
    return Boolean(
      call("emento", "wouldConditionFailStatus", [battle, actor, target, action], false)
      || callActionLogic(battle, actor, action, "wouldConditionFail", [battle, actor, target, action], false),
    );
  },
  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    return Number(callActionLogic(battle, actor, action, "aiScore", [battle, actor, target, action, expectedDamage, hitRate], 0) || 0);
  },
};

module.exports = hooks;
