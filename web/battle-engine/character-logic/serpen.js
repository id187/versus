"use strict";

const CHARACTER_ID = "serpen";
const PHASES = ["삭월", "초승", "상현", "만월", "하현", "그믐"];
const PHASE_MULT = { "삭월": 0.9, "초승": 1.2, "상현": 1.5, "만월": 1.8, "하현": 1.5, "그믐": 1.2 };

function floorInt(value) {
  return Math.floor(value);
}

function phaseOf(fighter) {
  return fighter.counters["위상"] || "삭월";
}

function log(battle, message) {
  battle.logs.push(message);
}

function recentKindCounts(battle, fighter) {
  return typeof battle.recentKindCounts === "function"
    ? battle.recentKindCounts(fighter)
    : { attack: 0, defense: 0, meditation: 0 };
}

module.exports = {
  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has("위상")) fighter.counters["위상"] = "삭월";
  },

  counterStateText(_fighter, name, value) {
    return name === "위상" ? `${name} ${value}` : null;
  },

  extraStateParts() {
    return [];
  },

  modifyStats(_battle, fighter, atk, defense, spd) {
    const multiplier = PHASE_MULT[phaseOf(fighter)] || 1;
    return [atk * multiplier, defense * multiplier, spd];
  },

  onActionStartBeforeCommon(battle, choice) {
    if (Number(choice.actor.counters["고요한 밤"] || 0) > 0) {
      log(battle, "고요한 밤 효과로 행동 개시 시 실패했다.");
      return true;
    }
    return false;
  },

  attackDamageMultipliers(_battle, choice) {
    return choice.action.isSkill(CHARACTER_ID, 3) ? [PHASE_MULT[phaseOf(choice.actor)] || 1] : [];
  },

  estimatedDamageMultipliers(_battle, actor, _target, action) {
    return action.isSkill(CHARACTER_ID, 3) ? [PHASE_MULT[phaseOf(actor)] || 1] : [];
  },

  onHitAfterDefenseAsActor(battle, choice) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    const phase = phaseOf(actor);
    if (choice.action.isSkill(CHARACTER_ID, 0) && ["초승", "상현"].includes(phase)) {
      battle.heal(actor, floorInt((actor.maxHp - actor.hp) * 0.1), "차오르는 궤적");
    } else if (choice.action.isSkill(CHARACTER_ID, 2) && ["하현", "그믐"].includes(phase)) {
      battle.fixedDamage(target, floorInt((target.maxHp - target.hp) * 0.1), "기우는 도려내기", actor);
    }
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    const currentIndex = PHASES.indexOf(phaseOf(choice.actor));
    choice.actor.counters["위상"] = PHASES[(currentIndex + 2) % PHASES.length];
    log(battle, `위상이 ${choice.actor.counters["위상"]}으로 변경되었다.`);
    return true;
  },

  onTurnEnd(battle, fighter) {
    const opponent = battle.opponent(fighter);
    if (
      battle.record.selectedKey[fighter.side] === "common:defense"
      && battle.record.actionSuccess[fighter.side]
      && Number(battle.record.defenseReduced[fighter.side] || 0) >= 1
    ) {
      fighter.counters["고요한 밤"] = 2;
      opponent.counters["고요한 밤"] = 2;
      log(battle, "고요한 밤이 다음 턴 동안 양측에게 적용된다.");
    }
    const currentIndex = PHASES.indexOf(phaseOf(fighter));
    fighter.counters["위상"] = PHASES[(currentIndex + 1) % PHASES.length];
    log(battle, `${fighter.name}의 위상이 ${fighter.counters["위상"]}으로 변경되었다.`);
  },

  decrementCounters() {},

  aiScore(battle, actor, target, action, expectedDamage) {
    const phase = phaseOf(actor);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const missingHp = Math.max(0, actor.maxHp - actor.hp);
    const targetMissingHp = Math.max(0, target.maxHp - target.hp);
    const counts = recentKindCounts(battle, target);
    let defenseRead = Number(counts.defense || 0) * 1.35 + Number(counts.meditation || 0) * 0.35;
    if (expectedDamage >= target.hp * 0.8) defenseRead += 1.2;
    if (expectedDamage >= target.hp) defenseRead += 1;
    if (target.defenseStreak >= 2) defenseRead -= 0.8;
    defenseRead = Math.max(0, defenseRead);
    let value = 0;
    if (action.isSkill(CHARACTER_ID, 0)) {
      if (["초승", "상현"].includes(phase)) {
        value += 360 + floorInt(missingHp * 0.1) * 95;
        if (actor.hp <= incoming * 1.45) value += 420;
      } else if (phase === "삭월") value -= 220;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      if (phase === "삭월") {
        value += 1850;
        if (actor.mp >= 48) value += 520;
        if (target.hp <= battle.estimateBestIncomingDamage(actor, target)) value -= 950;
      } else if (phase === "그믐") {
        value += 760;
        if (actor.mp >= 60) value += 280;
      } else if (["상현", "만월"].includes(phase)) value -= 1800;
      else if (phase === "초승") value -= 520;
      else value -= 900;
      if (incoming >= actor.hp) value -= 2200;
      else if (incoming >= actor.hp * 0.65) value -= 700;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      if (["하현", "그믐"].includes(phase)) {
        const bonusDamage = floorInt(targetMissingHp * 0.1);
        value += 360 + bonusDamage * 120;
        if (expectedDamage + bonusDamage >= target.hp) value += 2400;
      } else if (phase === "만월") value -= 260;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      if (phase === "만월") {
        value += 2600 + expectedDamage * 1.2;
        if (expectedDamage >= target.hp) value += 3600;
        if (defenseRead >= 2.2) value -= 14000;
        else if (defenseRead >= 1.2) value -= 5200;
      } else if (["상현", "하현"].includes(phase)) {
        value += 520 + expectedDamage * 0.35;
        if (actor.mp < 60 && expectedDamage < target.hp) value -= 380;
      } else value -= 950;
    } else if (action.isCommonAction("meditation")) {
      const nextPhase = PHASES[(PHASES.indexOf(phase) + 1) % PHASES.length];
      if (actor.mp < 39 && nextPhase === "만월") value += 1250;
      else if (actor.mp < 39 && ["초승", "상현"].includes(phase)) value += 520;
      if (actor.mp >= 90) value -= 520;
    }
    if (action.isCommonAction("normal_attack") && phase === "만월" && actor.mp >= 39) value -= 650;
    return value;
  },
};
