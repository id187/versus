"use strict";

const CHARACTER_ID = "gandrick";

function log(battle, message) {
  battle.logs.push(message);
}

function addCounter(battle, fighter, name, amount, maxValue = null) {
  const before = Number(fighter.counters[name] || 0);
  const after = maxValue == null ? before + amount : Math.min(maxValue, before + amount);
  fighter.counters[name] = after;
  if (maxValue == null) {
    log(battle, `${fighter.name}의 ${name} ${before} -> ${after}`);
  } else if (after === before && amount > 0 && before >= maxValue) {
    log(battle, `${fighter.name}의 ${name}: 이미 최대치다.`);
  } else {
    log(battle, `${fighter.name}의 ${name} ${before}/${maxValue} -> ${after}/${maxValue}`);
  }
}

function modifyAccuracyActorAfterTarget(_battle, choice, _target, accuracy) {
  if (choice.action.isSkill(CHARACTER_ID, 2) && choice.actor.counters["탄환형태"] === "마의 탄환") {
    return accuracy + 20;
  }
  return accuracy;
}

module.exports = {
  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has("탄환")) {
      fighter.counters["탄환"] = 6;
      fighter.counters["탄환형태"] = null;
      if (!Number.isFinite(fighter.attackSelectionCount1To5)) fighter.attackSelectionCount1To5 = 0;
    }
  },

  extraStateParts(_battle, fighter) {
    return fighter.counters["탄환형태"] ? [`${fighter.counters["탄환형태"]} 형태`] : [];
  },

  counterStateText(_fighter, name, value) {
    return name === "탄환" ? `탄환 ${Math.trunc(value)}/6` : null;
  },

  setupValue(_battle, actor, _target, action) {
    if (!action.isSkill(CHARACTER_ID, 1)) return 0;
    const bullets = Number(actor.counters["탄환"] || 0);
    if (bullets <= 0) return 1200;
    if (bullets <= 2) return 400;
    return 0;
  },

  onMakeChoice(battle, fighter, action, choice) {
    if (action.isSkill(CHARACTER_ID, 3)) choice.selectedBullets = Number(fighter.counters["탄환"] || 0);
    if (action.isAttack && battle.turn >= 1 && battle.turn <= 5) fighter.attackSelectionCount1To5 += 1;
  },

  modifyCost(_battle, fighter, action, cost) {
    if (
      action.isSkill(CHARACTER_ID, 3)
      && fighter.counters["탄환형태"] === "철의 탄환"
      && Number(fighter.counters["탄환"] || 0) === 6
    ) return cost - 8;
    return cost;
  },

  onActionStart(battle, choice) {
    if (!choice.action.isAttack) return false;
    const bullets = Number(choice.actor.counters["탄환"] || 0);
    if (bullets <= 0) {
      log(battle, "탄환이 0이라 공격 행동에 실패했다.");
      return true;
    }
    choice.actor.counters["탄환"] = bullets - 1;
    log(battle, `탄환 1 소모: ${bullets}/6 -> ${bullets - 1}/6`);
    return false;
  },

  modifyAccuracyActorAfterTarget,

  applyConditionEffects(battle, choice) {
    const actor = choice.actor;
    if (choice.action.isSkill(CHARACTER_ID, 0) && actor.counters["탄환형태"] === "철의 탄환") {
      const roll = battle.roll("정밀 사격 탄환");
      log(battle, `탄환 회수 판정 20% / 판정값 ${roll.toFixed(2)}`);
      if (roll < 20) addCounter(battle, actor, "탄환", 1, 6);
    }
    if (choice.action.isSkill(CHARACTER_ID, 3)) {
      const bullets = choice.selectedBullets == null ? Number(actor.counters["탄환"] || 0) : choice.selectedBullets;
      choice.hitCount = 1 + battle.rng.range(Math.max(1, bullets));
      log(battle, `[연격] 선택 시 탄환 ${bullets}/6, ${choice.hitCount}회로 결정되었다.`);
    }
    return true;
  },

  attackDamageMultipliers(battle, choice) {
    const actor = choice.actor;
    const multipliers = [];
    const form = actor.counters["탄환형태"];
    const bullets = Number(actor.counters["탄환"] || 0);
    multipliers.push(form === "마의 탄환" ? 1.2 + (6 - bullets) * 0.1 : 1.2);
    if (choice.action.isSkill(CHARACTER_ID, 0)) {
      let chance = 20;
      if (form === "마의 탄환") chance += 30;
      if (form !== "철의 탄환") {
        const roll = battle.roll("정밀 사격 치명");
        log(battle, `정밀 사격 피해 증폭 ${chance}% / 판정값 ${roll.toFixed(2)}`);
        if (roll < chance) multipliers.push(1.5);
      }
    }
    if (choice.action.isSkill(CHARACTER_ID, 3) && form === "마의 탄환" && choice.selectedBullets === 1) {
      multipliers.push(7);
    }
    return multipliers;
  },

  targetDamageMultipliers(_battle, _choice, target) {
    if (target.counters["탄환형태"] !== "철의 탄환") return [];
    return [Math.max(0, 1 - Number(target.counters["탄환"] || 0) * 0.04)];
  },

  estimatedHitCount(actor, action, useMax) {
    if (!action.isSkill(CHARACTER_ID, 3)) return null;
    const bullets = Math.max(1, Number(actor.counters["탄환"] || 0));
    return useMax ? bullets : (1 + bullets) / 2;
  },

  estimatedDamageMultipliers(_battle, actor, _target, action) {
    if (!action.isAttack) return [];
    const bullets = Number(actor.counters["탄환"] || 0);
    return [actor.counters["탄환형태"] === "마의 탄환" ? 1.2 + (6 - bullets) * 0.1 : 1.2];
  },

  onHitAfterDefenseAsActor(battle, choice) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    if (choice.action.isSkill(CHARACTER_ID, 2)) {
      battle.addStatEffect(target, "def", 0.7, 3, choice.action.name);
      if (actor.counters["탄환형태"] === "철의 탄환") {
        battle.addStatEffect(target, "atk", 0.8, 3, choice.action.name);
      }
    } else if (choice.action.isSkill(CHARACTER_ID, 3)) {
      if (!(actor.counters["탄환형태"] === "철의 탄환" && choice.selectedBullets === 6)) {
        actor.counters["탄환"] = 0;
        log(battle, "탄환을 모두 소모했다.");
      }
    }
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    const actor = choice.actor;
    const form = actor.counters["탄환형태"];
    if (form === "마의 탄환") {
      addCounter(battle, actor, "탄환", 2, 6);
      battle.fixedDamage(battle.opponent(actor), 6, "재장전", actor);
    } else if (form === "철의 탄환") addCounter(battle, actor, "탄환", 4, 6);
    else addCounter(battle, actor, "탄환", 3, 6);
    return true;
  },

  onTurnEnd(battle, fighter) {
    if (battle.turn === 5 && fighter.counters["탄환형태"] == null) {
      fighter.counters["탄환형태"] = fighter.attackSelectionCount1To5 >= 4 ? "마의 탄환" : "철의 탄환";
      log(battle, `${fighter.name}은 ${fighter.counters["탄환형태"]} 형태로 변신했다.`);
    }
    const form = fighter.counters["탄환형태"];
    const bullets = Number(fighter.counters["탄환"] || 0);
    if (form === "마의 탄환") battle.fixedDamage(fighter, Math.floor((6 - bullets) * 0.5), "마의 탄환", fighter);
    else if (form === "철의 탄환") battle.heal(fighter, Math.floor(bullets * 0.5), "철의 탄환");
  },

  wouldConditionFail(_battle, actor, _target, action) {
    return action.isAttack ? Number(actor.counters["탄환"] || 0) <= 0 : null;
  },

  aiScore(battle, actor, target, action) {
    let value = 0;
    const bullets = Number(actor.counters["탄환"] || 0);
    const form = actor.counters["탄환형태"];
    if (form == null && battle.turn <= 5) {
      const attacks = Number(actor.attackSelectionCount1To5 || 0);
      const incoming = battle.estimateBestIncomingDamage(target, actor);
      const actorHpRatio = actor.maxHp > 0 ? actor.hp / actor.maxHp : 0;
      const targetHpRatio = target.maxHp > 0 ? target.hp / target.maxHp : 0;
      const demonPreference = Math.max(-900, Math.min(900,
        (actorHpRatio - 0.65) * 1600 + (1 - targetHpRatio) * 800 - incoming * 7 - 220));
      const attacksAfterChoice = attacks + (action.isAttack ? 1 : 0);
      const remainingTurns = Math.max(0, 5 - battle.turn);
      if (attacksAfterChoice >= 4) value += demonPreference;
      else if (attacksAfterChoice + remainingTurns < 4) value -= demonPreference;
      else value += (action.isAttack ? 1 : -1) * demonPreference * 0.18;
      if (action.isSkill(CHARACTER_ID, 1) && demonPreference < 0) value += 260;
    }
    if (form === "철의 탄환") {
      if (action.isSkill(CHARACTER_ID, 1)) value += Math.max(0, 6 - bullets) * 110;
      if (action.isSkill(CHARACTER_ID, 2)) value += 180;
      if (action.isSkill(CHARACTER_ID, 3) && bullets === 6) value += 520;
    } else if (form === "마의 탄환") {
      if (action.isSkill(CHARACTER_ID, 3) && bullets === 1) value += 2200;
      if (action.isCommonAction("meditation") && bullets === 1 && actor.mp < 44) value += 700;
      if (action.isSkill(CHARACTER_ID, 1) && bullets <= 1) value += 260;
    }
    return value;
  },
};
