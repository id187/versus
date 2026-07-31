"use strict";

const CHARACTER_ID = "nihfle";

function recentKindCounts(battle, fighter) {
  return typeof battle.recentKindCounts === "function"
    ? battle.recentKindCounts(fighter)
    : { attack: 0, defense: 0, meditation: 0 };
}

function freezeRemovedRecord(battle) {
  if (!battle.record.freezeRemoved) battle.record.freezeRemoved = {};
  return battle.record.freezeRemoved;
}

function onDefenseHit(battle, choice) {
  const actor = choice.actor;
  const target = battle.opponent(actor);
  if (target.defenseName === "절대영도" && battle.roll("빙결 부여") < 90) {
    battle.addStatus(actor, "빙결", 4, 1, target.name);
  }
}

module.exports = {
  extraStateParts(battle, fighter) {
    return fighter.lastMeditationSuccessTurn === battle.turn - 1 ? ["빙결 부여 확률 +10%p"] : [];
  },

  onActionStartAfterParalysis(battle, choice) {
    const actor = choice.actor;
    if (!actor.statuses["빙결"] || choice.action.isAttack) return false;
    delete actor.statuses["빙결"];
    freezeRemovedRecord(battle)[actor.side] = true;
    battle.logs.push("빙결로 비공격 행동에 실패하고 빙결이 해제되었다.");
    return true;
  },

  defenseScoreBonusReduction(_actor, action) {
    return action.isSkill(CHARACTER_ID, 3) ? 0.5 : 0;
  },

  applyConditionEffects(battle, choice) {
    const target = battle.opponent(choice.actor);
    if (choice.action.isSkill(CHARACTER_ID, 1) && freezeRemovedRecord(battle)[target.side]) {
      choice.power = Number(choice.power || 0) + 10;
      battle.logs.push("이번 턴 상대의 빙결이 해제되어 위력이 10 증가했다.");
    }
    return undefined;
  },

  attackDamageMultipliers(battle, choice) {
    const target = battle.opponent(choice.actor);
    return choice.action.isSkill(CHARACTER_ID, 2) && target.statuses["빙결"] ? [3] : [];
  },

  estimatedDamageMultipliers(_battle, _actor, target, action) {
    return action.isSkill(CHARACTER_ID, 2) && target.statuses["빙결"] ? [3] : [];
  },

  onHitAfterDefenseAsActor(battle, choice) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    const action = choice.action;
    if (action.isSkill(CHARACTER_ID, 0)) {
      if (target.statuses["빙결"]) {
        battle.addStatEffect(target, "def", 0.8, 3, action.name);
        battle.addStatEffect(target, "spd", 0.8, 3, action.name);
      }
      const chance = 85 + (actor.lastMeditationSuccessTurn === battle.turn - 1 ? 10 : 0);
      if (battle.roll("빙결 부여") < chance) battle.addStatus(target, "빙결", 2, 1, actor.name);
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      let chance = 30;
      if (freezeRemovedRecord(battle)[target.side]) chance += 50;
      if (actor.lastMeditationSuccessTurn === battle.turn - 1) chance += 10;
      if (battle.roll("빙결 부여") < chance) battle.addStatus(target, "빙결", 3, 1, actor.name);
    } else if (action.isSkill(CHARACTER_ID, 2) && target.statuses["빙결"]) {
      delete target.statuses["빙결"];
      freezeRemovedRecord(battle)[target.side] = true;
      battle.logs.push(`${target.name}의 빙결이 해제되었다.`);
    }
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 3)) return false;
    battle.applyDefense(choice.actor, choice.action.name, 0.5);
    return true;
  },

  onDefenseHit,
  onHitAfterDefenseAsTarget: onDefenseHit,

  finishAction(battle, choice, success) {
    if (choice.action.isCommonAction("meditation") && success) {
      choice.actor.lastMeditationSuccessTurn = battle.turn;
    }
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const frozenStatus = target.statuses["빙결"];
    const frozen = Boolean(frozenStatus);
    const freezeRemaining = frozenStatus ? Number(frozenStatus.remaining || 0) : 0;
    const freezeRemoved = Boolean(freezeRemovedRecord(battle)[target.side]);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const counts = recentKindCounts(battle, target);
    let attackRead = Number(counts.attack || 0) * 1.35;
    let escapeRead = Number(counts.defense || 0) * 1.25 + Number(counts.meditation || 0);
    if (target.mp < 25) escapeRead += 0.35;
    if (target.hp <= expectedDamage) attackRead += 0.75;

    if (action.isCommonAction("normal_attack")) {
      value -= 220;
      if (frozen) value -= 850;
    }

    if (frozen && action.isSkill(CHARACTER_ID, 2)) {
      value += expectedDamage * 2.4 + 2700;
      value += Math.max(0, attackRead - escapeRead) * 700;
      if (freezeRemaining <= 1) value += 800;
      if (expectedDamage >= target.hp) value += 3600;
      if (escapeRead > attackRead + 1) value -= Math.min(1100, (escapeRead - attackRead - 1) * 450);
    } else if (frozen && action.isAttack && freezeRemaining <= 1) {
      value -= 650;
    }

    if (action.isSkill(CHARACTER_ID, 0)) {
      if (frozen) value += freezeRemaining >= 2 ? 260 : -300;
      else {
        value += 480 * hitRate;
        if (actor.mp < 36 && expectedDamage < target.hp) value -= 1200;
        else if (actor.mp >= 46) value += 420;
      }
    }
    if (action.isSkill(CHARACTER_ID, 1)) {
      if (freezeRemoved) value += 1100;
      else if (frozen) {
        value += Math.max(0, escapeRead - attackRead) * 650;
        if (freezeRemaining <= 1) value += 500;
        if (attackRead >= escapeRead + 1) value -= 350;
      }
    }
    if (action.isSkill(CHARACTER_ID, 3)) {
      value += incoming * 1.45;
      if (incoming > 0) value += 420;
      if (frozen) value += attackRead * 260;
      else if (actor.hp <= incoming * 1.5) value += 520;
    }
    if (action.isCommonAction("meditation")) {
      if (!frozen && actor.mp < 36) value += 1100;
      else if (actor.mp < 46) value += 420;
      if (frozen && actor.mp < 25 && freezeRemaining >= 2) value += 850;
    }
    return value;
  },
};
