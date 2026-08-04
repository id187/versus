"use strict";

const CHARACTER_ID = "balef";
const FLOW = "권의";

function skillKey(slot) {
  return `${CHARACTER_ID}:${slot}`;
}

function floorInt(value) {
  return Math.floor(value);
}

function history(fighter) {
  if (!Array.isArray(fighter.selectedAttackActiveHistory)) fighter.selectedAttackActiveHistory = [];
  return fighter.selectedAttackActiveHistory;
}

function previousAttack(fighter) {
  const selected = history(fighter);
  return selected.length ? selected[selected.length - 1] : null;
}

function projectedFlow(actor, action) {
  let flow = Number(actor.counters[FLOW] || 0);
  const previous = previousAttack(actor);
  if (action.isActive && action.isAttack && previous && previous !== action.key) flow += 1;
  return flow;
}

function missingTrio(actor) {
  return new Set([skillKey(0), skillKey(1), skillKey(2)].filter((key) => !actor.hitRecords.has(key)));
}

function defenseRead(battle, target, expectedDamage) {
  const counts = battle.recentKindCounts(target);
  let value = counts.defense * 1.35 + counts.meditation * 0.25;
  if (expectedDamage >= target.hp * 0.75) value += 1;
  if (expectedDamage >= target.hp) value += 1.2;
  if (target.defenseStreak >= 2) value -= 0.7;
  return Math.max(0, value);
}

function rawDamage(expectedDamage, hitRate) {
  return hitRate > 0 ? expectedDamage / hitRate : 0;
}

module.exports = {
  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has(FLOW)) fighter.counters[FLOW] = 0;
    history(fighter);
  },

  needsBattleLog() {
    return true;
  },

  renderBattleLog(battle, fighter, lines) {
    const displayName = (key) => battle.findActionByInput(fighter, key)?.name || key;
    const recent = history(fighter).slice(-3).map(displayName);
    lines.push(`공격 액티브 선택 기록: ${recent.length ? recent.join(" -> ") : "없음"}`);
    lines.push(`삼위일권 명중: ${[0, 1, 2].map((slot) => `${displayName(skillKey(slot))} ${fighter.hitRecords.has(skillKey(slot)) ? "완료" : "미달성"}`).join(" / ")}`);
  },

  onMakeChoice(_battle, fighter, action, choice) {
    if (!action.isActive || !action.isAttack) return;
    choice.prevAttackActive = previousAttack(fighter);
    history(fighter).push(action.key);
  },

  modifyPriority(_battle, fighter, action, priority) {
    return action.isSkill(CHARACTER_ID, 1) && previousAttack(fighter) === skillKey(2) ? priority + 1 : priority;
  },

  onActionStart(battle, choice) {
    const actor = choice.actor;
    if (choice.action.isActive && choice.action.isAttack && choice.prevAttackActive && choice.prevAttackActive !== choice.action.key) {
      const before = Number(actor.counters[FLOW] || 0);
      actor.counters[FLOW] = before + 1;
      battle.logs.push(`${actor.name}의 ${FLOW} ${before} -> ${actor.counters[FLOW]}`);
    }
    return false;
  },

  applyConditionEffects(battle, choice) {
    if (choice.action.isSkill(CHARACTER_ID, 2) && choice.prevAttackActive === skillKey(0)) {
      choice.power = Number(choice.power || 0) + 10;
      battle.logs.push("범권괴권 연계로 위력이 10 증가했다.");
    }
    if (choice.action.isSkill(CHARACTER_ID, 3) && history(choice.actor).length < 2) return false;
    return true;
  },

  attackDamageMultipliers(battle, choice) {
    const actor = choice.actor;
    const action = choice.action;
    const flow = Number(actor.counters[FLOW] || 0);
    const multipliers = [1 + flow * 0.04];
    if (action.isSkill(CHARACTER_ID, 0)) {
      if (choice.prevAttackActive === skillKey(2)) multipliers.push(1.8);
      else if (flow % 2 === 0) multipliers.push(1.4);
    }
    if (action.isSkill(CHARACTER_ID, 2) && battle.opponent(actor).defenseMult !== null) multipliers.push(3);
    return multipliers;
  },

  estimatedDamageMultipliers(_battle, actor, target, action) {
    const flow = projectedFlow(actor, action);
    const previous = previousAttack(actor);
    const multipliers = [1 + flow * 0.04];
    if (action.isSkill(CHARACTER_ID, 0)) {
      if (previous === skillKey(2)) multipliers.push(1.8);
      else if (flow % 2 === 0) multipliers.push(1.4);
    }
    if (action.isSkill(CHARACTER_ID, 2) && target.defenseMult !== null) multipliers.push(3);
    return multipliers;
  },

  onHitAfterDefenseAsActor(battle, choice, totalDamage) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    const action = choice.action;
    const trio = [skillKey(0), skillKey(1), skillKey(2)];
    const trioWasReady = trio.every((key) => actor.hitRecords.has(key));
    if (action.isAttack && trioWasReady) {
      battle.fixedDamage(target, floorInt(target.maxHp * 0.05), "삼위일권", actor);
      for (const key of trio) actor.hitRecords.delete(key);
      if (battle.gameOver) return;
    } else if (action.isActive && action.isAttack && trio.includes(action.key)) {
      actor.hitRecords.add(action.key);
    }
    if (action.isSkill(CHARACTER_ID, 0) && choice.prevAttackActive === skillKey(1)) {
      battle.addStatEffect(target, "atk", 0.9, 3, action.name);
      battle.addStatEffect(actor, "atk", 1.1, 3, action.name);
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      const rate = choice.prevAttackActive === skillKey(0) ? 0.7 : 0.5;
      const reduced = battle.reduceMp(target, floorInt(totalDamage * rate), "흡성대권");
      battle.restoreMp(actor, reduced, "흡성대권");
    } else if (action.isSkill(CHARACTER_ID, 2) && choice.prevAttackActive === skillKey(1)) {
      battle.heal(actor, floorInt(totalDamage * 0.3), "관통마권");
    }
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 3)) return false;
    const actor = choice.actor;
    const selected = history(actor);
    if (selected.length < 2) {
      battle.logs.push("복제할 공격 액티브 기록이 부족하다.");
      return true;
    }
    actor.counters[FLOW] = Number(actor.counters[FLOW] || 0) + 1;
    const first = selected[selected.length - 2];
    const second = selected[selected.length - 1];
    const original = battle.findActionByInput(actor, first);
    if (!original) return true;
    const copied = Object.assign(Object.create(Object.getPrototypeOf(original)), original, {
      mp: 0,
      power: floorInt(Number(original.power || 0) * 1.5),
      accuracy: 100,
      priority: 0,
    });
    selected.push(copied.key);
    battle.logs.push(`극의환권으로 ${copied.name}을 복제해 즉시 처리한다.`);
    battle.executeAction({
      actor,
      action: copied,
      cost: 0,
      priority: 0,
      power: copied.power,
      accuracy: copied.accuracy,
      hitCount: 1,
      guaranteedHit: false,
      selectedActionKey: copied.key,
      prevAttackActive: second,
      copiedFrom: choice.action.name,
      consumedMpExtra: 0,
      get totalCost() { return 0; },
    });
    return true;
  },

  estimatedPower(_battle, actor, _target, action, power) {
    return action.isSkill(CHARACTER_ID, 2) && previousAttack(actor) === skillKey(0) ? power + 10 : power;
  },

  setupValue(_battle, actor, target, action) {
    const selected = history(actor);
    if (!action.isSkill(CHARACTER_ID, 3) || selected.length < 2) return 0;
    const first = selected[selected.length - 2];
    const second = selected[selected.length - 1];
    const missing = missingTrio(actor);
    let value = 520 + Number(actor.counters[FLOW] || 0) * 80;
    if (missing.has(first)) {
      value += 1450;
      if (missing.size === 1) value += 1250;
    }
    if (first !== second) value += 420;
    if (missing.size === 0) value += floorInt(target.maxHp * 0.05) * 85;
    return value;
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const damage = rawDamage(expectedDamage, hitRate);
    const previous = previousAttack(actor);
    const missing = missingTrio(actor);
    const flow = Number(actor.counters[FLOW] || 0);
    const flowAfterChoice = projectedFlow(actor, action);
    const read = defenseRead(battle, target, damage);
    const missingMp = Math.max(0, actor.maxMp - actor.mp);

    if (action.isAttack && missing.size === 0) {
      value += floorInt(target.maxHp * 0.05) * 95;
    }
    if (action.isActive && action.isAttack && missing.size > 0) {
      if (previous) value += action.key !== previous ? 360 : -260;
      if (missing.has(action.key)) {
        value += 520 * hitRate;
        if (missing.size === 1) value += 1500 * hitRate;
        else if (missing.size === 2) value += 520 * hitRate;
      } else value -= 240;
    }

    if (action.isSkill(CHARACTER_ID, 0)) {
      if (previous === skillKey(2)) value += 820;
      else if (flowAfterChoice % 2 === 0) value += 420;
      if (previous === skillKey(1)) {
        value += 520;
        if (battle.estimateBestIncomingDamage(target, actor) >= actor.hp * 0.45) value += 380;
      }
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      const rate = previous === skillKey(0) ? 0.7 : 0.5;
      const expectedDrain = Math.min(target.mp, floorInt(Math.max(0, damage) * rate));
      const usefulDrain = Math.min(missingMp, expectedDrain);
      if (target.mp >= 25) value += expectedDrain * 70;
      if (usefulDrain >= 8) value += usefulDrain * 140;
      if (actor.mp <= 55 && target.mp >= 45) value += 1300;
      if (previous === skillKey(0)) {
        value += 620;
        if (actor.mp <= 60 && target.mp >= 45) value += 1300;
      }
      if (previous === skillKey(2)) value += 360;
      if (actor.mp >= 86 && target.mp < 20) value -= 650;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      if (previous === skillKey(0)) value += 740;
      if (previous === skillKey(1)) value += 360 + Math.min(700, Math.max(0, 100 - actor.hp) * 8);
      if (read >= 2.2) value += 3400;
      else if (read >= 1.2) value += 1400;
      if (target.defenseStreak >= 2) value -= 520;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      const selected = history(actor);
      if (selected.length >= 2) {
        const first = selected[selected.length - 2];
        if (missing.has(first)) value += 520;
        else if (missing.size) value -= missing.size === 1 ? 4200 : 1800;
        if (flow >= 3) value += 300;
      }
      if (actor.mp < 58) value -= 360;
    } else if (action.isCommonAction("meditation")) {
      if (actor.mp < 39 && missing.size <= 1) value += 460;
      if (actor.mp >= 90) value -= 520;
    }
    if (action.isCommonAction("normal_attack") && missing.size) value -= 280;
    return value;
  },

  wouldConditionFail(_battle, actor, _target, action) {
    return action.isSkill(CHARACTER_ID, 3) ? history(actor).length < 2 : null;
  },
};
