"use strict";

const CHARACTER_ID = "toxiche";

function floorInt(value) {
  return Math.floor(value);
}

module.exports = {
  hiddenCounters: ["신려탈피"],

  modifyPriority(_battle, fighter, action, priority) {
    return action.isActive && Number(fighter.counters["신려탈피"] || 0) > 0 ? priority + 1 : priority;
  },

  attackDamageMultipliers(battle, choice) {
    return battle.isActorFirst(choice) ? [1.3] : [];
  },

  estimatedDamageMultipliers() {
    return [1.15];
  },

  applyConditionEffects(battle, choice) {
    const target = battle.opponent(choice.actor);
    if (choice.action.isSkill(CHARACTER_ID, 3) && battle.record.selectedKind[target.side] === "방어") {
      choice.power = Number(choice.power || 0) + 16;
      battle.logs.push("상대가 [방어] 행동을 선택해 위력이 16 증가했다.");
    }
    return true;
  },

  onHitAfterDefenseAsActor(battle, choice, totalDamage) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    const action = choice.action;
    if (action.isSkill(CHARACTER_ID, 0)) {
      if (battle.roll("마비 부여") < 80) battle.addStatus(target, "마비", 3, 1, actor.name);
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      if (target.statuses["마비"]) {
        battle.heal(actor, floorInt(totalDamage * 0.7), "신사지교");
      } else if (!battle.kindIsAttack(battle.record.selectedKind[target.side]) || battle.isActorFirst(choice)) {
        battle.heal(actor, floorInt(totalDamage * 0.5), "신사지교");
      }
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      if (battle.record.selectedKind[target.side] === "방어" && battle.isActorFirst(choice)) {
        battle.addStatus(target, "마비", 4, 1, actor.name);
      }
    }
  },

  applyNonAttackEffects(battle, choice) {
    const actor = choice.actor;
    const action = choice.action;
    if (!action.isSkill(CHARACTER_ID, 1)) return false;
    battle.addStatEffect(actor, "atk", 1.6, 4, action.name);
    battle.addStatEffect(actor, "def", 0.8, 4, action.name);
    actor.counters["신려탈피"] = 2;
    battle.logs.push("다음 턴 액티브 스킬의 우선도가 1 증가한다.");
    return true;
  },

  decrementCounters(fighter) {
    if (Number(fighter.counters["신려탈피"] || 0) > 0) {
      fighter.counters["신려탈피"] -= 1;
    }
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const paralyzed = Boolean(target.statuses["마비"]);
    const shedding = Number(actor.counters["신려탈피"] || 0);
    const counts = battle.recentKindCounts(target);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const defenseRead = counts.defense * 1.35 + counts.meditation * 0.25;

    if (action.isCommonAction("meditation")) {
      if (!paralyzed && actor.mp < 48) value += 420 + Math.max(0, 48 - actor.mp) * 12;
      if (actor.mp >= 85) value -= 320;
    }
    if (action.isSkill(CHARACTER_ID, 0)) {
      if (!paralyzed) {
        value += 720 * hitRate;
        if (actor.mp >= 42) value += 300;
      } else value -= 180;
      if (shedding > 0) value += 220;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      if (shedding <= 0 && !paralyzed) {
        value += 760;
        if (actor.mp >= 54) value += 520;
        if (actor.mp < 34) value -= 420;
      } else value -= 220;
      if (incoming >= actor.hp * 0.65) value -= 360;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      if (paralyzed) {
        const healValue = Math.min(actor.maxHp - actor.hp, expectedDamage * 0.7);
        value += 1250 + healValue * 8;
      } else if (counts.defense + counts.meditation > counts.attack) value += 420;
      else if (actor.mp < 55) value -= 320;
      if (actor.hp < actor.maxHp * 0.55) value += 260;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      if (defenseRead >= 1.2) value += 1450 + defenseRead * 360;
      else if (!paralyzed) value -= 420;
      if (actor.mp < 58 && !paralyzed) value -= 480;
    }
    return value;
  },
};
