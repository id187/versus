"use strict";

const CHARACTER_ID = "saqua";
const FLOW = "정류";
const SERMON_COUNT = "강연사 선택 횟수";
const MISSED_ATTACK_TURN = "사쿠아 공격 미명중";
const MAX_FLOW = 2;
const MISS_MP_REFUND_RATE = 0.7;

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

module.exports = {
  HIDDEN_COUNTERS: new Set([SERMON_COUNT, MISSED_ATTACK_TURN]),

  initUniqueState(fighter, uniqueNames) {
    if (!uniqueNames.has(FLOW)) return;
    fighter.counters[FLOW] = 0;
    fighter.counters[SERMON_COUNT] = 0;
    fighter.counters[MISSED_ATTACK_TURN] = 0;
  },

  counterStateText(_fighter, name, value) {
    return name === FLOW ? `${FLOW} ${Number(value)}/${MAX_FLOW}` : undefined;
  },

  resetTurnFlags(_battle, fighter) {
    fighter.counters[MISSED_ATTACK_TURN] = 0;
  },

  needsBattleLog() {
    return true;
  },

  renderBattleLog(_battle, fighter, lines) {
    lines.push(`강연사 선택: ${Number(fighter.counters[SERMON_COUNT] || 0)}회`);
  },

  counterResourceValue(_fighter, name, raw) {
    if (name === FLOW && Number.isInteger(raw)) return raw * 220;
    if (name === SERMON_COUNT && Number.isInteger(raw)) return Math.min(8, raw) * 42;
    return undefined;
  },

  onMakeChoice(_battle, fighter, action) {
    if (action.isSkill(CHARACTER_ID, 2)) {
      fighter.counters[SERMON_COUNT] = Number(fighter.counters[SERMON_COUNT] || 0) + 1;
    }
  },

  modifyAccuracyActorAfterTarget(battle, choice, _target, accuracy) {
    const actor = choice.actor;
    if (!choice.action.isAttack || Number(actor.counters[FLOW] || 0) < MAX_FLOW) return accuracy;
    const flow = Number(actor.counters[FLOW]);
    actor.counters[FLOW] = 0;
    choice.guaranteedHit = true;
    battle.logs.push(`${FLOW} ${flow}/${MAX_FLOW}를 모두 소모해 명중 판정을 통과한다.`);
    return 100;
  },

  attackDamageMultipliers(_battle, choice) {
    const actor = choice.actor;
    if (choice.action.isSkill(CHARACTER_ID, 2)) {
      return [1 + Math.max(0, Number(actor.counters[SERMON_COUNT] || 0) - 1) * 0.1];
    }
    if (choice.action.isSkill(CHARACTER_ID, 3) && Number(actor.counters[FLOW] || 0) === 0) return [1.2];
    return [];
  },

  estimatedDamageMultipliers(_battle, actor, _target, action) {
    if (action.isSkill(CHARACTER_ID, 2)) {
      const count = Number(actor.counters[SERMON_COUNT] || 0) + 1;
      return [1 + Math.max(0, count - 1) * 0.1];
    }
    if (action.isSkill(CHARACTER_ID, 3) && flowAfterHitCheck(actor, action) === 0) return [1.2];
    return [];
  },

  onHitAfterDefenseAsActor(battle, choice, totalDamage) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    if (choice.action.isSkill(CHARACTER_ID, 0) && Number(actor.counters[FLOW] || 0) === 0) {
      battle.heal(actor, Math.trunc(totalDamage * 0.5), choice.action.name);
    }
    if (choice.action.isSkill(CHARACTER_ID, 3)) {
      battle.addStatEffect(target, "def", 0.5, 4, choice.action.name);
      battle.addStatEffect(target, "spd", 0.5, 4, choice.action.name);
    }
  },

  onDefenseHit(battle, choice) {
    const defender = battle.opponent(choice.actor);
    if (defender.characterId === CHARACTER_ID && defender.defenseName === "흐르는 수막") {
      addCounter(battle, defender, FLOW, 2, MAX_FLOW);
    }
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    battle.applyDefense(choice.actor, choice.action.name);
    return true;
  },

  finishAction(battle, choice, _success, hit, missNotFailure) {
    if (!choice.action.isAttack || hit || !missNotFailure) return;
    choice.actor.counters[MISSED_ATTACK_TURN] = 1;
    addCounter(battle, choice.actor, FLOW, 1, MAX_FLOW);
  },

  onTurnEnd(battle, fighter) {
    if (Number(fighter.counters[MISSED_ATTACK_TURN] || 0) <= 0) return;
    const spent = Number(battle.record.activeAttackMpSpent[fighter.side] || 0);
    const refund = Math.trunc(spent * MISS_MP_REFUND_RATE);
    if (refund > 0) battle.restoreMp(fighter, refund, "물은 돌아온다");
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const flow = Number(actor.counters[FLOW] || 0);
    const sermonCount = Number(actor.counters[SERMON_COUNT] || 0);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const attackRead = recentAttackCount(battle, target);
    const guaranteed = flow >= MAX_FLOW && action.isAttack;

    if (action.isAttack && action.isActive && flow < MAX_FLOW) {
      value += (1 - hitRate) * action.mp * MISS_MP_REFUND_RATE * 8;
    }
    if (action.isCommonAction("normal_attack")) {
      value -= guaranteed ? 520 : 140;
      if (flow < MAX_FLOW) value += (1 - hitRate) * 180;
    }
    if (action.isSkill(CHARACTER_ID, 0)) {
      if (flowAfterHitCheck(actor, action) === 0) {
        value += Math.min(actor.maxHp - actor.hp, expectedDamage * 0.5) * 2.2;
      }
      if (flow === 0) value += 180;
      else if (flow === 1) value += 520;
      if (flow < MAX_FLOW) value += (1 - hitRate) * 260;
      if (guaranteed) value -= 220;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      if (incoming <= 0) value -= 520;
      else {
        value += Math.min(incoming, actor.hp);
        if (flow < MAX_FLOW) value += (MAX_FLOW - flow) * 260;
        value += attackRead * 520;
        if (attackRead <= 0 && incoming < actor.hp * 0.45) value -= 700;
        if (incoming >= actor.hp * 0.55) value += 700;
        if (incoming >= actor.hp) value += 1500;
      }
      if (actor.mp < 45 && incoming < actor.hp * 0.55) value -= 420;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      value += Math.min(8, sermonCount) * 170;
      if (sermonCount <= 1) value += 280;
      if (guaranteed) value += 820;
      else if (flow === 1) value += 420;
      else if (flow === 0 && sermonCount < 3) value += 180;
      if (expectedDamage >= target.hp) value += 2400;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      if (guaranteed) value += 3000;
      else if (flow === 1) {
        value += 160;
        if (actor.mp < 70 && expectedDamage < target.hp * 0.65) value -= 720;
      } else {
        value -= 720;
      }
      if (flowAfterHitCheck(actor, action) === 0) value += expectedDamage * 0.6;
      value += hitRate * 920;
      if (hasStatEffect(target, "def", action.name) && hasStatEffect(target, "spd", action.name)) value -= 1100;
      if (target.hp <= expectedDamage) value += 2800;
    }
    if (action.isCommonAction("meditation") && actor.mp >= 80) value -= 550;
    if (guaranteed && action.isAttack && !action.isSkill(CHARACTER_ID, 3)) value -= 120;
    return value;
  },
};

function flowAfterHitCheck(actor, action) {
  const flow = Number(actor.counters[FLOW] || 0);
  return action.isAttack && flow >= MAX_FLOW ? 0 : flow;
}

function hasStatEffect(fighter, stat, source) {
  return fighter.statEffects.some(
    (effect) => effect.stat === stat && effect.source === source && Number(effect.remaining || 0) > 0,
  );
}

function recentAttackCount(battle, fighter, limit = 4) {
  let history = fighter.selectedHistory;
  if (Object.prototype.hasOwnProperty.call(battle.record.selected, fighter.side)) history = history.slice(0, -1);
  return history.slice(-limit).filter((key) => {
    if (key === "common:normal_attack") return true;
    if (String(key).startsWith("common:")) return false;
    const [id, slotText] = String(key).split(":");
    return id === fighter.characterId && fighter.data.skills?.[Number(slotText)]?.power != null;
  }).length;
}
