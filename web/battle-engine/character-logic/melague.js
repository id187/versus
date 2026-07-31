"use strict";

const CHARACTER_ID = "melague";
const PLAGUE = "역병";

function floorInt(value) {
  return Math.floor(value);
}

function recentKindCounts(battle, fighter) {
  return typeof battle.recentKindCounts === "function"
    ? battle.recentKindCounts(fighter)
    : { attack: 0, defense: 0, meditation: 0 };
}

function plagueStacks(fighter) {
  const status = fighter.statuses[PLAGUE];
  return status ? Number(status.stacks) : 0;
}

function onDefenseHit(battle, choice, totalDamage) {
  const actor = choice.actor;
  const target = battle.opponent(actor);
  if (Number(target.counters["병혈 전파"] || 0) > 0 && totalDamage > 0) {
    battle.addStatus(actor, PLAGUE, 4, floorInt(totalDamage * 0.3), target.name, true);
  }
}

module.exports = {
  resetTurnFlags(_battle, fighter) {
    delete fighter.counters["병혈 전파"];
  },

  applyConditionEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return undefined;
    const plague = battle.opponent(choice.actor).statuses[PLAGUE];
    return plague && Number(plague.stacks) >= 4 ? undefined : false;
  },

  onHitAfterDefenseAsActor(battle, choice) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    const action = choice.action;
    if (action.isSkill(CHARACTER_ID, 0)) {
      battle.addStatus(target, PLAGUE, 2, 2, actor.name, true);
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      const plague = target.statuses[PLAGUE];
      if (plague) {
        const spent = floorInt(plague.stacks * 0.5);
        plague.stacks = Math.max(0, plague.stacks - spent);
        battle.logs.push(`${target.name}의 역병 ${spent}중첩을 소모했다.`);
        battle.heal(actor, spent * 4, "항체 활성");
        battle.addStatus(target, PLAGUE, 3, 1, actor.name, true);
      }
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      for (let index = 0; index < 7; index += 1) {
        battle.fixedDamage(target, 1, "시궁의 쥐떼", actor);
        if (battle.gameOver) return;
      }
    }
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 2)) return false;
    battle.addStatEffect(choice.actor, "def", 0.8, 1, choice.action.name);
    choice.actor.counters["병혈 전파"] = 1;
    return true;
  },

  onDefenseHit,
  onHitAfterDefenseAsTarget: onDefenseHit,

  onFixedDamageToOpponent(battle, actor, target, amount) {
    if (amount <= 0) return;
    const roll = battle.roll("상처 감염");
    battle.logs.push(`상처 감염 30% / 판정값 ${roll.toFixed(2)}`);
    if (roll < 30) battle.addStatus(target, PLAGUE, 2, 1, actor.name, true);
  },

  preCharacterTurnEnd(battle, fighter) {
    const plague = fighter.statuses[PLAGUE];
    if (plague) battle.fixedDamage(fighter, plague.stacks, `역병 ${plague.stacks}중첩`, fighter);
  },

  wouldConditionFail(_battle, _actor, target, action) {
    if (!action.isSkill(CHARACTER_ID, 1)) return undefined;
    const plague = target.statuses[PLAGUE];
    return !plague || Number(plague.stacks) < 4;
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const plague = plagueStacks(target);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const counts = recentKindCounts(battle, target);
    const attackRead = Number(counts.attack || 0) * 1.3;
    const nonAttackRead = Number(counts.defense || 0) + Number(counts.meditation || 0);
    const missingHp = Math.max(0, actor.maxHp - actor.hp);

    if (action.isSkill(CHARACTER_ID, 0)) {
      if (plague < 4) value += (4 - plague) * 260 * hitRate;
      else if (plague >= 7) value -= 320;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      if (plague >= 4) {
        const spent = floorInt(plague * 0.5);
        value += spent * (260 + Math.min(12, missingHp) * 10);
        if (actor.hp < actor.maxHp * 0.55) value += spent * 180;
        if (plague >= 8) value += 520;
      }
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      const expectedPlague = floorInt(incoming * 0.3);
      if (incoming <= 0 || expectedPlague <= 0) {
        value -= 700;
      } else {
        value += expectedPlague * 180;
        if (plague < 4) value += Math.min(4 - plague, expectedPlague) * 360;
        if (incoming >= 28) value += Math.min(900, incoming * 18);
        if (incoming >= 35) value += 1800;
        if (attackRead > nonAttackRead) {
          value += Math.min(900, (attackRead - nonAttackRead) * 420);
          if (incoming >= 35) value += 5200;
        } else if (nonAttackRead > attackRead + 1) {
          value -= Math.min(850, (nonAttackRead - attackRead) * 320);
        }
      }
      if (actor.hp <= incoming * 1.2 + 4) value -= 2400;
      else if (actor.hp <= incoming * 1.55) value -= 650;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      value += 7 * 45;
      if (expectedDamage + 7 >= target.hp) value += 2200;
      else if (plague < 4) value += 420;
      if (actor.mp < 55 && target.hp > expectedDamage + 7) value -= 420;
    } else if (action.isCommonAction("meditation")) {
      if (actor.mp < 27 && plague >= 3) value += 520;
      else if (actor.mp < 20) value += 260;
    }
    if (action.isCommonAction("normal_attack") && plague < 4) value -= 180;
    return value;
  },
};
