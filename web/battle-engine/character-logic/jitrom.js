"use strict";

const CHARACTER_ID = "jitrom";
const SHARD = "암편";
const DEF_ATTACK_TURN = "DEF 공격 턴";

function floorInt(value) {
  return Math.floor(value);
}

function shards(fighter) {
  return Math.max(0, Number(fighter.counters[SHARD] || 0));
}

function defenseBonus(count) {
  return Math.max(0, count * 0.02);
}

function defAttackActive(battle, fighter) {
  return Number(fighter.counters[DEF_ATTACK_TURN] || 0) === battle.turn;
}

function addCounter(battle, fighter, name, amount) {
  if (typeof battle.addCounter === "function") {
    battle.addCounter(fighter, name, amount);
    return;
  }
  const before = Number(fighter.counters[name] || 0);
  fighter.counters[name] = before + Number(amount);
  battle.logs.push(`${fighter.name}의 ${name} ${before} -> ${fighter.counters[name]}`);
}

function hasStatEffect(fighter, source, stat = null) {
  return fighter.statEffects.some((effect) => effect.source === source && (stat == null || effect.stat === stat));
}

module.exports = {
  HIDDEN_COUNTERS: new Set([DEF_ATTACK_TURN]),

  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has(SHARD)) fighter.counters[SHARD] = 0;
  },

  counterStateText(_fighter, name, value) {
    return name === SHARD ? `${SHARD} ${Number(value)}` : undefined;
  },

  extraStateParts(battle, fighter) {
    return defAttackActive(battle, fighter) ? ["DEF 공격"] : [];
  },

  counterResourceValue(_fighter, name, raw) {
    return name === SHARD ? Math.min(900, Math.max(0, Number(raw) * 65)) : undefined;
  },

  defenseScoreBonusReduction(actor, action) {
    return action.isDefense ? defenseBonus(shards(actor) + 1) : 0;
  },

  setupValue(battle, actor, target, action) {
    if (action.isSkill(CHARACTER_ID, 1)) {
      const incoming = battle.estimateBestIncomingDamage(target, actor);
      let value = 220 + incoming * 0.45 + Math.max(0, 4 - shards(actor)) * 120;
      if (hasStatEffect(actor, "대지의 껍질", "def")) value -= 900;
      if (target.hp <= 60 && actor.mp >= 24) value -= 520;
      return value;
    }
    if (action.isSkill(CHARACTER_ID, 3)) {
      return hasStatEffect(actor, "거인의 힘") ? -450 : 1600 + Math.max(0, actor.hp - 70) * 3;
    }
    return 0;
  },

  onMakeChoice(battle, fighter, action) {
    if (action.isDefense) fighter.counters[DEF_ATTACK_TURN] = battle.turn + 1;
  },

  onActionStart(battle, choice) {
    const actor = choice.actor;
    if (choice.action.isDefense) {
      addCounter(battle, actor, SHARD, 1);
      choice.defenseBonusReduction = defenseBonus(shards(actor));
    }
    if (choice.action.isAttack && defAttackActive(battle, actor)) {
      choice.attackAtkOverride = battle.currentStats(actor)[1];
      battle.logs.push("최선의 공격은 방어: 피해 계산 시 ATK 대신 DEF를 사용한다.");
    }
    return false;
  },

  applyConditionEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 2)) return undefined;
    const before = shards(choice.actor);
    if (before < 1) return false;
    choice.actor.counters[SHARD] = before - 1;
    battle.logs.push(`${choice.actor.name}의 ${SHARD} ${before} -> ${before - 1}`);
    return undefined;
  },

  modifyDefenseMultiplierAsActor(battle, target, _amount, source, _reason, multiplier) {
    if (!source || battle.record.selectedKey[source.side] !== `${CHARACTER_ID}:0`) return multiplier;
    const reductionLoss = shards(source) * 0.1;
    if (reductionLoss <= 0) return multiplier;
    battle.logs.push(`암석 부수기: ${target.name}의 방어 경감률이 ${Math.round(reductionLoss * 100)}%p 감소했다.`);
    return multiplier + reductionLoss;
  },

  estimatedPower(battle, actor, _target, action, power) {
    if (!action.isAttack || !defAttackActive(battle, actor)) return power;
    const [atk, defense] = battle.currentStats(actor);
    return atk + 50 > 0 ? Math.max(1, floorInt(power * (defense + 50) / (atk + 50))) : power;
  },

  estimatedDamageMultipliers(_battle, actor, target, action) {
    if (!action.isSkill(CHARACTER_ID, 0) || target.defenseMult == null) return [];
    const adjusted = target.defenseMult + shards(actor) * 0.1;
    return [adjusted / target.defenseMult];
  },

  onHitAfterDefenseAsActor(battle, choice) {
    if (choice.action.isSkill(CHARACTER_ID, 2)) {
      battle.addStatEffect(battle.opponent(choice.actor), "def", 0.7, 3, choice.action.name);
    }
  },

  applyNonAttackEffects(battle, choice) {
    const actor = choice.actor;
    if (choice.action.isSkill(CHARACTER_ID, 1)) {
      battle.applyDefense(actor, choice.action.name, choice.defenseBonusReduction);
      battle.addStatEffect(actor, "def", 1.5, 2, choice.action.name);
      return true;
    }
    if (choice.action.isSkill(CHARACTER_ID, 3)) {
      battle.addStatEffect(actor, "atk", 2, 5, choice.action.name);
      battle.addStatEffect(actor, "def", 2, 5, choice.action.name);
      battle.addStatEffect(actor, "spd", 0.5, 5, choice.action.name);
      return true;
    }
    return false;
  },

  onTurnEnd(battle, fighter) {
    const activeTurn = Number(fighter.counters[DEF_ATTACK_TURN] || 0);
    if (activeTurn && activeTurn <= battle.turn) delete fighter.counters[DEF_ATTACK_TURN];
  },

  wouldConditionFail(_battle, actor, _target, action) {
    return action.isSkill(CHARACTER_ID, 2) ? shards(actor) < 1 : undefined;
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const shardCount = shards(actor);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const targetLow = target.hp <= Math.max(55, target.maxHp * 0.28);
    const lethal = action.isAttack && expectedDamage >= target.hp;
    const nearLethal = action.isAttack && expectedDamage >= target.hp * 0.72;

    if (action.isAttack) {
      value += expectedDamage * (0.75 + Math.min(shardCount, 6) * 0.08);
      if (defAttackActive(battle, actor)) value += 420 + expectedDamage * 1.15;
      if (lethal) value += 4200;
      else if (nearLethal) value += 1300;
      if (targetLow) value += 620;
      if (shardCount >= 4) value += 260 + Math.min(700, (shardCount - 3) * 150);
    }
    if (action.isDefense) {
      value += Math.min(4, shardCount + 1) * 100;
      if (incoming >= actor.hp) value += 2600;
      else if (incoming >= actor.hp * 0.62) value += 850 + incoming * 0.55;
      else value += incoming * 0.2;
      if (shardCount >= 4 && incoming < actor.hp * 0.85) value -= 620 + (shardCount - 4) * 360;
      if (targetLow && actor.mp >= 24) value -= 950;
      if (actor.mp < 35 && incoming < actor.hp * 0.75) value -= 420;
    }
    if (action.isSkill(CHARACTER_ID, 0)) {
      value += 340 + expectedDamage * 1.05;
      if (target.defenseMult != null) value += shardCount * 430 * hitRate;
      else if (recentAttackDefenseCount(battle, target) >= 2) value += shardCount * 180;
      if (actor.mp < 42) value += 320;
      if (lethal) value += 2800;
      else if (targetLow) value += 720;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      value += 300 + incoming * 0.55 + Math.max(0, 3 - shardCount) * 180;
      if (hasStatEffect(actor, "대지의 껍질", "def")) value -= 1150;
      if (shardCount >= 5 && incoming < actor.hp * 0.85) value -= 1200 + (shardCount - 5) * 300;
      if (actor.defenseStreak >= 2 && incoming < actor.hp) value -= 560;
      if (actor.mp < 40 && incoming < actor.hp * 0.8) value -= 620;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      if (shardCount < 1) value -= 4000;
      else {
        value += 640 * hitRate + expectedDamage * 0.9;
        if (defAttackActive(battle, actor)) value += 820 + expectedDamage * 0.7;
        if (!target.statEffects.some((effect) => effect.stat === "def" && effect.multiplier < 1)) value += 480;
        else value -= 160;
        if (lethal) value += 3200;
        else if (nearLethal) value += 900;
        if (shardCount <= 1 && !lethal && target.hp > 70) value -= 240;
        if (actor.mp < 38 && !lethal) value -= 420;
      }
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      if (hasStatEffect(actor, "거인의 힘")) value -= 900;
      else {
        value += 1650;
        if (battle.turn <= 4) value += 760;
        if (actor.hp > actor.maxHp * 0.45) value += 520;
        if (actor.hp <= incoming * 1.2) value -= 700;
        if (actor.mp >= 70) value += 360;
        if (actor.mp < 60) value -= 420;
        if (targetLow && actor.mp >= 24) value -= 480;
      }
    } else if (action.isCommonAction("meditation")) {
      if (actor.mp < 35) value += 620 + Math.max(0, 35 - actor.mp) * 18;
      if (defAttackActive(battle, actor) && targetLow) value -= 720;
      if (incoming >= actor.hp * 0.75) value -= 420;
    }
    return value;
  },
};

function recentAttackDefenseCount(battle, fighter, limit = 4) {
  let history = fighter.selectedHistory;
  if (Object.prototype.hasOwnProperty.call(battle.record.selected, fighter.side)) history = history.slice(0, -1);
  return history.slice(-limit).filter((key) => {
    if (key === "common:defense") return true;
    if (String(key).startsWith("common:")) return false;
    const [id, slotText] = String(key).split(":");
    const skill = id === fighter.characterId ? fighter.data.skills?.[Number(slotText)] : null;
    return skill != null && skill.power == null && String(skill.description || "").includes("자신이 이 턴에 입는 공격 피해를 경감");
  }).length;
}
