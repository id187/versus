"use strict";

const CHARACTER_ID = "queenas";
const WARNING_SOLDIER_HP_RATE = 0.1;
const WARNING_SOLDIER_STAT_RATE = 0.75;
const WARNING_TARGET_STAT_MULTIPLIER = 0.8;
const MINION = "영병";
const SOLDIERS = "그림자 병사 목록";
const NEXT_NUMBER = "다음 그림자 병사 번호";
const MAX_SOLDIERS = 5;
const PASSIVE = "여왕의 유흥";

function floorInt(value) { return Math.floor(value); }
function soldiers(fighter) {
  if (!Array.isArray(fighter.counters[SOLDIERS])) fighter.counters[SOLDIERS] = [];
  return fighter.counters[SOLDIERS];
}
function count(fighter) { return soldiers(fighter).length; }
function oldest(fighter) { return soldiers(fighter)[0] || null; }
function sync(fighter) { fighter.counters[MINION] = Math.min(MAX_SOLDIERS, count(fighter)); }
function randomIntInclusive(battle, low, high) { return low + battle.rng.range(high - low + 1); }
function missingSoldierHp(soldier) { return Math.max(0, Number(soldier.maxHp || 0) - Number(soldier.hp || 0)); }
function rawDamage(expectedDamage, hitRate) { return hitRate > 0 ? expectedDamage / hitRate : 0; }

function removeSoldier(fighter, soldier) {
  const list = soldiers(fighter);
  const index = list.indexOf(soldier);
  if (index >= 0) list.splice(index, 1);
  sync(fighter);
}

function logCount(battle, fighter, before) {
  const after = count(fighter);
  if (before !== after) battle.logs.push(`${fighter.name}의 ${MINION} ${before}/${MAX_SOLDIERS} -> ${after}/${MAX_SOLDIERS}`);
}

function summon(battle, fighter, { hp, atk, defense, spd, actionName, power, accuracy }) {
  const before = count(fighter);
  const number = Number(fighter.counters[NEXT_NUMBER] || 1);
  fighter.counters[NEXT_NUMBER] = number + 1;
  soldiers(fighter).push({ number, hp, maxHp: hp, atk, def: defense, spd, actionName, power, accuracy });
  sync(fighter);
  battle.logs.push(`${fighter.name}은 그림자 병사 ${number}을 소환했다. (HP ${hp} / ATK ${atk} / DEF ${defense} / SPD ${spd})`);
  logCount(battle, fighter, before);
}

function shadowAction(soldier) {
  return {
    name: soldier.actionName || "그림자 찌르기", power: Number(soldier.power || 15), accuracy: Number(soldier.accuracy || 95),
    priority: -2, mp: 0, isAttack: true, isActive: false, isDefense: false, key: `${CHARACTER_ID}:shadow:${soldier.number}`,
    isCommonAction: () => false, isSkill: () => false,
  };
}

function shadowAttack(battle, owner, soldier) {
  const target = battle.opponent(owner);
  if (target.hp <= 0) return;
  const action = shadowAction(soldier);
  const choice = { actor: owner, action, cost: 0, priority: -2, power: action.power, accuracy: action.accuracy, hitCount: 1, attackAtkOverride: soldier.atk };
  battle.logs.push(`[${owner.name}의 그림자 병사 ${soldier.number} 행동]`);
  battle.logs.push(`그림자 병사 ${soldier.number}은 ${action.name}을 사용했다.`);
  if (!battle.accuracyCheck(choice)) return;
  const damage = battle.calculateAttackDamage(choice);
  const before = target.hp;
  const canReorderLogs = typeof battle.logs.splice === "function";
  const nestedLogStart = canReorderLogs ? battle.logs.length : 0;
  const result = battle.damage(target, damage, `그림자 병사 ${soldier.number}의 ${action.name} 공격 피해`, true, owner);
  const nestedLogs = canReorderLogs ? battle.logs.splice(nestedLogStart) : [];
  if (result.amount > 0) {
    battle.logs.push(`${target.name}에게 ${result.amount}의 피해. ${target.name} HP ${before} -> ${result.afterHp}`);
    if (nestedLogs.length) battle.logs.push(...nestedLogs);
    if (result.revived) require("./index").printDefeatEscape(battle, target, result.revived);
    if (!battle.gameOver) battle.applyOnHitEffects(choice, result.amount);
  }
  else {
    battle.logs.push(`${target.name}에게 향한 공격 피해가 모두 대신 처리되었다.`);
    if (nestedLogs.length) battle.logs.push(...nestedLogs);
  }
}

module.exports = {
  hiddenCounters: [SOLDIERS, NEXT_NUMBER],

  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has(MINION)) {
      fighter.counters[MINION] = 0;
      fighter.counters[SOLDIERS] = [];
      fighter.counters[NEXT_NUMBER] = 1;
    }
  },

  counterStateText(fighter, name) {
    return name === MINION ? `${MINION} ${count(fighter)}/${MAX_SOLDIERS}` : null;
  },

  counterResourceValue(_fighter, name, raw) {
    if (name === MINION || name === NEXT_NUMBER) return 0;
    if (name !== SOLDIERS || !Array.isArray(raw)) return null;
    return raw.reduce((value, soldier) => value
      + Number(soldier.hp || 0) * 42
      + Number(soldier.power || 0) * 95
      + Math.max(0, Number(soldier.atk ?? 50) - 50) * 5
      + Math.max(0, Number(soldier.def ?? 50) - 50) * 4, 0);
  },

  targetDefenseForAttack(_battle, choice, target, defense) {
    return choice.action.isAttack && oldest(target) ? Number(oldest(target).def) : defense;
  },

  estimatedTargetDefenseForAttack(_battle, _actor, target, action, defense) {
    return action.isAttack && oldest(target) ? Number(oldest(target).def) : defense;
  },

  applyConditionEffects(battle, choice) {
    const amount = count(choice.actor);
    if (choice.action.isSkill(CHARACTER_ID, 0)) {
      choice.hitCount = randomIntInclusive(battle, 1, 1 + amount);
      battle.logs.push(`[연격] ${MINION} ${amount}/${MAX_SOLDIERS} 기준으로 ${choice.hitCount}회로 결정되었다.`);
    } else if ((choice.action.isSkill(CHARACTER_ID, 1) || choice.action.isSkill(CHARACTER_ID, 3)) && amount >= MAX_SOLDIERS) return false;
    else if (choice.action.isSkill(CHARACTER_ID, 2) && amount < 1) return false;
    return true;
  },

  onHitAfterDefenseAsActor(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 2)) return;
    const actor = choice.actor;
    const soldier = oldest(actor);
    if (!soldier) {
      battle.logs.push("돌격시킬 그림자 병사가 없다.");
      return;
    }
    const before = count(actor);
    const fixed = Math.max(0, Number(soldier.maxHp || 0) - Number(soldier.hp || 0));
    removeSoldier(actor, soldier);
    battle.logs.push(`${actor.name}은 그림자 병사 ${soldier.number}을 돌격시켜 제거했다.`);
    logCount(battle, actor, before);
    battle.fixedDamage(battle.opponent(actor), fixed, choice.action.name, actor);
  },

  applyNonAttackEffects(battle, choice) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    if (choice.action.isSkill(CHARACTER_ID, 1)) {
      if (count(actor) >= MAX_SOLDIERS) battle.logs.push(`${MINION}이 이미 최대치다.`);
      else summon(battle, actor, { hp: 15, atk: 50, defense: 50, spd: 50, actionName: "그림자 찌르기", power: 15, accuracy: 95 });
      return true;
    }
    if (choice.action.isSkill(CHARACTER_ID, 3)) {
      if (count(actor) >= MAX_SOLDIERS) battle.logs.push(`${MINION}이 이미 최대치다.`);
      else {
        const [atk, defense, spd] = battle.currentStats(target);
        summon(battle, actor, { hp: floorInt(target.maxHp * WARNING_SOLDIER_HP_RATE), atk: floorInt(atk * WARNING_SOLDIER_STAT_RATE), defense: floorInt(defense * WARNING_SOLDIER_STAT_RATE), spd: floorInt(spd * WARNING_SOLDIER_STAT_RATE), actionName: "자신 찌르기", power: 17, accuracy: 100 });
        for (const stat of ["atk", "def", "spd"]) battle.addStatEffect(target, stat, WARNING_TARGET_STAT_MULTIPLIER, 4, choice.action.name);
      }
      return true;
    }
    return false;
  },

  absorbAttackDamage(battle, target, amount) {
    const soldier = oldest(target);
    if (!soldier) return amount;
    const beforeHp = Math.max(0, Number(soldier.hp || 0));
    if (beforeHp <= 0) {
      removeSoldier(target, soldier);
      return amount;
    }
    const taken = Math.min(beforeHp, Math.max(0, Number(amount)));
    soldier.hp = beforeHp - taken;
    battle.logs.push(`${target.name}의 그림자 병사 ${soldier.number}이 공격 피해 ${taken}을 대신 받았다.`);
    battle.logs.push(`그림자 병사 ${soldier.number} HP ${beforeHp} -> ${soldier.hp}`);
    if (soldier.hp <= 0) {
      const before = count(target);
      removeSoldier(target, soldier);
      battle.logs.push(`그림자 병사 ${soldier.number}이 사라졌다.`);
      logCount(battle, target, before);
    }
    const excess = Math.max(0, Number(amount) - taken);
    if (excess > 0) battle.logs.push(`초과 공격 피해 ${excess}은 무시되었다.`);
    return 0;
  },

  afterActionPhase(battle, fighter) {
    if (fighter.hp <= 0) return;
    for (const soldier of [...soldiers(fighter)]) {
      if (battle.gameOver || fighter.hp <= 0) return;
      if (soldiers(fighter).includes(soldier)) shadowAttack(battle, fighter, soldier);
    }
  },

  onTurnEnd(battle, fighter) {
    const amount = randomIntInclusive(battle, 1, 10);
    battle.logs.push(`${PASSIVE} 피해가 ${amount}로 결정되었다.`);
    const before = fighter.hp;
    const canReorderLogs = typeof battle.logs.splice === "function";
    const nestedLogStart = canReorderLogs ? battle.logs.length : 0;
    const result = battle.damage(fighter, amount, PASSIVE, false, null);
    const nestedLogs = canReorderLogs ? battle.logs.splice(nestedLogStart) : [];
    battle.logs.push(`${fighter.name}은 ${PASSIVE}으로 ${result.amount}의 고정 피해를 입었다. HP ${before} -> ${result.afterHp}`);
    if (nestedLogs.length) battle.logs.push(...nestedLogs);
    if (result.revived) require("./index").printDefeatEscape(battle, fighter, result.revived);
    if (result.amount > 0 && !battle.gameOver) battle.restoreMp(fighter, result.amount, PASSIVE);
  },

  estimatedHitCount(actor, action, useMax) {
    if (!action.isSkill(CHARACTER_ID, 0)) return null;
    const maximum = 1 + count(actor);
    return useMax ? maximum : (1 + maximum) / 2;
  },

  setupValue(battle, actor, target, action) {
    const soldierCount = count(actor);
    if (action.isSkill(CHARACTER_ID, 1)) {
      if (soldierCount >= MAX_SOLDIERS) return 0;
      const incoming = battle.estimateBestIncomingDamage(target, actor);
      let value = -260 + Math.min(18, incoming) * 12;
      if (soldierCount >= 1) value -= soldierCount * 260;
      if (incoming >= actor.hp) value += 1700;
      else if (incoming >= actor.hp * 0.65 && soldierCount === 0) value += 420;
      return value;
    }
    if (action.isSkill(CHARACTER_ID, 3)) {
      if (soldierCount >= MAX_SOLDIERS) return 0;
      const [targetAtk, targetDef, targetSpd] = battle.currentStats(target);
      const dynamicHp = floorInt(target.maxHp * WARNING_SOLDIER_HP_RATE);
      const statBonus = Math.max(0, targetAtk * WARNING_SOLDIER_STAT_RATE - 50) * 8
        + Math.max(0, targetDef * WARNING_SOLDIER_STAT_RATE - 50) * 5
        + Math.max(0, targetSpd * WARNING_SOLDIER_STAT_RATE - 50) * 3
        + Math.max(0, dynamicHp - 15) * 34;
      return 980 + statBonus + Math.min(26, battle.estimateBestIncomingDamage(target, actor)) * 38;
    }
    return 0;
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const damage = rawDamage(expectedDamage, hitRate);
    const soldierCount = count(actor);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const oldestSoldier = oldest(actor);
    const missingMp = Math.max(0, actor.maxMp - actor.mp);
    if (action.isSkill(CHARACTER_ID, 0)) {
      value += soldierCount * 330 + damage * 0.85;
      if (soldierCount >= 1) value += 260;
      if (soldierCount >= 3) value += 520;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      if (soldierCount >= MAX_SOLDIERS) value -= 4800;
      else {
        value += -420 + Math.min(18, incoming) * 14;
        if (actor.hp <= incoming && soldierCount === 0) value += 1800;
        else if (incoming >= actor.hp * 0.65 && soldierCount === 0) value += 520;
        if (actor.mp < 60 && soldierCount === 0 && incoming < actor.hp * 0.65) value -= 260;
        if (soldierCount >= 1) value -= soldierCount * 430;
        if (soldierCount >= 2) value -= 850;
        if (actor.mp < 45) value -= 220;
      }
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      if (!oldestSoldier) value -= 5200;
      else {
        const fixed = missingSoldierHp(oldestSoldier);
        value += fixed * 230 * hitRate;
        if (damage + fixed * hitRate >= target.hp) value += 3600;
        else if (fixed >= 8) value += 980;
        else if (soldierCount >= 4) value += 520;
        if (fixed <= 0) value -= 1200;
        else if (fixed <= 5 && soldierCount <= 2) value -= 520;
      }
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      if (soldierCount >= MAX_SOLDIERS) value -= 5200;
      else {
        const [targetAtk, targetDef, targetSpd] = battle.currentStats(target);
        const dynamicHp = floorInt(target.maxHp * WARNING_SOLDIER_HP_RATE);
        const statBonus = Math.max(0, targetAtk * WARNING_SOLDIER_STAT_RATE - 50) * 11
          + Math.max(0, targetDef * WARNING_SOLDIER_STAT_RATE - 50) * 7
          + Math.max(0, targetSpd * WARNING_SOLDIER_STAT_RATE - 50) * 4
          + Math.max(0, dynamicHp - 15) * 42;
        value += 920 + statBonus + Math.min(24, incoming) * 48;
        if (soldierCount === 0) value += 520;
        if (actor.mp < 55) value -= 320;
      }
    } else if (action.isCommonAction("meditation")) {
      if (actor.mp < 52 && soldierCount === 0) value += 720;
      if (missingMp >= 24 && soldierCount >= 2) value += 480;
      if (actor.mp >= 80) value -= 420;
    }
    return value;
  },

  wouldConditionFail(_battle, actor, _target, action) {
    if (action.isSkill(CHARACTER_ID, 1) || action.isSkill(CHARACTER_ID, 3)) return count(actor) >= MAX_SOLDIERS;
    if (action.isSkill(CHARACTER_ID, 2)) return count(actor) < 1;
    return null;
  },
};
