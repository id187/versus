"use strict";

const CHARACTER_ID = "demon_mage_zero";
const BARRIER_ACTIVE = "회백의 역장 활성";

module.exports = {
  resetTurnFlags(_battle, fighter) {
    delete fighter.counters[BARRIER_ACTIVE];
  },

  onHitAfterDefenseAsActor(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 0)) return;
    battle.fixedDamage(battle.opponent(choice.actor), 1, choice.action.name, choice.actor);
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    battle.applyDefense(choice.actor, choice.action.name);
    choice.actor.counters[BARRIER_ACTIVE] = 1;
    return true;
  },

  onDefenseHit(battle, choice) {
    const attacker = choice.actor;
    const defender = battle.opponent(attacker);
    if (Number(defender.counters[BARRIER_ACTIVE] || 0) <= 0) return;
    battle.fixedDamage(attacker, 3, "회백의 역장", defender);
  },

  aiScore(battle, actor, target, action, _expectedDamage, hitRate) {
    if (action.isSkill(CHARACTER_ID, 0)) return 60 * Number(hitRate || 0);
    if (!action.isSkill(CHARACTER_ID, 1)) return 0;
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    return incoming * 1.15 + (incoming > 0 ? 180 : -220);
  },
};
