"use strict";

const CHARACTER_ID = "demon_priest_sara";

module.exports = {
  onHitAfterDefenseAsActor(battle, choice, totalDamage) {
    if (!choice.action.isSkill(CHARACTER_ID, 0) || totalDamage <= 0) return;
    battle.heal(choice.actor, Math.floor(totalDamage * 0.5), choice.action.name);
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    battle.addStatEffect(battle.opponent(choice.actor), "atk", 0.9, 4, choice.action.name);
    return true;
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    if (action.isSkill(CHARACTER_ID, 0)) {
      const missingHp = Math.max(0, actor.maxHp - actor.hp);
      const expectedHealing = Math.min(missingHp, Math.floor(Number(expectedDamage || 0) * 0.5));
      return expectedHealing * 36 * Number(hitRate || 0);
    }
    if (!action.isSkill(CHARACTER_ID, 1)) return 0;
    const active = target.statEffects.some(
      (effect) => effect.stat === "atk" && effect.source === action.name && effect.remaining >= 2,
    );
    if (active) return -650;
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    return 280 + incoming * 0.7;
  },
};
