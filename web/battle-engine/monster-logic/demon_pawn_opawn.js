"use strict";

const CHARACTER_ID = "demon_pawn_opawn";
const PROMOTION_NAME = "흑백의 승급";
const PROMOTION_SLOT = 1;
const PROMOTION_DURATION = 5;

function promotionTurns(fighter) {
  return Math.max(0, Math.trunc(Number(fighter?.counters?.[PROMOTION_NAME] || 0)));
}

function firstActionChance(battle, actor, target) {
  const actorSpd = Math.max(0, Number(battle.currentStats(actor)[2] || 0));
  const targetSpd = Math.max(0, Number(battle.currentStats(target)[2] || 0));
  const total = actorSpd + targetSpd;
  return total > 0 ? actorSpd / total : 0.5;
}

module.exports = {
  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has(PROMOTION_NAME)) fighter.counters[PROMOTION_NAME] = 0;
  },

  counterStateText(_fighter, name, value) {
    if (name !== PROMOTION_NAME || Number(value) <= 0) return null;
    return `${PROMOTION_NAME} ${value}턴`;
  },

  isLegalChoice(_battle, fighter, action) {
    if (promotionTurns(fighter) > 0 && action.isActive) return false;
    return null;
  },

  attackDamageMultipliers(battle, choice) {
    if (choice.action.isSkill(CHARACTER_ID, 0) && battle.isActorFirst(choice)) return [1.4];
    if (choice.action.isSkill(CHARACTER_ID, 2)) {
      const target = battle.opponent(choice.actor);
      if (target.hp <= target.maxHp * 0.5) return [1.5];
    }
    return [];
  },

  estimatedDamageMultipliers(battle, actor, target, action) {
    if (action.isSkill(CHARACTER_ID, 0)) return [1 + firstActionChance(battle, actor, target) * 0.4];
    if (action.isSkill(CHARACTER_ID, 2) && target.hp <= target.maxHp * 0.5) return [1.5];
    return [];
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, PROMOTION_SLOT)) return false;
    const actor = choice.actor;
    battle.addStatEffect(actor, "atk", 1.5, PROMOTION_DURATION, PROMOTION_NAME);
    battle.addStatEffect(actor, "def", 1.5, PROMOTION_DURATION, PROMOTION_NAME);
    battle.addStatEffect(actor, "spd", 1.5, PROMOTION_DURATION, PROMOTION_NAME);
    actor.counters[PROMOTION_NAME] = PROMOTION_DURATION;
    battle.logs.push(`${actor.name}이 폰에서 퀸으로 승급했다.`);
    return true;
  },

  decrementCounters(fighter) {
    if (promotionTurns(fighter) > 0) fighter.counters[PROMOTION_NAME] -= 1;
  },

  aiScore(battle, actor, target, action, expectedDamage) {
    if (action.isSkill(CHARACTER_ID, 0)) {
      return firstActionChance(battle, actor, target) * 320 + Number(expectedDamage || 0) * 0.2;
    }
    if (action.isSkill(CHARACTER_ID, PROMOTION_SLOT)) {
      if (promotionTurns(actor) > 0) return -3000;
      const hpRate = actor.hp / Math.max(1, actor.maxHp);
      const finishingPressure = target.hp <= target.maxHp * 0.35 ? -700 : 0;
      return 950 + hpRate * 420 + battle.estimateBestIncomingDamage(target, actor) * 0.35 + finishingPressure;
    }
    if (action.isSkill(CHARACTER_ID, 2)) {
      return target.hp <= target.maxHp * 0.5 ? 900 + Number(expectedDamage || 0) * 0.35 : -120;
    }
    return 0;
  },
};
