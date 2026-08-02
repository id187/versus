"use strict";

const CHARACTER_ID = "emento";
const FORGET = "망각";
const PROPHECY_TURNS = 5;
const FORGOTTEN_ACTION_KEY = "ementoForgottenActionKey";
const FORECAST_ACTION_KEY = "ementoForecastActionKey";
const PROPHECY_REMAINING = "ementoProphecyRemaining";
const DREAM_FAILURE_PENDING = "ementoDreamFailurePending";

function floorInt(value) {
  return Math.floor(value);
}

function withParticle(value, consonantParticle, vowelParticle) {
  const text = String(value || "");
  const last = text.codePointAt(text.length - 1);
  const hasFinalConsonant = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${text}${hasFinalConsonant ? consonantParticle : vowelParticle}`;
}

function activeActions(battle, fighter) {
  return battle.availableActions(fighter).filter((action) => action.isActive);
}

function randomActiveAction(battle, fighter) {
  const actions = activeActions(battle, fighter);
  return actions.length ? battle.rng.choice(actions) : null;
}

function selectedCount(fighter, actionKey) {
  return fighter.selectedHistory.filter((key) => key === actionKey).length;
}

function nextSelectedCount(fighter, actionKey) {
  return selectedCount(fighter, actionKey) + 1;
}

function hasForget(fighter) {
  return Boolean(fighter.statuses[FORGET]);
}

module.exports = {
  initUniqueState(fighter) {
    fighter[FORGOTTEN_ACTION_KEY] = null;
    fighter[FORECAST_ACTION_KEY] = null;
    fighter[PROPHECY_REMAINING] = 0;
    fighter[DREAM_FAILURE_PENDING] = 0;
  },

  resetForgetStatus(battle, fighter) {
    if (!hasForget(fighter)) {
      fighter[FORGOTTEN_ACTION_KEY] = null;
      fighter[FORECAST_ACTION_KEY] = null;
      return;
    }
    const actions = activeActions(battle, fighter);
    const forecast = actions.find((action) => action.key === fighter[FORECAST_ACTION_KEY]);
    const decided = forecast || (actions.length ? battle.rng.choice(actions) : null);
    fighter[FORGOTTEN_ACTION_KEY] = decided?.key || null;
    fighter[FORECAST_ACTION_KEY] = null;
  },

  isLegalChoiceStatus(_battle, fighter, action) {
    if (!hasForget(fighter) || !action.isActive) return null;
    return fighter[FORGOTTEN_ACTION_KEY] === action.key ? false : null;
  },

  consumeForcedConditionFailure(battle, choice) {
    const actor = choice.actor;
    if (Number(actor[DREAM_FAILURE_PENDING] || 0) <= 0) return false;
    actor[DREAM_FAILURE_PENDING] = 0;
    battle.logs.push(`${actor.name}의 다음 행동은 몽중몽설로 MP를 소모한 뒤 실패했다.`);
    return true;
  },

  wouldConditionFailStatus(_battle, actor) {
    return Number(actor[DREAM_FAILURE_PENDING] || 0) > 0;
  },

  attackDamageMultipliers(_battle, choice) {
    if (!choice.action.isAttack) return [];
    const actionKey = choice.selectedActionKey || choice.action.key;
    return selectedCount(choice.actor, actionKey) % 2 === 0 ? [1.2] : [];
  },

  estimatedDamageMultipliers(_battle, actor, _target, action) {
    if (!action.isAttack) return [];
    return nextSelectedCount(actor, action.key) % 2 === 0 ? [1.2] : [];
  },

  onHitAfterDefenseAsActor(battle, choice) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    const action = choice.action;
    const targetHadForget = hasForget(target);

    if (action.isSkill(CHARACTER_ID, 0)) {
      if (targetHadForget) battle.reduceMp(target, 4, action.name);
      const roll = battle.roll("망각 부여");
      battle.logs.push(`망각 부여 판정 85% / 판정값 ${roll.toFixed(2)}`);
      if (roll < 85) battle.addStatus(target, FORGET, 4, 1, actor.name);
    } else if (action.isSkill(CHARACTER_ID, 2) && targetHadForget) {
      const damageTaken = Number(battle.record.attackDamageTaken[actor.side] || 0);
      battle.heal(actor, floorInt(damageTaken * 0.7), action.name);
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      target[DREAM_FAILURE_PENDING] = 1;
      battle.logs.push(`${target.name}의 다음 행동은 MP를 소모한 뒤 실패한다.`);
    }
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    const actor = choice.actor;
    const target = battle.opponent(actor);
    battle.addStatus(target, FORGET, 2, 1, actor.name);
    actor[PROPHECY_REMAINING] = PROPHECY_TURNS;
    battle.logs.push(`${withParticle(actor.name, "은", "는")} ${PROPHECY_TURNS}턴 동안 예지몽을 꾼다.`);
    return true;
  },

  onTurnEnd(battle, fighter) {
    if (Number(fighter[PROPHECY_REMAINING] || 0) <= 0) return;
    const target = battle.opponent(fighter);
    const forget = target.statuses[FORGET];
    if (!forget || Number(forget.remaining || 0) <= 1) return;
    const action = randomActiveAction(battle, target);
    if (!action) return;
    target[FORECAST_ACTION_KEY] = action.key;
    battle.logs.push(
      `예지몽: 다음 턴 ${withParticle(target.name, "은", "는")} 망각으로 ${withParticle(action.name, "을", "를")} 선택할 수 없다.`,
    );
  },

  decrementCounters(fighter) {
    if (Number(fighter[PROPHECY_REMAINING] || 0) > 0) fighter[PROPHECY_REMAINING] -= 1;
  },

  setupValue(_battle, _actor, target, action) {
    if (!action.isSkill(CHARACTER_ID, 1)) return 0;
    const remaining = Number(target.statuses[FORGET]?.remaining || 0);
    return remaining > 1 ? 420 : 980;
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const targetForgotten = hasForget(target);

    if (action.isSkill(CHARACTER_ID, 0)) {
      value += targetForgotten ? 520 + Math.min(4, target.mp) * 35 : 180;
      value += (targetForgotten ? 260 : 620) * hitRate;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      value += targetForgotten ? 420 : 1180;
      if (Number(actor[PROPHECY_REMAINING] || 0) <= 1) value += 360;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      const heal = floorInt(Number(battle.record.attackDamageTaken[actor.side] || 0) * 0.7);
      value += targetForgotten ? Math.min(actor.maxHp - actor.hp, heal) * 14 + 420 : -260;
      if (expectedDamage >= target.hp) value += 2800;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      value += Number(target[DREAM_FAILURE_PENDING] || 0) > 0 ? -1200 : 1700 * hitRate;
      if (expectedDamage >= target.hp) value += 3200;
    }
    return value;
  },
};

module.exports.borrowedEffects = {
  onTurnEnd: module.exports.onTurnEnd,
  decrementCounters: module.exports.decrementCounters,
};
