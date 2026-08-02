"use strict";

const CHARACTER_ID = "charinel";

function floorInt(value) {
  return Math.floor(value);
}

function addCounter(battle, fighter, name, amount, maxValue = null) {
  if (typeof battle.addCounter === "function") {
    battle.addCounter(fighter, name, amount, maxValue);
    return;
  }
  const before = Number(fighter.counters[name] || 0);
  let after = before + Number(amount);
  if (maxValue != null) after = Math.min(after, Number(maxValue));
  fighter.counters[name] = after;
  battle.logs.push(`${fighter.name}의 ${name} ${before} -> ${after}`);
}

function actionKindForKey(fighter, key) {
  if (key === "common:normal_attack") return "attack";
  if (key === "common:defense") return "defense";
  if (key === "common:meditation") return "meditation";
  const [id, slotText] = String(key).split(":");
  const skill = id === fighter.characterId ? fighter.data.skills?.[Number(slotText)] : null;
  if (!skill) return null;
  if (skill.power != null) return "attack";
  if (String(skill.description || "").includes("자신이 이 턴에 입는 공격 피해를 경감")) return "defense";
  return null;
}

function recentKindCounts(battle, fighter, limit = 4) {
  if (typeof battle.recentKindCounts === "function") return battle.recentKindCounts(fighter, limit);
  const counts = { attack: 0, defense: 0, meditation: 0 };
  let history = fighter.selectedHistory;
  if (Object.prototype.hasOwnProperty.call(battle.record.selected, fighter.side)) history = history.slice(0, -1);
  for (const key of history.slice(-limit)) {
    const kind = actionKindForKey(fighter, key);
    if (kind) counts[kind] += 1;
  }
  return counts;
}

module.exports = {
  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has("집광")) fighter.counters["집광"] = 0;
  },

  setupValue(_battle, _actor, _target, action) {
    return action.isCommonAction("meditation") || action.isSkill(CHARACTER_ID, 1) ? 180 : 0;
  },

  turnEndMpBonus(fighter) {
    return Number(fighter.counters["집광"] || 0);
  },

  estimatedPower(battle, actor, _target, action, power) {
    const remainingMp = Math.max(0, actor.mp - battle.effectiveCost(actor, action));
    const focus = Number(actor.counters["집광"] || 0);
    let value = power;
    if (action.isSkill(CHARACTER_ID, 0) && focus >= 1) value += floorInt(remainingMp * 0.2);
    if (action.isSkill(CHARACTER_ID, 3)) value += floorInt(remainingMp * 1.4);
    return value;
  },

  estimatedDamageMultipliers(_battle, actor, _target, action) {
    if (!action.isSkill(CHARACTER_ID, 3)) return [];
    const focus = Number(actor.counters["집광"] || 0);
    return focus >= 1 ? [1 + focus * 0.05] : [];
  },

  applyConditionEffects(battle, choice) {
    const actor = choice.actor;
    const action = choice.action;
    const focus = Number(actor.counters["집광"] || 0);
    if (action.isSkill(CHARACTER_ID, 2) && focus < 1) return false;
    if (action.isSkill(CHARACTER_ID, 3) && actor.mp >= 1) {
      const extra = actor.mp;
      actor.mp = 0;
      choice.consumedMpExtra = extra;
      const powerAdd = floorInt(extra * 1.4);
      choice.power = Number(choice.power || 0) + powerAdd;
      battle.logs.push(`현재 MP ${extra}를 모두 소모해 위력이 ${powerAdd} 증가했다.`);
    }
    if (action.isSkill(CHARACTER_ID, 0) && focus >= 1) {
      const powerAdd = floorInt(actor.mp * 0.2);
      choice.power = Number(choice.power || 0) + powerAdd;
      battle.logs.push(`현재 MP의 20%로 위력이 ${powerAdd} 증가했다.`);
    }
    return undefined;
  },

  attackDamageMultipliers(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 3)) return [];
    const actor = choice.actor;
    const focus = Number(actor.counters["집광"] || 0);
    if (focus < 1) return [];
    actor.counters["집광"] = 0;
    battle.logs.push(`집광 ${focus}을 모두 소모해 피해 배율이 증가했다.`);
    return [1 + focus * 0.05];
  },

  onHitAfterDefenseAsActor(battle, choice) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    const action = choice.action;
    if (action.isSkill(CHARACTER_ID, 0)) {
      addCounter(battle, actor, "집광", 1);
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      const targetSucceeded = Boolean(battle.record.actionSuccess[target.side]);
      const targetKind = battle.record.selectedKind[target.side];
      if (targetSucceeded && !battle.kindIsAttack(targetKind)) {
        actor.counters["집광"] = Math.max(0, Number(actor.counters["집광"] || 0) - 1);
        const reduced = battle.reduceMp(target, 15, "흡광옥");
        battle.restoreMp(actor, reduced, "흡광옥");
      }
    }
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    battle.fixedDamage(choice.actor, 8, "광폭화", choice.actor);
    if (!battle.gameOver) addCounter(battle, choice.actor, "집광", 4);
    return true;
  },

  finishAction(battle, choice, success) {
    if (choice.action.isCommonAction("meditation") && success) {
      addCounter(battle, choice.actor, "집광", 1);
      choice.actor.lastMeditationSuccessTurn = battle.turn;
    }
  },

  onDamageTaken(battle, target, amount, attack) {
    if (attack) battle.restoreMp(target, floorInt(amount * 0.2), "빛을 향한 믿음");
  },

  wouldConditionFail(_battle, actor, _target, action) {
    return action.isSkill(CHARACTER_ID, 2) ? Number(actor.counters["집광"] || 0) < 1 : undefined;
  },

  aiScore(battle, actor, target, action, expectedDamage) {
    let value = 0;
    const focus = Number(actor.counters["집광"] || 0);
    const counts = recentKindCounts(battle, target);
    const nonAttackRead = counts.defense * 1.2 + counts.meditation * 1.2;
    const attackRead = counts.attack;
    const incoming = battle.estimateBestIncomingDamage(target, actor);

    if (action.isSkill(CHARACTER_ID, 0)) {
      value += 180;
      if (focus >= 1) value += Math.min(520, actor.mp * 8);
    }
    if (action.isSkill(CHARACTER_ID, 1)) {
      const emergency = incoming >= actor.hp;
      if (focus < 4 && !emergency) {
        value += 3600;
        if (actor.mp >= 50) value += 1600;
        if (actor.hp < actor.maxHp * 0.35) value -= 900;
      } else {
        value += 220;
      }
      if (actor.mp < 35) value -= 180;
      if (actor.hp <= 16) value -= 1600;
    }
    if (action.isSkill(CHARACTER_ID, 2)) {
      value -= 450;
      if (nonAttackRead >= attackRead + 1 && focus >= 2) value += 620 + nonAttackRead * 430;
      if (target.mp >= 35 && nonAttackRead >= attackRead + 1 && focus >= 2) value += Math.min(500, target.mp * 7);
      if (focus <= 1) value -= 700;
      else if (focus >= 4 && nonAttackRead <= attackRead) value -= 500;
      if (attackRead > nonAttackRead) value -= Math.min(850, (attackRead - nonAttackRead) * 360);
    }
    if (action.isSkill(CHARACTER_ID, 3)) {
      const lethal = expectedDamage >= target.hp;
      const emergency = incoming >= actor.hp;
      const charged = (actor.mp >= 70 && focus >= 4) || (actor.mp >= 60 && focus >= 8);
      if (lethal) value += 5200 + expectedDamage * 2.2;
      else if (emergency) value += 2600 + expectedDamage * 1.8;
      else if (charged) value += 3000 + expectedDamage * 1.8;
      else {
        value -= 2200;
        value -= Math.max(0, 70 - actor.mp) * 12;
        value -= Math.max(0, 4 - focus) * 360;
      }
    }
    if (action.isCommonAction("meditation")) {
      value += 360 + Math.max(0, 70 - actor.mp) * 8;
      if (focus < 4) value += 260;
      if (incoming < actor.hp && actor.mp < 70) value += 300;
    }
    return value;
  },
};
