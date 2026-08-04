"use strict";

const CHARACTER_ID = "necoulomb";
const NEGATIVE = "음전";
const MAX_NEGATIVE = 30;
const BASE_MP_RECOVERY_ZERO = "기본 MP 회복 0";
const BASE_MP_RECOVERY_ZERO_TURNS = 3;

function floorInt(value) {
  return Math.floor(Number(value) || 0);
}

function negativeStacks(fighter) {
  return Math.max(0, Math.min(MAX_NEGATIVE, Number(fighter.counters[NEGATIVE] || 0)));
}

function projectedStateAfterCost(battle, actor, action) {
  const cost = Math.max(0, Number(battle.effectiveCost(actor, action) || 0));
  const shortfall = Math.max(0, cost - Number(actor.mp || 0));
  return {
    cost,
    mp: Math.max(0, Number(actor.mp || 0) - cost),
    negative: negativeStacks(actor) + shortfall,
    shortfall,
  };
}

function remainingEffect(fighter, source, stat, multiplier) {
  const effect = fighter.statEffects.find((item) => (
    item.source === source
    && item.stat === stat
    && Number(item.multiplier) === Number(multiplier)
  ));
  return Number(effect?.remaining || 0);
}

function minimumRemainingEffect(fighter, source, stats, multiplier) {
  return Math.min(...stats.map((stat) => remainingEffect(fighter, source, stat, multiplier)));
}

function rawDamage(expectedDamage, hitRate) {
  return hitRate > 0 ? expectedDamage / hitRate : 0;
}

module.exports = {
  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has(NEGATIVE)) fighter.counters[NEGATIVE] = 0;
  },

  counterStateText(_fighter, name, value) {
    if (name === NEGATIVE) {
      const stacks = Math.max(0, Number(value || 0));
      return `${NEGATIVE} ${stacks}/${MAX_NEGATIVE}`;
    }
    if (name === BASE_MP_RECOVERY_ZERO && Number(value || 0) > 0) return `${BASE_MP_RECOVERY_ZERO} · ${Number(value)}턴`;
    return null;
  },

  isLegalChoice(battle, fighter, action) {
    if (fighter.characterId !== CHARACTER_ID || !action.isActive) return null;
    return projectedStateAfterCost(battle, fighter, action).negative <= MAX_NEGATIVE;
  },

  payActionMpCost(battle, choice) {
    const actor = choice.actor;
    if (actor.characterId !== CHARACTER_ID || !choice.action.isActive) return null;
    const cost = Math.max(0, Number(choice.totalCost || 0));
    if (actor.mp >= cost) return null;
    const shortfall = cost - actor.mp;
    const beforeNegative = negativeStacks(actor);
    if (beforeNegative + shortfall > MAX_NEGATIVE) return false;
    const beforeMp = actor.mp;
    actor.mp = 0;
    if (cost > 0) battle.logs.push(`${actor.name} MP ${beforeMp} -> 0`);
    battle.addCounter(actor, NEGATIVE, shortfall, MAX_NEGATIVE);
    return true;
  },

  applyTurnEndMpRecovery(battle, fighter, amount) {
    if (fighter.characterId !== CHARACTER_ID) return amount;
    const value = Math.max(0, floorInt(amount));
    const before = negativeStacks(fighter);
    const repaid = Math.min(before, value);
    if (repaid <= 0) return value;
    fighter.counters[NEGATIVE] = before - repaid;
    battle.logs.push(`${fighter.name}의 ${NEGATIVE} ${before}/${MAX_NEGATIVE} -> ${fighter.counters[NEGATIVE]}/${MAX_NEGATIVE} (기본 MP 회복)`);
    return value - repaid;
  },

  modifyTurnEndMpRecovery(_battle, fighter, amount) {
    return Number(fighter.counters[BASE_MP_RECOVERY_ZERO] || 0) > 0 ? 0 : amount;
  },

  onActionStart(battle, choice) {
    const { actor, action } = choice;
    if (!action.isSkill(CHARACTER_ID, 3)) return;
    const before = Number(actor.counters[BASE_MP_RECOVERY_ZERO] || 0);
    actor.counters[BASE_MP_RECOVERY_ZERO] = BASE_MP_RECOVERY_ZERO_TURNS;
    battle.logs.push(`${actor.name}의 ${BASE_MP_RECOVERY_ZERO} 효과 ${before}턴 -> ${BASE_MP_RECOVERY_ZERO_TURNS}턴`);
  },

  onAttackDamageDealt(battle, actor, target, amount) {
    if (actor.characterId !== CHARACTER_ID || actor === target) return;
    const drain = floorInt(amount * 0.2);
    if (drain <= 0) return;
    const reduced = battle.reduceMp(target, drain, "이곳의 생존법");
    if (reduced > 0) battle.restoreMp(actor, reduced, "이곳의 생존법");
  },

  counterResourceValue(_fighter, name, raw) {
    if (name === NEGATIVE) return -Number(raw || 0) * 25;
    if (name === BASE_MP_RECOVERY_ZERO) return -Number(raw || 0) * 450;
    return null;
  },

  estimatedPower(battle, actor, _target, action, power) {
    const projected = projectedStateAfterCost(battle, actor, action);
    if (action.isSkill(CHARACTER_ID, 0)) return Number(power) + Math.min(MAX_NEGATIVE, projected.negative);
    if (action.isSkill(CHARACTER_ID, 3)) {
      const before = Math.min(MAX_NEGATIVE, projected.negative);
      return Number(power) + (MAX_NEGATIVE - before);
    }
    return power;
  },

  applyConditionEffects(battle, choice) {
    const actor = choice.actor;
    const action = choice.action;
    if (action.isSkill(CHARACTER_ID, 0)) {
      const stacks = negativeStacks(actor);
      choice.power = Number(choice.power || 0) + stacks;
      battle.logs.push(`${NEGATIVE} ${stacks}중첩만큼 위력이 증가했다.`);
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      choice.necoulombReverseCurrent = actor.mp === 0;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      const before = negativeStacks(actor);
      const gained = MAX_NEGATIVE - before;
      choice.necoulombPreFullDischargeNegative = before;
      if (gained > 0) battle.addCounter(actor, NEGATIVE, gained, MAX_NEGATIVE);
      choice.power = Number(choice.power || 0) + gained;
      battle.logs.push(`완전 방전으로 ${NEGATIVE} ${gained}중첩만큼 위력이 증가했다.`);
    }
    return true;
  },

  onHitAfterDefenseAsActor(battle, choice, totalDamage) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    const action = choice.action;
    if (action.isSkill(CHARACTER_ID, 0)) {
      const recoil = negativeStacks(actor);
      if (recoil > 0) battle.fixedDamage(actor, recoil, action.name, actor);
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      const reduced = battle.reduceMp(target, totalDamage, action.name);
      const overflow = Math.max(0, floorInt(totalDamage) - reduced);
      if (negativeStacks(actor) >= 1 && target.mp === 0 && overflow > 0) {
        battle.fixedDamage(target, overflow, action.name, actor);
      }
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      const recovery = Number(choice.necoulombPreFullDischargeNegative || 0);
      if (recovery > 0) battle.heal(actor, recovery, action.name);
    }
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    const actor = choice.actor;
    const target = battle.opponent(actor);
    for (const stat of ["atk", "spd"]) battle.addStatEffect(actor, stat, 1.3, 4, choice.action.name);
    if (choice.necoulombReverseCurrent) {
      for (const stat of ["atk", "spd"]) battle.addStatEffect(target, stat, 0.7, 4, choice.action.name);
    }
    return true;
  },

  setupValue(battle, actor, target, action) {
    if (!action.isSkill(CHARACTER_ID, 1)) return 0;
    const source = action.name;
    const ownRemaining = minimumRemainingEffect(actor, source, ["atk", "spd"], 1.3);
    const targetRemaining = minimumRemainingEffect(target, source, ["atk", "spd"], 0.7);
    const projected = projectedStateAfterCost(battle, actor, action);
    let value = ownRemaining <= 1 ? 1050 : ownRemaining === 2 ? 280 : -520;
    if (projected.mp === 0) value += targetRemaining <= 1 ? 1550 : targetRemaining === 2 ? 360 : -420;
    return value;
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const projected = projectedStateAfterCost(battle, actor, action);
    const projectedNegative = Math.min(MAX_NEGATIVE, projected.negative);
    const damage = rawDamage(expectedDamage, hitRate);
    const passiveDrain = Math.min(target.mp, floorInt(damage * 0.2));
    const negativeAfterPassive = projectedNegative;
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const missingHp = actor.maxHp - actor.hp;

    if (action.isSkill(CHARACTER_ID, 0)) {
      const recoil = negativeAfterPassive;
      value += projectedNegative * 85;
      value -= recoil * 9 * hitRate;
      if (recoil >= actor.hp && expectedDamage < target.hp) value -= 9000;
      else if (recoil >= actor.hp && expectedDamage >= target.hp) value += 3200;
      if (projectedNegative <= 6) value -= 420;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      const source = action.name;
      const ownRemaining = minimumRemainingEffect(actor, source, ["atk", "spd"], 1.3);
      const targetRemaining = minimumRemainingEffect(target, source, ["atk", "spd"], 0.7);
      if (ownRemaining <= 1) value += 720;
      else if (ownRemaining >= 3) value -= 650;
      if (projected.mp === 0) {
        value += incoming * 1.2;
        if (targetRemaining <= 1) value += 980;
        else if (targetRemaining >= 3) value -= 540;
      }
      if (actor.hp <= incoming && projected.mp !== 0) value -= 420;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      const targetMpAfterPassive = Math.max(0, target.mp - passiveDrain);
      const activeDrain = Math.min(targetMpAfterPassive, floorInt(damage));
      const overflow = projectedNegative >= 1 && targetMpAfterPassive - activeDrain === 0
        ? Math.max(0, floorInt(damage) - activeDrain)
        : 0;
      value += (passiveDrain + activeDrain) * 20 * hitRate;
      value += overflow * 5.2 * hitRate;
      if (target.mp <= damage * 1.2 && projectedNegative >= 1) value += 620;
      if (target.mp >= 55) value += 340;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      const gained = MAX_NEGATIVE - projectedNegative;
      const recovery = Math.min(missingHp, projectedNegative);
      const lockRemaining = Number(actor.counters[BASE_MP_RECOVERY_ZERO] || 0);
      const addedLockTurns = Math.max(0, BASE_MP_RECOVERY_ZERO_TURNS - lockRemaining);
      value += gained * 70 + recovery * 24;
      value -= addedLockTurns * 420;
      if (expectedDamage >= target.hp) value += 5200;
      else if (incoming >= actor.hp) value += 1250 + recovery * 18;
      if (missingHp < 8 && gained < 8 && expectedDamage < target.hp) value -= 850;
      if (projectedNegative >= 24 && missingHp < 16) value -= 520;
    } else if (action.isCommonAction("meditation")) {
      value += Math.min(15, negativeStacks(actor)) * 44;
      if (negativeStacks(actor) >= 20) value += 520;
    } else if (action.isCommonAction("defense") && negativeStacks(actor) >= 24) {
      value += 180;
    }
    return value;
  },

  decrementCounters(fighter, battle) {
    const remaining = Number(fighter.counters[BASE_MP_RECOVERY_ZERO] || 0);
    if (remaining <= 0) return;
    if (remaining === 1) {
      delete fighter.counters[BASE_MP_RECOVERY_ZERO];
      battle?.logs.push(`${fighter.name}의 ${BASE_MP_RECOVERY_ZERO} 효과가 사라졌다.`);
    } else {
      fighter.counters[BASE_MP_RECOVERY_ZERO] = remaining - 1;
    }
  },
};
