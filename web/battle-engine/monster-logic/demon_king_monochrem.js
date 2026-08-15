"use strict";

const CHARACTER_ID = "demon_king_monochrem";
const REFLECTION_NAME = "흑색 반전";
const SEAL_DURATION = 4;
const SEAL_COUNT = 2;
const FINALE_SLOT = 3;
const FINALE_READY_SCORE = 24000;
const FINALE_SAVING_SCORE = 8000;
const FINALE_PLAN_DETOUR_SCORE = 11000;
const FINALE_PLAN_OTHER_SCORE = -3500;
const FINALE_ALREADY_ACTIVE_SCORE = -12000;

function isBossSkill(action) {
  return Boolean(action?.isActive && action.characterId === CHARACTER_ID);
}

function sealedSkillCount(fighter) {
  return Object.values(fighter.forbiddenActionKeys || {})
    .filter((remaining) => Number(remaining) > 0).length;
}

function finaleCost(battle, actor) {
  const finale = battle.availableActions(actor)
    .find((action) => action.isSkill(CHARACTER_ID, FINALE_SLOT));
  return finale ? battle.effectiveCost(actor, finale) : 80;
}

function counterDetourScore(counts, action) {
  if (action.isSkill(CHARACTER_ID, 0) && counts.defense >= 2) return FINALE_PLAN_DETOUR_SCORE;
  if (action.isSkill(CHARACTER_ID, 1) && counts.attack >= 2) return FINALE_PLAN_DETOUR_SCORE;
  if (action.isSkill(CHARACTER_ID, 2) && counts.meditation >= 2) return FINALE_PLAN_DETOUR_SCORE;
  return 0;
}

function applyFinaleSeal(battle, target) {
  const pool = battle.availableActions(target).filter((action) => action.isActive);
  const selected = [];
  while (pool.length && selected.length < SEAL_COUNT) {
    selected.push(pool.splice(battle.rng.range(pool.length), 1)[0]);
  }
  target.forbiddenActionKeys ||= {};
  for (const action of selected) {
    target.forbiddenActionKeys[action.key] = SEAL_DURATION + 1;
  }
  const names = selected.map((action) => action.name).join("·");
  battle.logs.push(`${target.name}의 ${names} 선택이 다음 턴부터 ${SEAL_DURATION}턴 동안 봉인됐다.`);
}

module.exports = {
  isLegalChoice(_battle, fighter, action) {
    if (!isBossSkill(action)) return null;
    return fighter.selectedHistory.at(-1) === action.key ? false : null;
  },

  attackDamageMultipliers(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 0)) return [];
    const target = battle.opponent(choice.actor);
    return battle.record.selectedKind[target.side] === "방어" ? [4] : [];
  },

  estimatedDamageMultipliers(battle, _actor, target, action) {
    if (!action.isSkill(CHARACTER_ID, 0)) return [];
    const counts = battle.recentKindCounts(target, 4);
    return counts.defense > 0 ? [1 + Math.min(3, counts.defense * 0.75)] : [];
  },

  applyNonAttackEffects(battle, choice) {
    const actor = choice.actor;
    if (choice.action.isSkill(CHARACTER_ID, 1)) {
      battle.applyDefense(actor, choice.action.name);
      return true;
    }
    return false;
  },

  onHitAfterDefenseAsActor(battle, choice) {
    const target = battle.opponent(choice.actor);
    if (choice.action.isSkill(CHARACTER_ID, 2)) {
      if (battle.record.selectedKind[target.side] === "명상") {
        battle.reduceMp(target, 35, choice.action.name);
      } else {
        battle.logs.push(`${choice.action.name}이 명상을 포착하지 못했다.`);
      }
      return;
    }
    if (choice.action.isSkill(CHARACTER_ID, 3)) applyFinaleSeal(battle, target);
  },

  absorbAttackDamage(battle, target, amount, source) {
    if (target.characterId !== CHARACTER_ID || target.defenseName !== REFLECTION_NAME) return amount;
    if (!source || source === target || amount <= 0) return amount;
    battle.fixedDamage(source, amount, REFLECTION_NAME, target);
    battle.logs.push(`${target.name}의 ${REFLECTION_NAME}이 ${amount}의 공격 피해를 되돌렸다.`);
    return 0;
  },

  aiScore(battle, actor, target, action, expectedDamage) {
    const counts = battle.recentKindCounts(target, 4);
    const activeSealCount = sealedSkillCount(target);
    const costToFinale = finaleCost(battle, actor);
    const savingForFinale = activeSealCount === 0 && actor.mp < costToFinale;
    let score = 0;

    if (action.isSkill(CHARACTER_ID, 0)) score = counts.defense * 420 + Number(expectedDamage || 0) * 0.35;
    if (action.isSkill(CHARACTER_ID, 1)) {
      const incoming = battle.estimateBestIncomingDamage(target, actor);
      score = counts.attack * 260 + incoming * 1.3;
    }
    if (action.isSkill(CHARACTER_ID, 2)) score = counts.meditation * 360 + (target.mp <= 35 ? 130 : 0);

    if (action.isSkill(CHARACTER_ID, FINALE_SLOT)) {
      if (activeSealCount > 0) return FINALE_ALREADY_ACTIVE_SCORE;
      return actor.mp >= costToFinale ? FINALE_READY_SCORE : -FINALE_READY_SCORE;
    }

    if (!savingForFinale) return score;
    if (action.isCommonAction("meditation")) return FINALE_SAVING_SCORE;

    const detour = counterDetourScore(counts, action);
    if (detour > 0) return score + detour;
    return score + FINALE_PLAN_OTHER_SCORE;
  },
};
