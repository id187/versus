"use strict";

const CHARACTER_ID = "demon_rook_chatrang";
const CASTLING_NAME = "전략적 위치 변경";
const CASTLING_SLOT = 1;
const CASTLING_DURATION = 4;

function castlingTurns(fighter) {
  return Math.max(0, Math.trunc(Number(fighter?.counters?.[CASTLING_NAME] || 0)));
}

module.exports = {
  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has(CASTLING_NAME)) fighter.counters[CASTLING_NAME] = 0;
  },

  counterStateText(_fighter, name, value) {
    if (name !== CASTLING_NAME || Number(value) <= 0) return null;
    return `${CASTLING_NAME} ${value}턴`;
  },

  modifyStats(_battle, fighter, atk, defense, spd) {
    if (castlingTurns(fighter) <= 0) return [atk, defense, spd];
    return [defense, atk, spd];
  },

  isLegalChoice(_battle, fighter, action) {
    if (castlingTurns(fighter) > 0 && action.isSkill(CHARACTER_ID, CASTLING_SLOT)) return false;
    return null;
  },

  applyConditionEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 0)) return undefined;
    choice.hitCount = 2;
    battle.logs.push("[연격] 2회로 결정되었다.");
    return undefined;
  },

  estimatedHitCount(_actor, action) {
    if (!action.isSkill(CHARACTER_ID, 0)) return undefined;
    return 2;
  },

  attackDamageMultipliers(_battle, choice) {
    if (choice.action.isSkill(CHARACTER_ID, 2) && castlingTurns(choice.actor) > 0) return [1.5];
    return [];
  },

  estimatedDamageMultipliers(_battle, actor, _target, action) {
    if (action.isSkill(CHARACTER_ID, 2) && castlingTurns(actor) > 0) return [1.5];
    return [];
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, CASTLING_SLOT)) return false;
    const actor = choice.actor;
    battle.applyDefense(actor, choice.action.name, choice.defenseBonusReduction);
    actor.counters[CASTLING_NAME] = CASTLING_DURATION;
    battle.logs.push(`${actor.name}이 캐슬링으로 전열을 바꾸어 ATK와 DEF를 교환했다.`);
    return true;
  },

  decrementCounters(fighter) {
    if (castlingTurns(fighter) > 0) fighter.counters[CASTLING_NAME] -= 1;
  },

  aiScore(battle, actor, target, action, expectedDamage) {
    if (action.isSkill(CHARACTER_ID, 0)) {
      return 180 + Number(expectedDamage || 0) * 0.3;
    }
    if (action.isSkill(CHARACTER_ID, CASTLING_SLOT)) {
      if (castlingTurns(actor) > 0) return -3000;
      const hpRate = actor.hp / Math.max(1, actor.maxHp);
      const incoming = battle.estimateBestIncomingDamage(target, actor);
      return 760 + hpRate * 260 + incoming * 0.4;
    }
    if (action.isSkill(CHARACTER_ID, 2)) {
      return castlingTurns(actor) > 0
        ? 720 + Number(expectedDamage || 0) * 0.45
        : -420;
    }
    return 0;
  },
};
