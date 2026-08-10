"use strict";

const CHARACTER_ID = "demon_knight_kaighton";
const DUEL_SLOT = 0;
const COURTESY_SLOT = 1;
const FORK_SLOT = 2;
const COURTESY_NAME = "백은의 예우";

function targetAttackChance(battle, target) {
  const counts = battle.recentKindCounts(target, 4);
  const total = counts.attack + counts.defense + counts.meditation;
  return total > 0 ? counts.attack / total : 0.5;
}

module.exports = {
  attackDamageMultipliers(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, DUEL_SLOT)) return [];
    const target = battle.opponent(choice.actor);
    return battle.kindIsAttack(battle.record.selectedKind[target.side]) ? [1.4] : [];
  },

  estimatedDamageMultipliers(battle, _actor, target, action) {
    if (!action.isSkill(CHARACTER_ID, DUEL_SLOT)) return [];
    return [1 + targetAttackChance(battle, target) * 0.4];
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, COURTESY_SLOT)) return false;
    battle.applyDefense(choice.actor, choice.action.name, choice.defenseBonusReduction);
    battle.logs.push(`${choice.actor.name}이 상대의 일격을 정중히 맞이할 자세를 갖췄다.`);
    return true;
  },

  onDefenseHit(battle, choice, totalDamage) {
    const defender = battle.opponent(choice.actor);
    if (defender.characterId !== CHARACTER_ID || defender.defenseName !== COURTESY_NAME || totalDamage <= 0) return;
    battle.restoreMp(defender, Math.trunc(totalDamage * 0.5), COURTESY_NAME);
  },

  onHitAfterDefenseAsActor(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, FORK_SLOT)) return;
    const target = battle.opponent(choice.actor);
    battle.logs.push(`${choice.actor.name}이 나이트 포크로 HP와 MP를 동시에 압박했다.`);
    battle.reduceMp(target, 15, choice.action.name);
  },

  aiScore(battle, actor, target, action, expectedDamage) {
    if (action.isSkill(CHARACTER_ID, DUEL_SLOT)) {
      return 180 + targetAttackChance(battle, target) * 520 + Number(expectedDamage || 0) * 0.35;
    }
    if (action.isSkill(CHARACTER_ID, COURTESY_SLOT)) {
      const incoming = battle.estimateBestIncomingDamage(target, actor);
      return 220 + targetAttackChance(battle, target) * 480 + incoming * 0.55;
    }
    if (action.isSkill(CHARACTER_ID, FORK_SLOT)) {
      const mpPressure = Math.min(15, Math.max(0, target.mp)) * 24;
      return 260 + mpPressure + Number(expectedDamage || 0) * 0.3;
    }
    return 0;
  },
};
