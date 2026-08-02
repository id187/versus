"use strict";

const CHARACTER_ID = "ashend";

function log(battle, message) {
  battle.logs.push(message);
}

function recentKindCounts(battle, fighter) {
  return typeof battle.recentKindCounts === "function"
    ? battle.recentKindCounts(fighter)
    : { attack: 0, defense: 0, meditation: 0 };
}

function modifyAccuracyStatus(_battle, choice, _target, accuracy) {
  if (choice.actor.statuses["회진"] && choice.action.isAttack) return accuracy * 0.8;
  return accuracy;
}

module.exports = {
  extraStateParts(_battle, fighter) {
    const parts = [];
    if (Number(fighter.counters["재로부터의 엄습"] || 0) > 0) parts.push("다음 공격 피해 x1.5");
    if (Number(fighter.counters["재가 되어 회피"] || 0) > 0) {
      parts.push(`공격 회피 50% · ${fighter.counters["재가 되어 회피"]}턴`);
    }
    return parts;
  },

  resetTurnFlags(_battle, fighter) {
    if (Number(fighter.counters["재가 되어 회피"] || 0) > 0) fighter.evasionChance += 50;
  },

  modifyAccuracyStatus,

  applyConditionEffects() {
    return true;
  },

  modifyAttackPower(battle, choice, power) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    if (
      choice.action.isSkill(CHARACTER_ID, 2)
      && Number(battle.record.attackDamageTaken[actor.side] || 0) <= 0
      && target.statuses["회진"]
    ) {
      choice.power = Number(choice.power || 0) + Number(target.statuses["회진"].remaining || 0) * 8;
      return Math.trunc(choice.power);
    }
    return power;
  },

  estimatedPower(battle, actor, target, action, power) {
    if (
      action.isSkill(CHARACTER_ID, 2)
      && Number(battle.record.attackDamageTaken[actor.side] || 0) <= 0
      && target.statuses["회진"]
    ) {
      return power + Number(target.statuses["회진"].remaining || 0) * 8;
    }
    return power;
  },

  attackDamageMultipliers(_battle, choice) {
    return Number(choice.actor.counters["재로부터의 엄습"] || 0) > 0 ? [1.5] : [];
  },

  onHitAfterDefenseAsActor(battle, choice) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    if (choice.action.isSkill(CHARACTER_ID, 0)) {
      const turns = 2 + battle.rng.range(4);
      log(battle, `회진 지속시간 ${turns}턴으로 결정되었다.`);
      battle.addStatus(target, "회진", turns, 1, actor.name);
    } else if (choice.action.isSkill(CHARACTER_ID, 2)) {
      battle.addStatus(target, "회진", 2, 1, actor.name);
    }
  },

  applyNonAttackEffects(battle, choice) {
    const actor = choice.actor;
    if (choice.action.isSkill(CHARACTER_ID, 1)) {
      actor.guaranteedEvasion = true;
      log(battle, "이번 턴 이후 상대 공격에 대한 회피 판정이 반드시 성공한다.");
      return true;
    }
    if (choice.action.isSkill(CHARACTER_ID, 3)) {
      actor.evasionChance += 50;
      actor.counters["재가 되어 회피"] = 4;
      log(battle, "4턴 동안 상대의 공격을 50% 확률로 회피한다.");
      return true;
    }
    return false;
  },

  onTurnEnd(battle, fighter) {
    const opponent = battle.opponent(fighter);
    const opponentAttacked = battle.kindIsAttack(battle.record.selectedKind[opponent.side]);
    const avoidedDamage = Number(battle.record.attackDamageTaken[fighter.side] || 0) <= 0;
    if (opponentAttacked && avoidedDamage) {
      fighter.counters["재로부터의 엄습"] = 2;
      log(battle, `${fighter.name}은 다음 턴 공격 피해가 1.5배가 된다.`);
    }
    if (battle.record.selectedKey[fighter.side] === `${CHARACTER_ID}:1` && opponentAttacked && avoidedDamage) {
      battle.addStatEffect(fighter, "atk", 1.4, 4, "회색의 안개 속으로");
    }
  },

  decrementCounters(fighter) {
    if (Number(fighter.counters["재로부터의 엄습"] || 0) > 0) fighter.counters["재로부터의 엄습"] -= 1;
    if (Number(fighter.counters["재가 되어 회피"] || 0) > 0) fighter.counters["재가 되어 회피"] -= 1;
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const dust = target.statuses["회진"];
    const dustRemaining = dust ? Number(dust.remaining || 0) : 0;
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const counts = recentKindCounts(battle, target);
    const attackRead = Number(counts.attack || 0);
    const ambushReady = Number(actor.counters["재로부터의 엄습"] || 0) > 0;
    if (ambushReady && action.isAttack) value += expectedDamage * 0.7 + 260;
    if (action.isSkill(CHARACTER_ID, 0)) {
      value += dust ? (dustRemaining <= 1 ? 220 : -120) : 540 * hitRate;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      value += incoming * 2.1 + attackRead * 420;
      if (incoming > 0) value += 760;
      if (attackRead >= 2 && Number(actor.counters["재가 되어 회피"] || 0) <= 0) value += 620;
      if (ambushReady) value -= 220;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      if (dust) {
        value += dustRemaining * 340 + expectedDamage * 1.1;
        if (ambushReady) value += 900 + expectedDamage * 0.8;
        if (expectedDamage >= target.hp) value += 2600;
      } else value -= 260;
      if (incoming > actor.hp * 0.25 && attackRead > 0) value -= 250;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      value += incoming * 1.35 + attackRead * 260;
      if (Number(actor.counters["재가 되어 회피"] || 0) <= 0) value += 620;
      if (actor.hp <= incoming) value += 480;
    }
    return value;
  },
};

module.exports.borrowedEffects = {
  extraStateParts: module.exports.extraStateParts,
  resetTurnFlags: module.exports.resetTurnFlags,
  attackDamageMultipliers: module.exports.attackDamageMultipliers,
  estimatedDamageMultipliers(_battle, actor) {
    return Number(actor.counters["재로부터의 엄습"] || 0) > 0 ? [1.5] : [];
  },
  decrementCounters: module.exports.decrementCounters,
};
