"use strict";

const fs = require("node:fs");
const path = require("node:path");

const EMPTY_LOGIC = Object.freeze({});
const LOGICS = Object.create(null);
const CHARACTER_IDS = [
  "toxiche", "cryne", "plote", "ashend", "karossy", "nihfle", "serpen",
  "melague", "balef", "revesha", "gandrick", "charinel", "dethus",
  "zeroven", "neroko", "happyrin", "librang", "dracle", "saqua",
  "queenas", "jitrom",
];

for (const id of CHARACTER_IDS) {
  const modulePath = path.join(__dirname, `${id}.js`);
  if (fs.existsSync(modulePath)) LOGICS[id] = require(modulePath);
}

function logicFor(fighterOrId) {
  const id = typeof fighterOrId === "string" ? fighterOrId : fighterOrId?.characterId;
  return id ? LOGICS[id] || EMPTY_LOGIC : EMPTY_LOGIC;
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

const hooks = {
  register(id, logic) {
    if (id) LOGICS[id] = logic || EMPTY_LOGIC;
  },
  logicFor,
  adjustInitialStats(fighter) {
    call(fighter, "adjustInitialStats", [fighter]);
  },
  initUniqueState(fighter, uniqueNames) {
    call(fighter, "initUniqueState", [fighter, uniqueNames]);
  },
  counterStateText(fighter, name, value) {
    if (name === "고요한 밤") return { handled: true, text: null };
    const logic = logicFor(fighter);
    if (logic.hiddenCounters?.includes?.(name) || logic.HIDDEN_COUNTERS?.has?.(name)) {
      return { handled: true, text: null };
    }
    if (typeof logic.counterStateText !== "function") return { handled: false, text: null };
    const text = logic.counterStateText(fighter, name, value);
    return { handled: text !== null && text !== undefined, text };
  },
  extraStateParts(battle, fighter) {
    const parts = [...(call(fighter, "extraStateParts", [battle, fighter], []) || [])];
    if (Number(fighter.counters["고요한 밤"] || 0) > 0) parts.push("고요한 밤");
    return parts;
  },
  resetTurnFlags(battle, fighter) {
    call(fighter, "resetTurnFlags", [battle, fighter]);
  },
  needsBattleLog(fighter) {
    return Boolean(call(fighter, "needsBattleLog", [fighter], false));
  },
  renderBattleLog(battle, fighter, lines) {
    call(fighter, "renderBattleLog", [battle, fighter, lines]);
  },
  counterResourceValue(fighter, name, raw) {
    return call(fighter, "counterResourceValue", [fighter, name, raw], null);
  },
  defenseScoreBonusReduction(actor, action) {
    return Number(call(actor, "defenseScoreBonusReduction", [actor, action], 0) || 0);
  },
  setupValue(battle, actor, target, action) {
    return Number(call(actor, "setupValue", [battle, actor, target, action], 0) || 0);
  },
  onMakeChoice(battle, fighter, action, choice) {
    call(fighter, "onMakeChoice", [battle, fighter, action, choice]);
  },
  isLegalChoice(battle, fighter, action) {
    return call(fighter, "isLegalChoice", [battle, fighter, action], null);
  },
  modifyCost(battle, fighter, action, cost) {
    return Number(call(fighter, "modifyCost", [battle, fighter, action, cost], cost));
  },
  modifyPriority(battle, fighter, action, priority) {
    return Number(call(fighter, "modifyPriority", [battle, fighter, action, priority], priority));
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
    return Boolean(call(choice.actor, "onActionStart", [battle, choice], false));
  },
  onActiveMpSpent(battle, actor) {
    call(actor, "onActiveMpSpent", [battle, actor]);
  },
  modifyAccuracy(battle, choice, target, accuracy) {
    let value = Number(call("ashend", "modifyAccuracyStatus", [battle, choice, target, accuracy], accuracy));
    value = Number(call(choice.actor, "modifyAccuracyActorBeforeTarget", [battle, choice, target, value], value));
    value = Number(call(target, "modifyAccuracyTarget", [battle, choice, target, value], value));
    value = Number(call(choice.actor, "modifyAccuracyActorAfterTarget", [battle, choice, target, value], value));
    value = Number(call(choice.actor, "modifyAccuracy", [battle, choice, target, value], value));
    return value;
  },
  targetEvasion(battle, target, choice, evasion) {
    return Number(call(target, "targetEvasion", [battle, target, choice, evasion], evasion));
  },
  estimateTargetEvasion(battle, target, action, evasion) {
    return Number(call(target, "estimateTargetEvasion", [battle, target, action, evasion], evasion));
  },
  applyConditionEffects(battle, choice) {
    return call(choice.actor, "applyConditionEffects", [battle, choice], true) !== false;
  },
  modifyAttackPower(battle, choice, power) {
    return Number(call(choice.actor, "modifyAttackPower", [battle, choice, power], power));
  },
  modifyAttackDamage(battle, choice, target, damage) {
    let value = Number(call(choice.actor, "modifyAttackDamageAsActor", [battle, choice, target, damage], damage));
    value = Number(callFirst(target, ["modifyAttackDamageAsTarget", "modifyAttackDamage"], [battle, choice, target, value], value));
    return value;
  },
  modifyDefenseMultiplier(battle, target, amount, source, reason, multiplier) {
    let value = Number(call(source, "modifyDefenseMultiplierAsActor", [battle, target, amount, source, reason, multiplier], multiplier));
    value = Number(call(target, "modifyDefenseMultiplier", [battle, target, amount, source, reason, value], value));
    return value;
  },
  targetDefenseForAttack(battle, choice, target, defense) {
    return Number(call(target, "targetDefenseForAttack", [battle, choice, target, defense], defense));
  },
  estimatedTargetDefenseForAttack(battle, actor, target, action, defense) {
    return Number(call(target, "estimatedTargetDefenseForAttack", [battle, actor, target, action, defense], defense));
  },
  attackDamageMultipliers(battle, choice) {
    const target = battle.opponent(choice.actor);
    return [
      ...(call(choice.actor, "attackDamageMultipliers", [battle, choice], []) || []),
      ...(call(target, "targetDamageMultipliers", [battle, choice, target], []) || []),
    ];
  },
  onHitPreDefense(battle, choice, totalDamage) {
    call(choice.actor, "onHitPreDefenseAsActor", [battle, choice, totalDamage]);
    if (!battle.gameOver) call(battle.opponent(choice.actor), "onHitPreDefenseAsTarget", [battle, choice, totalDamage]);
  },
  onHitAfterDefense(battle, choice, totalDamage) {
    callFirst(choice.actor, ["onHitAfterDefenseAsActor", "onHitAfterDefense"], [battle, choice, totalDamage]);
  },
  onDefenseHit(battle, choice, totalDamage) {
    call(battle.opponent(choice.actor), "onDefenseHit", [battle, choice, totalDamage]);
  },
  applyNonAttackEffects(battle, choice) {
    return call(choice.actor, "applyNonAttackEffects", [battle, choice], false) === true;
  },
  onMeditationEffect(battle, choice) {
    call(choice.actor, "onMeditationEffect", [battle, choice]);
  },
  finishAction(battle, choice, success, hit, missNotFailure) {
    call(choice.actor, "finishAction", [battle, choice, success, hit, missNotFailure]);
  },
  turnEndMpBonus(fighter) {
    return Number(call(fighter, "turnEndMpBonus", [fighter], 0) || 0);
  },
  applyPreMpTurnEnd(battle, fighter) {
    call("dethus", "preMpTurnEnd", [battle, fighter]);
  },
  applyOtherTurnEnd(battle, fighter) {
    call("melague", "preCharacterTurnEnd", [battle, fighter]);
    if (!battle.gameOver) call(fighter, "onTurnEnd", [battle, fighter]);
  },
  afterActionPhase(battle) {
    for (const fighter of [battle.player, battle.ai]) {
      call(fighter, "afterActionPhase", [battle, fighter]);
      if (battle.gameOver) break;
    }
  },
  decrementCounters(fighter) {
    if (Number(fighter.counters["고요한 밤"] || 0) > 0) fighter.counters["고요한 밤"] -= 1;
    call(fighter, "decrementCounters", [fighter]);
  },
  modifyStats(battle, fighter, atk, defense, spd) {
    return call(fighter, "modifyStats", [battle, fighter, atk, defense, spd], [atk, defense, spd]);
  },
  onFixedDamageToOpponent(battle, actor, target, amount) {
    call(actor, "onFixedDamageToOpponent", [battle, actor, target, amount]);
  },
  modifyFixedDamageToOpponent(battle, actor, target, amount) {
    return Number(call(actor, "modifyFixedDamageToOpponent", [battle, actor, target, amount], amount));
  },
  absorbAttackDamage(battle, target, amount, source, reason) {
    return Number(call(target, "absorbAttackDamage", [battle, target, amount, source, reason], amount));
  },
  consumeDefeatEscape(battle, fighter) {
    return call(fighter, "consumeDefeatEscape", [battle, fighter], null);
  },
  printDefeatEscape(battle, fighter, revive) {
    call(fighter, "printDefeatEscape", [battle, fighter, revive]);
  },
  onDamageTaken(battle, target, amount, attack, source) {
    call(target, "onDamageTaken", [battle, target, amount, attack, source]);
  },
  estimatedHitCount(actor, action, useMax) {
    return call(actor, "estimatedHitCount", [actor, action, useMax], null);
  },
  estimatedPower(battle, actor, target, action, power) {
    return Number(call(actor, "estimatedPower", [battle, actor, target, action, power], power));
  },
  estimatedDamageMultipliers(battle, actor, target, action) {
    return [...(call(actor, "estimatedDamageMultipliers", [battle, actor, target, action], []) || [])];
  },
  wouldConditionFail(battle, actor, target, action) {
    return Boolean(call(actor, "wouldConditionFail", [battle, actor, target, action], false));
  },
  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    return Number(call(actor, "aiScore", [battle, actor, target, action, expectedDamage, hitRate], 0) || 0);
  },
};

module.exports = hooks;
