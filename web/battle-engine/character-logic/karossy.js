"use strict";

const CHARACTER_ID = "karossy";
const WEATHERS = ["천둥", "흐림", "맑음"];

function floorInt(value) {
  return Math.floor(value);
}

function log(battle, message) {
  battle.logs.push(message);
}

function plannedWeather(action) {
  if (action.characterId !== CHARACTER_ID) return null;
  return ({ 0: "천둥", 1: "흐림", 2: "맑음" })[action.slot] || null;
}

function recentKindCounts(battle, fighter) {
  return typeof battle.recentKindCounts === "function"
    ? battle.recentKindCounts(fighter)
    : { attack: 0, defense: 0, meditation: 0 };
}

module.exports = {
  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has("예보")) fighter.counters["예보"] = "맑음";
  },

  counterStateText(_fighter, name, value) {
    return name === "예보" ? `${name} ${value}` : null;
  },

  setupValue(_battle, _actor, _target, action) {
    return action.isSkill(CHARACTER_ID, 1) || action.isSkill(CHARACTER_ID, 2) ? 120 : 0;
  },

  onMeditationEffect(battle, choice) {
    if (choice.actor.counters["예보"] === "맑음") battle.heal(choice.actor, 5, "맑음");
  },

  targetEvasion(_battle, target, choice, evasion) {
    if (target.counters["예보"] === "흐림" && target.defenseName === "일반 방어" && choice.action.isAttack) {
      return evasion + 15;
    }
    return evasion;
  },

  modifyAttackPower(_battle, choice, power) {
    if (choice.action.isCommonAction("normal_attack") && choice.actor.counters["예보"] === "천둥") return 15;
    return power;
  },

  estimatedPower(_battle, actor, _target, action, power) {
    return action.isCommonAction("normal_attack") && actor.counters["예보"] === "천둥" ? 15 : power;
  },

  attackDamageMultipliers(_battle, choice) {
    return choice.action.isSkill(CHARACTER_ID, 0) && choice.actor.counters["예보"] === "천둥" ? [1.5] : [];
  },

  onHitAfterDefenseAsActor(battle, choice, totalDamage) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    if (!choice.action.isSkill(CHARACTER_ID, 3)) return;
    const weather = actor.counters["예보"];
    if (weather === "천둥") {
      battle.fixedDamage(target, floorInt(target.maxHp * 0.05), "대기상 폭탄", actor);
    } else if (weather === "흐림") {
      for (const stat of ["atk", "def", "spd"]) battle.addStatEffect(target, stat, 0.9, 4, choice.action.name);
    } else if (weather === "맑음") {
      battle.heal(actor, floorInt(totalDamage * 0.4), "대기상 폭탄");
    }
  },

  applyNonAttackEffects(battle, choice) {
    const actor = choice.actor;
    const action = choice.action;
    if (action.isSkill(CHARACTER_ID, 1)) {
      if (actor.counters["예보"] === "흐림") {
        for (const stat of ["atk", "def", "spd"]) battle.addStatEffect(actor, stat, 1.3, 4, action.name);
      } else {
        battle.addStatEffect(actor, "atk", 1.1, 4, action.name);
        battle.addStatEffect(actor, "def", 1.1, 4, action.name);
      }
      return true;
    }
    if (action.isSkill(CHARACTER_ID, 2)) {
      battle.heal(actor, actor.counters["예보"] === "맑음" ? 24 : 12, action.name);
      return true;
    }
    return false;
  },

  onTurnEnd(battle, fighter) {
    const mapping = {
      [`${CHARACTER_ID}:0`]: "천둥",
      [`${CHARACTER_ID}:1`]: "흐림",
      [`${CHARACTER_ID}:2`]: "맑음",
    };
    const chosen = battle.record.selectedKey[fighter.side];
    const current = fighter.counters["예보"] || "맑음";
    if (mapping[chosen] && mapping[chosen] !== current) {
      fighter.counters["예보"] = mapping[chosen];
      battle.restoreMp(fighter, 3, "내일의 날씨");
      log(battle, `${fighter.name}의 예보가 ${fighter.counters["예보"]}으로 변경되었다.`);
      return;
    }
    fighter.counters["예보"] = battle.rng.choice(WEATHERS.filter((weather) => weather !== current));
    log(battle, `${fighter.name}의 예보가 ${fighter.counters["예보"]}으로 변경되었다.`);
  },

  aiScore(battle, actor, target, action, expectedDamage) {
    let value = 0;
    const weather = actor.counters["예보"] || "맑음";
    const planned = plannedWeather(action);
    const counts = recentKindCounts(battle, target);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const missingHp = actor.maxHp - actor.hp;
    const wantsThunder = target.hp <= target.maxHp * 0.45 || actor.mp >= 72;
    const wantsCloudy = incoming >= actor.hp * 0.38 || Number(counts.attack || 0) >= 2;
    const wantsSunny = missingHp >= 28 || actor.hp <= actor.maxHp * 0.5;
    if (planned && planned !== weather && actor.mp >= 45) {
      if ((planned === "천둥" && wantsThunder) || (planned === "맑음" && wantsSunny)) value += 520;
      else if (planned === "흐림" && wantsCloudy) value += 560;
      else value += 120;
    }
    if (action.isSkill(CHARACTER_ID, 0)) {
      if (weather === "천둥") value += 900 + expectedDamage * 0.45;
      else if (wantsThunder && actor.mp >= 50) value += 260;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      value += weather === "흐림" ? 1450 : 260;
      if (wantsCloudy) value += incoming * 0.9 + Number(counts.attack || 0) * 180;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      const heal = weather === "맑음" ? 24 : 12;
      value += Math.min(missingHp, heal) * 34;
      if (wantsSunny) value += 360;
      if (missingHp <= 8 && actor.mp < 70) value -= 180;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      if (weather === "천둥") value += floorInt(target.maxHp * 0.05) * 40;
      else if (weather === "흐림") value += incoming * 0.75 + Number(counts.attack || 0) * 220;
      else if (weather === "맑음") value += Math.min(missingHp, expectedDamage * 0.4) * 7;
      if (actor.mp < 55 && expectedDamage < target.hp) value -= 320;
    } else if (action.isCommonAction("meditation")) {
      if (weather === "맑음" && missingHp > 0) value += Math.min(missingHp, 5) * 30;
      if (actor.mp < 40) value += 180;
    }
    return value;
  },
};
