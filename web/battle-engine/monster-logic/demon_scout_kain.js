"use strict";

const CHARACTER_ID = "demon_scout_kain";
const HIDE_REMAINING = "흑에 숨다 지속";

function remaining(fighter) {
  return Math.max(0, Number(fighter.counters[HIDE_REMAINING] || 0));
}

function counterStateText(_fighter, name, value) {
  return name === HIDE_REMAINING ? `회피율 +5%p(${Number(value)}턴)` : null;
}

function resetTurnFlags(_battle, fighter) {
  if (remaining(fighter) > 0) fighter.evasionChance += 5;
}

function decrementCounters(fighter) {
  const value = remaining(fighter);
  if (value <= 1) delete fighter.counters[HIDE_REMAINING];
  else fighter.counters[HIDE_REMAINING] = value - 1;
}

module.exports = {
  counterStateText,
  resetTurnFlags,

  attackDamageMultipliers(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 0)) return [];
    const target = battle.opponent(choice.actor);
    return battle.kindIsAttack(battle.record.selectedKind[target.side]) ? [] : [1.5];
  },

  estimatedDamageMultipliers(_battle, _actor, _target, action) {
    return action.isSkill(CHARACTER_ID, 0) ? [1.2] : [];
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    choice.actor.evasionChance += 5;
    choice.actor.counters[HIDE_REMAINING] = 4;
    battle.logs.push(`${choice.actor.name}의 회피율이 4턴 동안 5%p 증가한다.`);
    return true;
  },

  decrementCounters,
};

module.exports.borrowedEffects = {
  counterStateText,
  resetTurnFlags,
  decrementCounters,
};
