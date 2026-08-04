"use strict";

const CHARACTER_ID = "plote";

function floorInt(value) {
  return Math.floor(value);
}

function recentKindCounts(battle, fighter) {
  return typeof battle.recentKindCounts === "function"
    ? battle.recentKindCounts(fighter)
    : { attack: 0, defense: 0, meditation: 0 };
}

function addCostEffect(battle, fighter, multiplier, turns, source) {
  if (typeof battle.addCostEffect === "function") {
    battle.addCostEffect(fighter, multiplier, turns, source);
    return;
  }
  const current = fighter.costEffects.find((effect) => effect.source === source);
  if (current) {
    current.multiplier = Number(multiplier);
    current.remaining = Math.max(current.remaining, Number(turns));
  } else {
    fighter.costEffects.push({ multiplier: Number(multiplier), remaining: Number(turns), source });
  }
  battle.logs.push(`${fighter.name}의 액티브 스킬 MP 소모량이 ${turns}턴 동안 x${multiplier}가 된다.`);
}

function onDefenseHit(battle, choice) {
  const actor = choice.actor;
  const target = battle.opponent(actor);
  if (target.defenseName === "가로막는 불길") {
    battle.addStatus(actor, "화상", 5, 1, target.name, true);
  }
}

module.exports = {
  onActionStartStatus(battle, choice) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    const burn = actor.statuses["화상"];
    if (!burn || !choice.action.isAttack) return false;
    const damage = floorInt(actor.maxHp * 0.015 * burn.stacks);
    if (damage <= 0) return false;
    battle.fixedDamage(actor, damage, `화상 ${burn.stacks}중첩`, target);
    if ((battle.activeCharacterId?.(target) || target.characterId) === CHARACTER_ID) {
      battle.restoreMp(target, floorInt(burn.stacks * 0.5), "영혼 연소");
    }
    return battle.gameOver;
  },

  applyConditionEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 2)) return undefined;
    const actor = choice.actor;
    if (Number(battle.record.attackDamageTaken[actor.side] || 0) > 0) return false;
    const burn = battle.opponent(actor).statuses["화상"];
    const stacks = burn ? Number(burn.stacks) : 0;
    choice.power = Number(choice.power || 0) + stacks;
    battle.logs.push(`화상 중첩 수 ${stacks}로 위력이 ${stacks} 증가했다.`);
    return undefined;
  },

  onHitAfterDefenseAsActor(battle, choice) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    const action = choice.action;
    if (action.isSkill(CHARACTER_ID, 0)) {
      if (battle.roll("화상 부여") < 60) battle.addStatus(target, "화상", 3, 3, actor.name, true);
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      battle.addStatus(target, "화상", 4, 4, actor.name, true);
      addCostEffect(battle, target, 1.2, 4, action.name);
    }
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    battle.applyDefense(choice.actor, choice.action.name);
    return true;
  },

  onDefenseHit,
  onHitAfterDefenseAsTarget: onDefenseHit,

  aiScore(battle, actor, target, action, _expectedDamage, _hitRate) {
    let value = 0;
    const burn = target.statuses["화상"];
    const burnStacks = burn ? Number(burn.stacks) : 0;
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const counts = recentKindCounts(battle, target);

    if (action.isSkill(CHARACTER_ID, 0) && burnStacks <= 1) value += 160;
    if (action.isSkill(CHARACTER_ID, 1)) {
      value += incoming * 0.9 + Number(counts.attack || 0) * 180;
    }
    if (action.isSkill(CHARACTER_ID, 2)) {
      value += burnStacks * 70;
      if (burnStacks > 0 && Number(counts.attack || 0) <= Number(counts.defense || 0) + Number(counts.meditation || 0)) {
        value += burnStacks * 115 + (Number(counts.defense || 0) + Number(counts.meditation || 0)) * 360;
      }
      if (burnStacks >= 5 && Number(counts.attack || 0) === 0) value += 680;
      if (incoming > 0 && Number(counts.attack || 0) >= Number(counts.defense || 0) + Number(counts.meditation || 0)) {
        value -= Math.min(850, incoming * 16);
      }
      if (burnStacks <= 0) value -= 180;
    }
    if (action.isSkill(CHARACTER_ID, 3)) value += Math.max(0, 4 - burnStacks) * 75;
    return value;
  },
};
