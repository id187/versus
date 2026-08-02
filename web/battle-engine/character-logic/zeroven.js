"use strict";

const CHARACTER_ID = "zeroven";

function log(battle, message) {
  battle.logs.push(message);
}

function addVengeance(battle, fighter) {
  const before = Number(fighter.counters["과령"] || 0);
  fighter.counters["과령"] = before + 1;
  log(battle, `${fighter.name}의 과령 ${before} -> ${fighter.counters["과령"]}`);
  if (fighter.counters["과령"] >= 6 && Number(fighter.counters["거포 강령"] || 0) <= 0) {
    triggerVengeanceOverflow(battle, fighter, "과령 폭주");
  }
}

function triggerVengeanceOverflow(battle, fighter, reason) {
  const stacks = Number(fighter.counters["과령"] || 0);
  fighter.counters["과령"] = 0;
  battle.fixedDamage(fighter, 25, reason, fighter);
  log(battle, `과령 ${stacks}을 모두 소모했다.`);
}

function modifyAccuracyActorBeforeTarget(_battle, choice, _target, accuracy) {
  let value = accuracy;
  if (choice.action.isActive) value *= Math.max(0, 1 - Number(choice.actor.counters["과령"] || 0) * 0.03);
  if (choice.action.isAttack) value += 5;
  return value;
}

module.exports = {
  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has("과령")) {
      fighter.counters["과령"] = 0;
      fighter.counters["거포 강령"] = 0;
    }
  },

  extraStateParts(_battle, fighter) {
    const turns = Number(fighter.counters["거포 강령"] || 0);
    return turns > 0 ? [`거포 강령 ${turns}턴`] : [];
  },

  setupValue(_battle, actor, _target, action) {
    return action.isSkill(CHARACTER_ID, 3) && Number(actor.counters["과령"] || 0) >= 4 ? 220 : 0;
  },

  modifyAccuracyActorBeforeTarget,

  modifyAccuracyTarget(_battle, choice, _target, accuracy) {
    return choice.action.isAttack ? accuracy + 5 : accuracy;
  },

  applyConditionEffects(battle, choice) {
    const stacks = Number(choice.actor.counters["과령"] || 0);
    if (choice.action.isSkill(CHARACTER_ID, 1) && stacks < 3) return false;
    if (choice.action.isSkill(CHARACTER_ID, 2)) {
      if (stacks <= 0) return false;
      if (stacks >= 5) {
        choice.power = Number(choice.power || 0) + 2;
        log(battle, "과령이 5 이상이라 위력이 2 증가했다.");
      }
      choice.hitCount = 1 + battle.rng.range(stacks);
      log(battle, `[연격] ${choice.hitCount}회로 결정되었다.`);
    }
    return true;
  },

  attackDamageMultipliers(_battle, choice) {
    return [1 + Number(choice.actor.counters["과령"] || 0) * 0.2];
  },

  estimatedHitCount(actor, action, useMax) {
    if (!action.isSkill(CHARACTER_ID, 2)) return null;
    const stacks = Number(actor.counters["과령"] || 0);
    if (stacks <= 0) return 0;
    return useMax ? stacks : (1 + stacks) / 2;
  },

  estimatedDamageMultipliers(_battle, actor) {
    return [1 + Number(actor.counters["과령"] || 0) * 0.2];
  },

  onHitPreDefenseAsActor(battle, choice) {
    addVengeance(battle, choice.actor);
  },

  onHitPreDefenseAsTarget(battle, choice) {
    addVengeance(battle, battle.opponent(choice.actor));
  },

  onHitAfterDefenseAsActor(battle, choice) {
    if (choice.action.isSkill(CHARACTER_ID, 0) && battle.roll("ATK 감소") < 30) {
      battle.addStatEffect(battle.opponent(choice.actor), "atk", 0.6, 3, choice.action.name);
    }
  },

  applyNonAttackEffects(battle, choice) {
    const actor = choice.actor;
    if (choice.action.isSkill(CHARACTER_ID, 1)) {
      actor.counters["과령"] = Math.max(0, Number(actor.counters["과령"] || 0) - 3);
      battle.heal(actor, 15, choice.action.name);
      return true;
    }
    if (choice.action.isSkill(CHARACTER_ID, 3)) {
      actor.counters["거포 강령"] = 4;
      log(battle, "4턴 동안 과령 폭주 피해가 억제된다.");
      return true;
    }
    return false;
  },

  onTurnEnd(battle, fighter) {
    if (Number(fighter.counters["거포 강령"] || 0) === 1 && Number(fighter.counters["과령"] || 0) >= 6) {
      triggerVengeanceOverflow(battle, fighter, "거포 강령 종료");
    }
  },

  decrementCounters(fighter) {
    if (Number(fighter.counters["거포 강령"] || 0) > 0) fighter.counters["거포 강령"] -= 1;
  },

  wouldConditionFail(_battle, actor, _target, action) {
    const stacks = Number(actor.counters["과령"] || 0);
    if (action.isSkill(CHARACTER_ID, 1)) return stacks < 3;
    if (action.isSkill(CHARACTER_ID, 2)) return stacks <= 0;
    return null;
  },

  aiScore(_battle, actor, target, action, expectedDamage) {
    let value = 0;
    const stacks = Number(actor.counters["과령"] || 0);
    const missingHp = Math.max(0, actor.maxHp - actor.hp);
    if (action.isSkill(CHARACTER_ID, 3)) {
      if (stacks >= 5) value += 1200;
      if (stacks >= 4) value += 650;
      if (stacks <= 2 && Number(actor.counters["거포 강령"] || 0) > 0) value -= 450;
    }
    if (action.isSkill(CHARACTER_ID, 1) && stacks >= 3) {
      value += 220 + missingHp * 1.3 + Math.max(0, stacks - 3) * 90;
      if (actor.hp <= actor.maxHp * 0.35) value += 420;
    }
    if (action.isSkill(CHARACTER_ID, 2) && stacks > 0) {
      value += stacks * 160 + expectedDamage * 0.9;
      if (stacks >= 4) value += 320;
      if (expectedDamage >= target.hp) value += 2500;
    }
    if (action.isSkill(CHARACTER_ID, 0) && stacks <= 1) value += 120;
    if (action.isCommonAction("meditation") && actor.mp < 35) value += 120;
    return value;
  },
};

module.exports.borrowedEffects = {
  extraStateParts: module.exports.extraStateParts,
  onTurnEnd: module.exports.onTurnEnd,
  decrementCounters: module.exports.decrementCounters,
};

module.exports.onBorrowedStateCleared = function onBorrowedStateCleared(fighter) {
  delete fighter.counters["거포 강령"];
};
