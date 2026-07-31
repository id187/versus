"use strict";

const CHARACTER_ID = "neroko";
const LIVES = "잔기";
const DESPERATE = "죽을 힘을 다해";
const COMPANION = "길동무 잔기";

function floorInt(value) { return Math.floor(value); }
function rawDamage(expectedDamage, hitRate) { return hitRate > 0 ? expectedDamage / hitRate : 0; }

module.exports = {
  hiddenCounters: [DESPERATE, COMPANION],

  adjustInitialStats(fighter) {
    fighter.maxHp = Math.max(1, floorInt(fighter.maxHp / 9));
    fighter.hp = fighter.maxHp;
  },

  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has(LIVES)) fighter.counters[LIVES] = 8;
  },

  counterStateText(_fighter, name, value) {
    return name === LIVES ? `${LIVES} ${Number(value)}/8` : null;
  },

  counterResourceValue(_fighter, name, raw) {
    if (name === COMPANION) return 0;
    if (name === DESPERATE) {
      if (raw === 1) return 120;
      if (raw === 2) return -150;
      return 0;
    }
    if (name === LIVES && Number.isInteger(raw)) return raw * 220;
    return null;
  },

  extraStateParts(_battle, fighter) {
    const parts = [];
    const state = Number(fighter.counters[DESPERATE] || 0);
    if (state === 1) parts.push("죽을 힘을 다해: ATK x2");
    else if (state === 2) parts.push("죽을 힘을 다해 반동: ATK x0.5 · 선택 불가");
    if (fighter.counters[COMPANION] != null) parts.push(`길동무 기록 ${fighter.counters[COMPANION]}잔기`);
    return parts;
  },

  modifyStats(_battle, fighter, atk, defense, spd) {
    const state = Number(fighter.counters[DESPERATE] || 0);
    if (state === 1) atk *= 2;
    else if (state === 2) atk *= 0.5;
    return [atk, defense, spd];
  },

  isLegalChoice(_battle, fighter, action) {
    if (action.isSkill(CHARACTER_ID, 1) && Number(fighter.counters[DESPERATE] || 0) === 2) return false;
    return null;
  },

  targetEvasion(_battle, _target, choice, evasion) {
    return choice.action.isAttack ? evasion + 9 : evasion;
  },

  estimateTargetEvasion(_battle, _target, action, evasion) {
    return action.isAttack ? evasion + 9 : evasion;
  },

  applyConditionEffects(battle, choice) {
    if (choice.action.isSkill(CHARACTER_ID, 0)) {
      const lives = Number(choice.actor.counters[LIVES] || 0);
      const bonus = Math.max(0, 9 - lives);
      choice.power = Number(choice.power || 0) + bonus;
      battle.logs.push(`잔기 ${lives}/8 기준으로 위력이 ${bonus} 증가했다.`);
    }
    return true;
  },

  applyNonAttackEffects(battle, choice) {
    const actor = choice.actor;
    if (choice.action.isSkill(CHARACTER_ID, 1)) {
      actor.counters[DESPERATE] = 1;
      battle.logs.push(`${actor.name}의 ATK가 잔기를 소모할 때까지 x2가 된다.`);
      return true;
    }
    if (choice.action.isSkill(CHARACTER_ID, 2)) {
      actor.counters[COMPANION] = Number(actor.counters[LIVES] || 0);
      battle.logs.push(`현재 잔기 ${actor.counters[COMPANION]}/8을 길동무 기준으로 기록했다.`);
      return true;
    }
    if (choice.action.isSkill(CHARACTER_ID, 3)) {
      if (Number(actor.counters[LIVES] || 0) >= 8) battle.logs.push(`${actor.name}의 잔기: 이미 최대치다.`);
      else {
        const before = Number(actor.counters[LIVES] || 0);
        actor.counters[LIVES] = Math.min(8, before + 1);
        battle.logs.push(`${actor.name}의 잔기 ${before}/8 -> ${actor.counters[LIVES]}/8`);
      }
      return true;
    }
    return false;
  },

  onTurnEnd(battle, fighter) {
    const recorded = fighter.counters[COMPANION];
    delete fighter.counters[COMPANION];
    if (recorded != null && Number(fighter.counters[LIVES] || 0) < Number(recorded)) {
      battle.fixedDamage(battle.opponent(fighter), 30, "길동무", fighter);
    }
  },

  consumeDefeatEscape(_battle, fighter) {
    const beforeLives = Number(fighter.counters[LIVES] || 0);
    if (beforeLives <= 0) return null;
    const previousDesperation = Number(fighter.counters[DESPERATE] || 0);
    const companionRecord = fighter.counters[COMPANION];
    const afterLives = Math.max(0, beforeLives - 1);
    fighter.statuses = {};
    fighter.statEffects = [];
    fighter.costEffects = [];
    fighter.forbiddenActionKey = null;
    fighter.forbiddenRemaining = 0;
    fighter.defenseMult = null;
    fighter.defenseName = null;
    fighter.evasionChance = 0;
    fighter.guaranteedEvasion = false;
    fighter.counters = { [LIVES]: afterLives };
    if (companionRecord != null) fighter.counters[COMPANION] = companionRecord;
    const newDesperation = previousDesperation === 1 ? 2 : 0;
    if (newDesperation) fighter.counters[DESPERATE] = newDesperation;
    fighter.hp = fighter.maxHp;
    return [beforeLives, afterLives, previousDesperation, newDesperation];
  },

  printDefeatEscape(battle, fighter, revive) {
    const [beforeLives, afterLives, previousDesperation, newDesperation] = revive;
    battle.logs.push(`${fighter.name}의 잔기 ${beforeLives}/8 -> ${afterLives}/8`);
    battle.logs.push(`${fighter.name} HP 회복 0 -> ${fighter.hp} (잔기)`);
    if (previousDesperation === 1 && newDesperation === 2) {
      battle.logs.push(`${fighter.name}의 ATK가 죽을 힘을 다해 반동으로 x0.5가 된다.`);
    } else if (previousDesperation === 2) {
      battle.logs.push("죽을 힘을 다해 반동과 선택 제한이 해제되었다.");
    }
  },

  estimatedPower(_battle, actor, _target, action, power) {
    return action.isSkill(CHARACTER_ID, 0) ? power + Math.max(0, 9 - Number(actor.counters[LIVES] || 0)) : power;
  },

  setupValue(battle, actor, target, action) {
    if (action.isSkill(CHARACTER_ID, 1)) return Number(actor.counters[DESPERATE] || 0) !== 1 ? 360 : 80;
    if (action.isSkill(CHARACTER_ID, 2)) {
      const incoming = battle.estimateBestIncomingDamage(target, actor);
      if (Number(actor.counters[LIVES] || 0) > 0 && actor.hp <= incoming) return 520;
      return 120;
    }
    if (action.isSkill(CHARACTER_ID, 3)) return (8 - Number(actor.counters[LIVES] || 0)) * 180;
    return 0;
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const damage = rawDamage(expectedDamage, hitRate);
    const lives = Number(actor.counters[LIVES] || 0);
    const desperateState = Number(actor.counters[DESPERATE] || 0);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const counts = battle.recentKindCounts(target);
    const lifeLossExpected = lives > 0 && incoming >= actor.hp;
    const companionReady = Object.hasOwn(actor.counters, COMPANION);

    if (action.isSkill(CHARACTER_ID, 0)) {
      value += Math.max(0, 9 - lives) * 160;
      if (desperateState === 1) value += damage * 0.8 + 260;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      if (desperateState === 0) {
        value += 430;
        if (lifeLossExpected && counts.attack > 0) value += 760;
        if (actor.mp < 27) value += 220;
      } else value -= 280;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      if (companionReady) value -= 520;
      else if (lifeLossExpected) value += 2500 + counts.attack * 420;
      else if (counts.attack >= 2) value += 840;
      else value += 120;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      const missingLives = Math.max(0, 8 - lives);
      if (missingLives <= 0) value -= 1200;
      else if (!lifeLossExpected) value += missingLives * 260;
      if (lifeLossExpected) value -= 900;
      if (actor.mp < 75) value -= 380;
    } else if (action.isCommonAction("meditation")) {
      if (actor.mp < 27 && !companionReady) value += 620;
      if (lifeLossExpected && counts.attack > 0) value += 460;
      if (actor.mp >= 90) value -= 360;
    }
    return value;
  },
};
