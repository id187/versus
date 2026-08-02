"use strict";

const CHARACTER_ID = "demon_fighter_gran";

module.exports = {
  applyConditionEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 0)) return undefined;
    choice.hitCount = 2 + battle.rng.range(4);
    battle.logs.push(`[연격] ${choice.hitCount}회로 결정되었다.`);
    return undefined;
  },

  estimatedHitCount(_actor, action, useMax) {
    if (!action.isSkill(CHARACTER_ID, 0)) return undefined;
    return useMax ? 5 : 3.5;
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    battle.addStatEffect(choice.actor, "atk", 1.2, 4, choice.action.name);
    battle.addStatEffect(choice.actor, "def", 0.9, 4, choice.action.name);
    return true;
  },

  aiScore(_battle, actor, _target, action) {
    if (!action.isSkill(CHARACTER_ID, 1)) return 0;
    const active = actor.statEffects.some(
      (effect) => effect.source === action.name && effect.remaining >= 2,
    );
    if (active) return -700;
    return actor.hp >= actor.maxHp * 0.35 ? 430 : 110;
  },
};
