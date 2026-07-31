"use strict";

const CHARACTER_ID = "cryne";

function addCounter(battle, fighter, name, amount) {
  if (typeof battle.addCounter === "function") {
    battle.addCounter(fighter, name, amount);
    return;
  }
  fighter.counters[name] = Number(fighter.counters[name] || 0) + Number(amount);
  battle.logs.push(`${fighter.name}의 ${name}이 ${fighter.counters[name]}중첩이 되었다.`);
}

module.exports = {
  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has("상흔")) fighter.counters["상흔"] = 0;
  },

  counterResourceValue(_fighter, name, raw) {
    return name === "상흔" && Number.isInteger(raw) ? raw * 48 : undefined;
  },

  applyConditionEffects(battle, choice) {
    const actor = choice.actor;
    const action = choice.action;
    if (action.isSkill(CHARACTER_ID, 0)) {
      const stacks = Number(actor.counters["상흔"] || 0);
      choice.power = Number(choice.power || 0) + stacks;
      battle.logs.push(`상흔 중첩 수 ${stacks}로 위력이 ${stacks} 증가했다.`);
    }
    if (action.isSkill(CHARACTER_ID, 2) && Number(battle.record.attackDamageTaken[actor.side] || 0) <= 0) {
      return false;
    }
    if (action.isSkill(CHARACTER_ID, 3)) {
      const stacks = Number(actor.counters["상흔"] || 0);
      if (stacks < 5) return false;
      const low = Math.max(1, stacks - 4);
      choice.hitCount = low + battle.rng.range(stacks - low + 1);
      battle.logs.push(`[연격] ${choice.hitCount}회로 결정되었다.`);
    }
    return undefined;
  },

  attackDamageMultipliers(_battle, choice) {
    const actor = choice.actor;
    return [1 + (actor.maxHp - actor.hp) / actor.maxHp];
  },

  estimatedHitCount(actor, action, useMax) {
    if (!action.isSkill(CHARACTER_ID, 3)) return undefined;
    const stacks = Number(actor.counters["상흔"] || 0);
    if (stacks < 5) return 0;
    return useMax ? stacks : (Math.max(1, stacks - 4) + stacks) / 2;
  },

  estimatedDamageMultipliers(_battle, actor) {
    return [1 + (actor.maxHp - actor.hp) / actor.maxHp];
  },

  applyNonAttackEffects(battle, choice) {
    const actor = choice.actor;
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    battle.fixedDamage(actor, 15, "울부짖는 상처", actor);
    if (!battle.gameOver) {
      battle.addStatEffect(actor, "atk", 1.4, 4, choice.action.name);
      battle.addStatEffect(actor, "def", 1.4, 4, choice.action.name);
    }
    return true;
  },

  finishAction(battle, choice, success) {
    const actor = choice.actor;
    const action = choice.action;
    if (action.isSkill(CHARACTER_ID, 0)) {
      battle.fixedDamage(actor, 5, action.name, actor);
    } else if (action.isSkill(CHARACTER_ID, 3) && success) {
      actor.counters["상흔"] = 0;
      battle.logs.push("상흔을 모두 소모했다.");
    }
  },

  onDamageTaken(battle, target) {
    addCounter(battle, target, "상흔", 1);
  },

  wouldConditionFail(battle, actor, target, action) {
    if (action.isSkill(CHARACTER_ID, 2)) {
      if (Number(battle.record.attackDamageTaken[actor.side] || 0) > 0) return false;
      return battle.estimateBestIncomingDamage(target, actor) <= 0;
    }
    if (action.isSkill(CHARACTER_ID, 3)) return Number(actor.counters["상흔"] || 0) < 5;
    return undefined;
  },

  aiScore(battle, actor, target, action, expectedDamage) {
    let value = 0;
    const stacks = Number(actor.counters["상흔"] || 0);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const missingHp = actor.maxHp - actor.hp;
    const desperate = actor.hp <= actor.maxHp * 0.35 || incoming >= actor.hp;
    const lethal = expectedDamage >= target.hp;

    if (action.isSkill(CHARACTER_ID, 0)) {
      value += Math.min(820, stacks * 95);
      if (actor.hp <= 12) value -= 900;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      if (actor.hp > 45) {
        value += 520 + Math.max(0, 5 - stacks) * 90;
        if (missingHp < actor.maxHp * 0.35) value += 280;
      } else {
        value -= 900;
      }
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      if (incoming > 0) value += 650 + Math.min(900, incoming * 14);
      if (actor.hp <= incoming) value += 720;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      if (stacks < 5) return value;
      if (lethal) value += 3600 + expectedDamage;
      else if (desperate && stacks >= 6) value += 1150 + missingHp * 4;
      else if (stacks >= 9 && target.hp <= target.maxHp * 0.55) value += 900;
      else {
        value -= 4200;
        value -= Math.max(0, 8 - stacks) * 420;
      }
    }
    return value;
  },
};
