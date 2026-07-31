"use strict";

const CHARACTER_ID = "dracle";
const DRAGON = "혁룡";
const DAMAGE_RECORD = "혁룡 피해 기록";
const AWAKENING = "혁룡 각성";
const SCALE_GUARD = "용의 비늘";
const BLOODLUST = "용혈의 투지";
const BASE_MAX_DRAGON = 10;
const AWAKENED_MAX_DRAGON = 15;

function floorInt(value) { return Math.floor(value); }
function dragon(fighter) { return Number(fighter.counters[DRAGON] || 0); }
function awakeningActive(fighter) { return Number(fighter.counters[AWAKENING] || 0) > 0; }
function maxDragon(fighter) { return awakeningActive(fighter) ? AWAKENED_MAX_DRAGON : BASE_MAX_DRAGON; }
function scaleReduction(fighter) { return dragon(fighter) * 4; }
function clawChance(fighter) { return Math.min(100, dragon(fighter) * 10); }
function awakeningReadyMp(action) { return Math.max(60, Number(action?.mp ?? 43) + 17); }
function hasStatEffect(fighter, stat, source) {
  return fighter.statEffects.some((effect) => effect.stat === stat && effect.source === source && Number(effect.remaining || 0) > 0);
}
function dragonGainValue(actor, expectedDamage) {
  if (dragon(actor) >= maxDragon(actor)) return 0;
  const record = Number(actor.counters[DAMAGE_RECORD] || 0);
  const projected = record + Math.max(0, expectedDamage);
  const gained = Math.min(maxDragon(actor) - dragon(actor), floorInt(projected / 15));
  return gained * 520 + Math.min(14, projected % 15) * 18;
}
function rawDamage(expectedDamage, hitRate) { return hitRate > 0 ? expectedDamage / hitRate : 0; }

function addCounter(battle, fighter, name, amount, maxValue) {
  const before = Number(fighter.counters[name] || 0);
  fighter.counters[name] = Math.min(maxValue, before + amount);
  battle.logs.push(`${fighter.name}의 ${name} ${before} -> ${fighter.counters[name]}`);
}

function convertDamageRecord(battle, actor) {
  const record = Number(actor.counters[DAMAGE_RECORD] || 0);
  const current = dragon(actor);
  const maximum = maxDragon(actor);
  const gained = Math.min(maximum - current, floorInt(record / 15));
  if (gained <= 0) return;
  actor.counters[DAMAGE_RECORD] = record - gained * 15;
  actor.counters[DRAGON] = current + gained;
  battle.logs.push(`${actor.name}의 ${DRAGON} ${current}/${maximum} -> ${actor.counters[DRAGON]}/${maximum}`);
}

module.exports = {
  hiddenCounters: [DAMAGE_RECORD, AWAKENING, SCALE_GUARD, BLOODLUST],

  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has(DRAGON)) {
      fighter.counters[DRAGON] = 0;
      fighter.counters[DAMAGE_RECORD] = 0;
    }
  },

  counterStateText(fighter, name, value) {
    return name === DRAGON ? `${DRAGON} ${Number(value)}/${maxDragon(fighter)}` : null;
  },

  counterResourceValue(fighter, name, raw) {
    if (name === DRAGON && Number.isInteger(raw)) return raw * 115;
    if (name === DAMAGE_RECORD && Number.isInteger(raw)) return raw * 8;
    if (name === AWAKENING) return Number(raw || 0) > 0 ? 520 : 0;
    if (name === BLOODLUST) return Number(raw || 0) > 0 ? 190 : 0;
    return null;
  },

  extraStateParts(_battle, fighter) {
    const parts = [];
    const record = Number(fighter.counters[DAMAGE_RECORD] || 0);
    if (record > 0 || dragon(fighter) < maxDragon(fighter)) parts.push(`${DAMAGE_RECORD} ${record}/15`);
    if (Number(fighter.counters[AWAKENING] || 0) > 0) parts.push(`${AWAKENING} ${fighter.counters[AWAKENING]}턴`);
    if (Number(fighter.counters[SCALE_GUARD] || 0) > 0) parts.push(`${SCALE_GUARD}: 공격 피해 -${scaleReduction(fighter)}`);
    if (Number(fighter.counters[BLOODLUST] || 0) > 0) parts.push(`${BLOODLUST}: 공격 피해 x1.1`);
    return parts;
  },

  resetTurnFlags(_battle, fighter) {
    delete fighter.counters[SCALE_GUARD];
  },

  onActionStart(battle, choice) {
    if (choice.action.isSkill(CHARACTER_ID, 0) && dragon(choice.actor) >= 1) {
      battle.restoreMp(choice.actor, 3, choice.action.name);
    }
    return false;
  },

  applyConditionEffects(battle, choice) {
    const amount = dragon(choice.actor);
    if (choice.action.isSkill(CHARACTER_ID, 0) && amount >= 4) {
      const bonus = floorInt(amount * 1.5);
      choice.power = Number(choice.power || 0) + bonus;
      battle.logs.push(`${DRAGON} ${amount}/${maxDragon(choice.actor)} 기준으로 위력이 ${bonus} 증가했다.`);
    }
    if (choice.action.isSkill(CHARACTER_ID, 1) && amount < 1) return false;
    if (choice.action.isSkill(CHARACTER_ID, 3) && (amount < 5 || awakeningActive(choice.actor))) return false;
    return true;
  },

  attackDamageMultipliers(battle, choice) {
    const actor = choice.actor;
    const values = [];
    if (Number(actor.counters[BLOODLUST] || 0) > 0) values.push(1.1);
    if (choice.action.isSkill(CHARACTER_ID, 0) && dragon(actor) >= 7) values.push(1.3);
    if (choice.action.isSkill(CHARACTER_ID, 2)) {
      const chance = clawChance(actor);
      const roll = battle.roll("용의 발톱 피해 증폭");
      battle.logs.push(`용의 발톱 피해 증폭 ${chance}% / 판정값 ${roll.toFixed(2)}`);
      if (roll < chance) values.push(2);
    }
    return values;
  },

  estimatedDamageMultipliers(_battle, actor, _target, action) {
    const values = [];
    if (Number(actor.counters[BLOODLUST] || 0) > 0) values.push(1.1);
    if (action.isSkill(CHARACTER_ID, 0) && dragon(actor) >= 7) values.push(1.3);
    if (action.isSkill(CHARACTER_ID, 2)) values.push(1 + clawChance(actor) / 100);
    return values;
  },

  modifyAttackDamage(battle, _choice, target, damage) {
    if (Number(target.counters[SCALE_GUARD] || 0) <= 0) return damage;
    const reduced = Math.max(1, damage - scaleReduction(target));
    if (reduced < damage) battle.logs.push(`${SCALE_GUARD}로 공격 피해가 ${damage} -> ${reduced}로 감소했다.`);
    return reduced;
  },

  onHitAfterDefenseAsActor(battle, choice, totalDamage) {
    const actor = choice.actor;
    if (totalDamage > 0 && dragon(actor) < maxDragon(actor)) {
      const before = Number(actor.counters[DAMAGE_RECORD] || 0);
      actor.counters[DAMAGE_RECORD] = before + totalDamage;
      battle.logs.push(`${DAMAGE_RECORD} ${before} -> ${actor.counters[DAMAGE_RECORD]}`);
      convertDamageRecord(battle, actor);
    }
    if (choice.action.isSkill(CHARACTER_ID, 0) && dragon(actor) >= 10) {
      battle.reduceMp(battle.opponent(actor), floorInt(totalDamage * 0.3), choice.action.name);
    }
    if (choice.action.isSkill(CHARACTER_ID, 2)) battle.addStatEffect(actor, "atk", 1.2, 3, choice.action.name);
  },

  applyNonAttackEffects(battle, choice) {
    const actor = choice.actor;
    if (choice.action.isSkill(CHARACTER_ID, 1)) {
      actor.counters[SCALE_GUARD] = 1;
      battle.logs.push(`이번 턴 동안 공격 피해가 ${scaleReduction(actor)} 감소한다.`);
      return true;
    }
    if (choice.action.isSkill(CHARACTER_ID, 3)) {
      actor.counters[AWAKENING] = 4;
      addCounter(battle, actor, DRAGON, 5, maxDragon(actor));
      battle.logs.push(`${AWAKENING}으로 ${DRAGON} 최대 중첩이 ${maxDragon(actor)}가 되었다.`);
      convertDamageRecord(battle, actor);
      return true;
    }
    return false;
  },

  finishAction(battle, choice, success, hit) {
    if (choice.action.isCommonAction("normal_attack") && success && hit) {
      choice.actor.counters[BLOODLUST] = 2;
      battle.logs.push(`다음 턴 동안 ${BLOODLUST}로 공격 피해가 1.1배가 된다.`);
    }
  },

  decrementCounters(fighter) {
    if (Number(fighter.counters[BLOODLUST] || 0) > 0) {
      fighter.counters[BLOODLUST] -= 1;
      if (fighter.counters[BLOODLUST] <= 0) delete fighter.counters[BLOODLUST];
    }
    const remaining = Number(fighter.counters[AWAKENING] || 0);
    if (remaining <= 0) return;
    if (remaining <= 1) {
      delete fighter.counters[AWAKENING];
      const before = dragon(fighter);
      fighter.counters[DRAGON] = Math.min(BASE_MAX_DRAGON, Math.max(0, before - 5));
    } else {
      fighter.counters[AWAKENING] = remaining - 1;
    }
  },

  estimatedPower(_battle, actor, _target, action, power) {
    return action.isSkill(CHARACTER_ID, 0) && dragon(actor) >= 4 ? power + floorInt(dragon(actor) * 1.5) : power;
  },

  setupValue(battle, actor, target, action) {
    const amount = dragon(actor);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    if (action.isSkill(CHARACTER_ID, 1)) {
      if (amount < 1 || incoming < actor.hp * 0.45) return 0;
      let value = Math.min(incoming, scaleReduction(actor)) * 55;
      if (incoming >= actor.hp) value += 1200;
      else if (incoming >= actor.hp * 0.45) value += 520;
      return value;
    }
    if (!action.isSkill(CHARACTER_ID, 3) || amount < 5 || awakeningActive(actor)) return 0;
    const readyMp = awakeningReadyMp(action);
    if (actor.mp < readyMp) return -2600 - Math.max(0, readyMp - actor.mp) * 22;
    let value = 2100 + amount * 190 + Number(actor.counters[DAMAGE_RECORD] || 0) * 24;
    if (actor.mp >= readyMp + 10) value += 420;
    if (incoming >= actor.hp) value -= 1500;
    return value;
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const damage = rawDamage(expectedDamage, hitRate);
    const amount = dragon(actor);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const awakeningAction = battle.findActionByInput(actor, `${CHARACTER_ID}:3`);
    const readyMp = awakeningReadyMp(awakeningAction);
    const wantsAwakening = amount >= 5 && !awakeningActive(actor);

    if (action.isCommonAction("normal_attack")) {
      value += 220 + dragonGainValue(actor, damage * hitRate);
      if (actor.mp < 35) value += 180;
    } else if (action.isCommonAction("meditation")) {
      if (wantsAwakening && actor.mp < readyMp) value += 1100 + (readyMp - actor.mp) * 28;
      else if (actor.mp < 45) value += 420;
      if (actor.mp >= 88) value -= 650;
    }

    if (action.isSkill(CHARACTER_ID, 0)) {
      value += 260 + dragonGainValue(actor, damage * hitRate);
      if (amount < 5) value += Math.max(0, 5 - amount) * 120;
      if (amount >= 1) value += 210;
      if (amount >= 4) value += amount * 65;
      if (amount >= 7) value += damage * 0.75;
      if (amount >= 10 && target.mp > 0) value += Math.min(target.mp, floorInt(damage * 0.3)) * 38;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      if (amount < 1) value -= 3200;
      else {
        const reduction = scaleReduction(actor);
        value += Math.min(incoming, reduction) * 70 + amount * 20;
        if (incoming >= actor.hp) value += 1800;
        else if (incoming >= actor.hp * 0.55) value += 820;
        else value -= 520;
        if (incoming <= reduction * 0.45) value -= 260;
        if (wantsAwakening && actor.mp < readyMp) value -= 650;
      }
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      value += dragonGainValue(actor, damage * hitRate);
      value += clawChance(actor) * 12;
      value += (hasStatEffect(actor, "atk", action.name) ? 180 : 520) * hitRate;
      if (damage >= target.hp) value += 3600;
      else if (amount >= 5 && !awakeningActive(actor)) {
        const cost = battle.effectiveCost(actor, action);
        if (actor.mp - cost + battle.turnEndMpRecovery(actor) < readyMp && damage < target.hp * 0.65) value -= 780;
      }
      if (amount >= 8) value += 520;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      if (amount < 5) value -= 4800;
      else if (awakeningActive(actor)) value -= 3600;
      else if (actor.mp < readyMp) value -= 3600 + (readyMp - actor.mp) * 32;
      else {
        value += 3200 + amount * 260 + Number(actor.counters[DAMAGE_RECORD] || 0) * 34;
        if (actor.mp >= readyMp + 10) value += 620;
        if (incoming >= actor.hp) value -= 1800;
      }
    }
    return value;
  },

  wouldConditionFail(_battle, actor, _target, action) {
    if (action.isSkill(CHARACTER_ID, 1)) return dragon(actor) < 1;
    if (action.isSkill(CHARACTER_ID, 3)) return dragon(actor) < 5 || awakeningActive(actor);
    return null;
  },
};
