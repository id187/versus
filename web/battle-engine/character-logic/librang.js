"use strict";

const CHARACTER_ID = "librang";
const BALANCE = "균형";
const PRAYER = "평형의 기도";
const JUDGMENT_BASE_PERCENT = 25;
const JUDGMENT_RESERVE_MP = 50;

function floorInt(value) {
  return Math.floor(value);
}

function balance(fighter) {
  return Math.max(0, Number(fighter.counters[BALANCE] || 0));
}

function actionKeyIsAttack(fighter, key) {
  if (key === "common:normal_attack") return true;
  if (String(key).startsWith("common:")) return false;
  const [id, slotText] = String(key).split(":");
  const slot = Number(slotText);
  return id === fighter.characterId && Number.isInteger(slot) && fighter.data.skills?.[slot]?.power != null;
}

function selectedCounts(fighter) {
  let attacks = 0;
  let nonAttacks = 0;
  for (const key of fighter.selectedHistory) {
    if (actionKeyIsAttack(fighter, key)) attacks += 1;
    else nonAttacks += 1;
  }
  return [attacks, nonAttacks];
}

function addCounter(battle, fighter, name, amount) {
  if (typeof battle.addCounter === "function") {
    battle.addCounter(fighter, name, amount);
    return;
  }
  const before = Number(fighter.counters[name] || 0);
  fighter.counters[name] = before + Number(amount);
  battle.logs.push(`${fighter.name}의 ${name} ${before} -> ${fighter.counters[name]}`);
}

function judgmentFixedDamage(target, stacks) {
  return floorInt(target.hp * (JUDGMENT_BASE_PERCENT + stacks * 5) / 100);
}

function projectedCounts(action, attacks, nonAttacks) {
  return action.isAttack ? [attacks + 1, nonAttacks] : [attacks, nonAttacks + 1];
}

function projectedEqual(action, attacks, nonAttacks) {
  const [projectedAttacks, projectedNonAttacks] = projectedCounts(action, attacks, nonAttacks);
  return projectedAttacks === projectedNonAttacks;
}

function balanceTimingValue(battle, action, attacks, nonAttacks) {
  const [projectedAttacks, projectedNonAttacks] = projectedCounts(action, attacks, nonAttacks);
  const currentGap = Math.abs(attacks - nonAttacks);
  const projectedGap = Math.abs(projectedAttacks - projectedNonAttacks);
  if (currentGap >= 2) {
    if (projectedGap < currentGap) return 920 + (currentGap - projectedGap) * 260;
    return -Math.min(1200, (projectedGap - currentGap + 1) * 360);
  }
  if (battle.turn % 2 === 0) {
    if (projectedGap === 0) return 760;
    if (projectedGap <= 2) return 640 - projectedGap * 50;
    return -Math.min(900, projectedGap * 240);
  }
  if (projectedGap < currentGap) return 340;
  if (projectedGap <= 2) return 150 - projectedGap * 45;
  return -260;
}

module.exports = {
  HIDDEN_COUNTERS: new Set([PRAYER]),

  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has(BALANCE)) fighter.counters[BALANCE] = 0;
  },

  counterStateText(_fighter, name, value) {
    return name === BALANCE ? `${BALANCE} ${value}` : undefined;
  },

  extraStateParts(_battle, fighter) {
    if (Number(fighter.counters[PRAYER] || 0) <= 0) return [];
    return [`${PRAYER}: 공격 피해 x${1 + balance(fighter) * 0.2}`];
  },

  needsBattleLog() {
    return true;
  },

  renderBattleLog(battle, fighter, lines) {
    const opponent = battle.opponent(fighter);
    const [ownAttacks, ownNonAttacks] = selectedCounts(fighter);
    const [oppAttacks, oppNonAttacks] = selectedCounts(opponent);
    lines.push(`자신 선택: 공격 ${ownAttacks} / 비공격 ${ownNonAttacks}`);
    lines.push(`상대 선택: 공격 ${oppAttacks} / 비공격 ${oppNonAttacks}`);
  },

  counterResourceValue(_fighter, name, raw) {
    if (name === BALANCE && Number.isInteger(raw)) return raw * 240;
    if (name === PRAYER) return Number(raw || 0) > 0 ? 180 : 0;
    return undefined;
  },

  modifyCost(_battle, fighter, action, cost) {
    return action.isSkill(CHARACTER_ID, 1) ? cost - balance(fighter) : cost;
  },

  applyConditionEffects(battle, choice) {
    const actor = choice.actor;
    const action = choice.action;
    if (action.isSkill(CHARACTER_ID, 0)) {
      const bonus = balance(actor) * 2;
      if (bonus > 0) {
        choice.power = Number(choice.power || 0) + bonus;
        battle.logs.push(`${BALANCE} 중첩 수 ${balance(actor)}로 위력이 ${bonus} 증가했다.`);
      }
    }
    if (action.isSkill(CHARACTER_ID, 2) && balance(actor) < 1) return false;
    return undefined;
  },

  estimatedPower(_battle, actor, _target, action, power) {
    return action.isSkill(CHARACTER_ID, 0) ? power + balance(actor) * 2 : power;
  },

  attackDamageMultipliers(_battle, choice) {
    return choice.action.isAttack && Number(choice.actor.counters[PRAYER] || 0) > 0
      ? [1 + balance(choice.actor) * 0.2]
      : [];
  },

  estimatedDamageMultipliers(_battle, actor, _target, action) {
    return action.isAttack && Number(actor.counters[PRAYER] || 0) > 0 ? [1 + balance(actor) * 0.2] : [];
  },

  onHitAfterDefenseAsActor(battle, choice) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    if (choice.action.isSkill(CHARACTER_ID, 0)) {
      const [attacks, nonAttacks] = selectedCounts(target);
      battle.fixedDamage(target, Math.max(0, nonAttacks - attacks), choice.action.name, actor);
    } else if (choice.action.isSkill(CHARACTER_ID, 3)) {
      battle.fixedDamage(target, judgmentFixedDamage(target, balance(actor)), choice.action.name, actor);
    }
  },

  applyNonAttackEffects(battle, choice) {
    const actor = choice.actor;
    if (choice.action.isSkill(CHARACTER_ID, 1)) {
      battle.applyDefense(actor, choice.action.name);
      return true;
    }
    if (choice.action.isSkill(CHARACTER_ID, 2)) {
      actor.counters[PRAYER] = 2;
      battle.logs.push(`다음 턴 동안 공격 피해가 x${1 + balance(actor) * 0.2}가 된다.`);
      return true;
    }
    return false;
  },

  onDefenseHit(battle, choice) {
    const attacker = choice.actor;
    const defender = battle.opponent(attacker);
    if (defender.defenseName !== "지킨다는 것의 무거움") return;
    const [attacks, nonAttacks] = selectedCounts(attacker);
    battle.fixedDamage(attacker, Math.max(0, attacks - nonAttacks), defender.defenseName, defender);
  },

  onTurnEnd(battle, fighter) {
    if (battle.turn % 2 !== 0) return;
    const [attacks, nonAttacks] = selectedCounts(fighter);
    if (attacks === nonAttacks) addCounter(battle, fighter, BALANCE, 1);
  },

  decrementCounters(fighter) {
    if (!(PRAYER in fighter.counters)) return;
    const remaining = Number(fighter.counters[PRAYER] || 0);
    if (remaining <= 1) delete fighter.counters[PRAYER];
    else fighter.counters[PRAYER] = remaining - 1;
  },

  modifyFixedDamageToOpponent(battle, actor, _target, amount) {
    const bonus = balance(actor);
    if (bonus <= 0 || amount <= 0) return amount;
    battle.logs.push(`냉혹한 심판자: 고정 피해가 ${bonus} 증가했다.`);
    return amount + bonus;
  },

  setupValue(battle, actor, target, action) {
    const stacks = balance(actor);
    if (action.isSkill(CHARACTER_ID, 1)) {
      const incoming = battle.estimateBestIncomingDamage(target, actor);
      const [attacks, nonAttacks] = selectedCounts(target);
      return incoming * 0.25 + Math.max(0, attacks - nonAttacks) * 150 + stacks * 60;
    }
    if (action.isSkill(CHARACTER_ID, 2) && stacks >= 1) {
      if (Number(actor.counters[PRAYER] || 0) > 0) return 0;
      return 560 + stacks * 300;
    }
    return 0;
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const stacks = balance(actor);
    const [ownAttacks, ownNonAttacks] = selectedCounts(actor);
    const [targetAttacks, targetNonAttacks] = selectedCounts(target);
    const incoming = battle.estimateBestIncomingDamage(target, actor);

    value += balanceTimingValue(battle, action, ownAttacks, ownNonAttacks);

    if (action.isSkill(CHARACTER_ID, 0)) {
      const extra = Math.max(0, targetNonAttacks - targetAttacks);
      value += stacks * 180 + extra * 260 * hitRate;
      if (extra > 0) value += 360;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      const punish = Math.max(0, targetAttacks - targetNonAttacks);
      const incomingWeight = targetAttacks > targetNonAttacks || incoming >= actor.hp * 0.75 ? 0.95 : 0.35;
      value += incoming * incomingWeight + punish * 330;
      if (incoming >= actor.hp) value += 2100;
      if (battle.turn % 2 === 0 && projectedEqual(action, ownAttacks, ownNonAttacks)) value += 460;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      if (stacks < 1) value -= 3200;
      else if (Number(actor.counters[PRAYER] || 0) > 0) value -= 900;
      else {
        value += 780 + stacks * 460;
        if (actor.mp >= JUDGMENT_RESERVE_MP + Math.floor(action.mp / 2)) value += 520;
      }
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      const fixed = judgmentFixedDamage(target, stacks) + stacks;
      value += fixed * 2.8 * hitRate;
      if (expectedDamage + fixed * hitRate >= target.hp) value += 7200;
      else if (actor.mp < battle.effectiveCost(actor, action) + 18) value -= 520;
      if (Number(actor.counters[PRAYER] || 0) > 0) value += expectedDamage * 0.85;
    } else if (action.isCommonAction("meditation")) {
      if (actor.mp < 50) value += 360 + Math.max(0, 64 - actor.mp) * 9;
      if (battle.turn % 2 === 0 && projectedEqual(action, ownAttacks, ownNonAttacks)) value += 520;
      if (actor.mp >= 92) value -= 420;
    } else if (action.isCommonAction("normal_attack")) {
      if (stacks >= 2 && Number(actor.counters[PRAYER] || 0) > 0) value += expectedDamage * 0.7;
    }
    return value;
  },

  wouldConditionFail(_battle, actor, _target, action) {
    return action.isSkill(CHARACTER_ID, 2) ? balance(actor) < 1 : undefined;
  },
};
