"use strict";

const CHARACTER_ID = "demon_archer_robin";

module.exports = {
  onHitAfterDefenseAsActor(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 0)) return;
    if (battle.roll("SPD 감소") < 30) {
      battle.addStatEffect(battle.opponent(choice.actor), "spd", 0.9, 3, choice.action.name);
    }
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    battle.applyDefense(choice.actor, choice.action.name);
    battle.addStatEffect(choice.actor, "spd", 1.1, 3, choice.action.name);
    return true;
  },

  aiScore(battle, actor, target, action, _expectedDamage, hitRate) {
    if (action.isSkill(CHARACTER_ID, 0)) {
      return 150 * Number(hitRate || 0) * 0.3;
    }
    if (!action.isSkill(CHARACTER_ID, 1)) return 0;
    const active = actor.statEffects.some((effect) => effect.source === action.name && effect.remaining >= 2);
    if (active) return -600;
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    return 260 + incoming * 0.85;
  },
};
