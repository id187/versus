"use strict";

const CHARACTER_ID = "winday";
const GALE = "선풍";
const BACKWIND = "격렬한 역풍";
const BACKWIND_PENDING = "격렬한 역풍 대기";
const BACKWIND_ACTIVE = "격렬한 역풍 활성";

function floorInt(value) {
  return Math.floor(Number(value));
}

function galeStacks(fighter) {
  return Math.max(0, Number(fighter.counters[GALE] || 0));
}

function resetGale(battle, fighter) {
  const before = galeStacks(fighter);
  if (before <= 0) return;
  fighter.counters[GALE] = 0;
  battle.logs.push(`${fighter.name}의 ${GALE} ${before} -> 0`);
}

function sameSelectedPriority(battle, actor) {
  const target = battle.opponent(actor);
  const ownPriority = Number(battle.record.selectedPriority?.[actor.side]);
  const targetPriority = Number(battle.record.selectedPriority?.[target.side]);
  return Number.isFinite(ownPriority)
    && Number.isFinite(targetPriority)
    && ownPriority === targetPriority;
}

function recentKindCounts(battle, fighter, limit = 4) {
  if (typeof battle.recentKindCounts === "function") return battle.recentKindCounts(fighter, limit);
  return { attack: 0, defense: 0, meditation: 0 };
}

module.exports = {
  HIDDEN_COUNTERS: new Set([BACKWIND_PENDING, BACKWIND_ACTIVE]),

  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has(GALE)) fighter.counters[GALE] = 0;
    fighter.counters[BACKWIND_PENDING] = 0;
    fighter.counters[BACKWIND_ACTIVE] = 0;
  },

  counterStateText(_fighter, name, value) {
    return name === GALE ? `${GALE} ${Number(value)}` : undefined;
  },

  counterResourceValue(_fighter, name, raw) {
    if (name === BACKWIND_PENDING || name === BACKWIND_ACTIVE) return 0;
    return name === GALE ? Math.max(0, Number(raw)) * 175 : undefined;
  },

  extraStateParts(_battle, fighter) {
    return Number(fighter.counters[BACKWIND_ACTIVE] || 0) > 0
      ? [`${BACKWIND}: SPD x2`]
      : [];
  },

  resetTurnFlags(_battle, fighter) {
    fighter.counters[BACKWIND_ACTIVE] = Number(fighter.counters[BACKWIND_PENDING] || 0) > 0 ? 1 : 0;
    fighter.counters[BACKWIND_PENDING] = 0;
  },

  modifyStats(_battle, fighter, atk, defense, spd) {
    const stacks = galeStacks(fighter);
    const backwindMultiplier = Number(fighter.counters[BACKWIND_ACTIVE] || 0) > 0 ? 2 : 1;
    return [
      atk * (1 + stacks * 0.2),
      defense,
      spd * (1 + stacks * 0.1) * backwindMultiplier,
    ];
  },

  onActionStart(battle, choice) {
    const actor = choice.actor;
    if (!sameSelectedPriority(battle, actor)) return false;
    if (battle.isActorFirst(choice)) battle.addCounter(actor, GALE, 1);
    else resetGale(battle, actor);
    return false;
  },

  applyConditionEffects(battle, choice) {
    const actor = choice.actor;
    const action = choice.action;
    if (action.isSkill(CHARACTER_ID, 0)) {
      const first = battle.isActorFirst(choice);
      battle.addStatEffect(
        actor,
        first ? "def" : "atk",
        1.2,
        2,
        action.name,
      );
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      choice.power = floorInt(Number(choice.power || 0) * (1 + galeStacks(actor) * 0.2));
      if (Number(battle.record.attackDamageTaken[actor.side] || 0) > 0) {
        choice.power = floorInt(choice.power * 1.5);
      }
    } else if (action.isSkill(CHARACTER_ID, 3) && battle.isActorFirst(choice)) {
      battle.addCounter(actor, GALE, 1);
    }
    return true;
  },

  attackDamageMultipliers(battle, choice) {
    if (choice.action.isSkill(CHARACTER_ID, 3) && !battle.isActorFirst(choice)) return [0.5];
    return [];
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    battle.applyDefense(choice.actor, choice.action.name, choice.defenseBonusReduction);
    return true;
  },

  afterActionPhase(battle, fighter) {
    if (battle.turnOrder[fighter.side] !== 1 || fighter.hp <= 0) return;
    fighter.counters[BACKWIND_PENDING] = 1;
    battle.logs.push(`${fighter.name}의 ${BACKWIND}이 다음 턴에 발동한다.`);
  },

  onTurnEnd(battle, fighter) {
    if (fighter.defenseName !== fighter.data.skills?.[1]?.name) return;
    const target = battle.opponent(fighter);
    if (target.defenseName == null) return;
    battle.fixedDamage(target, 12, "칼바람 방벽", fighter);
  },

  setupValue(battle, actor, target, action) {
    if (!action.isSkill(CHARACTER_ID, 1)) return 0;
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const defenseHistory = recentKindCounts(battle, target).defense;
    return 180 + incoming * 0.45 + defenseHistory * 150;
  },

  estimatedPower(_battle, actor, _target, action, power) {
    if (!action.isSkill(CHARACTER_ID, 2)) return power;
    let value = floorInt(Number(power || 0) * (1 + galeStacks(actor) * 0.2));
    if (Number(_battle.record.attackDamageTaken[actor.side] || 0) > 0) value = floorInt(value * 1.5);
    return value;
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    const stacks = galeStacks(actor);
    const targetKinds = recentKindCounts(battle, target);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    let value = 0;

    if (action.isAttack) {
      value += expectedDamage * 0.65;
      if (expectedDamage >= target.hp) value += 2600;
    }
    if (action.isSkill(CHARACTER_ID, 0)) {
      value += 180 + incoming * 0.18;
      if (actor.mp < 35) value -= 180;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      value += targetKinds.defense * 240 + incoming * 0.3;
      if (incoming >= actor.hp) value += 1500;
      if (actor.defenseStreak >= 2 && targetKinds.defense === 0) value -= 420;
      if (actor.mp < 35 && incoming < actor.hp * 0.7) value -= 380;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      value += stacks * 180 + targetKinds.attack * 150 + expectedDamage * 0.8 * hitRate;
      if (actor.mp < 42 && expectedDamage < target.hp) value -= 300;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      value += 650 + Math.min(stacks, 5) * 90 + expectedDamage * 0.5 * hitRate;
      if (actor.mp < 50 && expectedDamage < target.hp) value -= 420;
    } else if (action.isCommonAction("meditation")) {
      if (actor.mp < 35) value += 520 + (35 - actor.mp) * 18;
      if (incoming >= actor.hp * 0.8) value -= 420;
    }
    return value;
  },
};
