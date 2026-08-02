"use strict";

const CHARACTER_ID = "demon_warrior_luke";

module.exports = {
  onHitAfterDefenseAsActor(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 0)) return;
    if (battle.roll("DEF 감소") < 30) {
      battle.addStatEffect(battle.opponent(choice.actor), "def", 0.9, 3, choice.action.name);
    }
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    battle.addStatEffect(choice.actor, "atk", 1.1, 4, choice.action.name);
    battle.addStatEffect(choice.actor, "def", 1.1, 4, choice.action.name);
    return true;
  },

  aiScore(battle, actor, target, action, _expectedDamage, hitRate) {
    if (action.isSkill(CHARACTER_ID, 0)) return 180 * Number(hitRate || 0) * 0.3;
    if (!action.isSkill(CHARACTER_ID, 1)) return 0;
    const active = actor.statEffects.some((effect) => effect.source === action.name && effect.remaining >= 2);
    if (active) return -650;
    return 420 + battle.estimateBestIncomingDamage(target, actor) * 0.45;
  },
};
