"use strict";

const CHARACTER_ID = "dethus";

function floorInt(value) {
  return Math.floor(value);
}

function recentKindCounts(battle, fighter) {
  return typeof battle.recentKindCounts === "function"
    ? battle.recentKindCounts(fighter)
    : { attack: 0, defense: 0, meditation: 0 };
}

function skillByKey(fighter, key) {
  if (typeof fighter.skillByKey === "function") return fighter.skillByKey(key);
  const match = /^([^:]+):(\d+)$/.exec(String(key || ""));
  if (!match || match[1] !== fighter.characterId) return null;
  return fighter.data.skills?.[Number(match[2])] || null;
}

function recentHighMpSkillCount(target) {
  let count = 0;
  for (const key of target.selectedHistory.slice(-4)) {
    const previous = skillByKey(target, key);
    if (previous && Number(previous.mp || 0) >= 35) count += 1;
  }
  return count;
}

function highMpSkillRead(target) {
  let value = recentHighMpSkillCount(target);
  if (target.mp >= 70) value += 1.2;
  else if (target.mp >= 48) value += 0.7;
  return value;
}

function onDefenseHit(battle, choice) {
  const actor = choice.actor;
  const target = battle.opponent(actor);
  if (target.defenseName !== "빠져드는 모래늪") return;
  const spent = Number(battle.record.activeAttackMpSpent[actor.side] || 0);
  if (spent <= 0) return;
  const reduced = battle.reduceMp(actor, floorInt(spent * 0.25), "빠져드는 모래늪");
  battle.restoreMp(target, reduced, "빠져드는 모래늪");
}

module.exports = {
  preMpTurnEnd(battle, fighter) {
    const thirst = fighter.statuses["갈증"];
    if (thirst && fighter.mp <= 9) {
      battle.fixedDamage(fighter, Number(thirst.stacks) * 3, `갈증 ${thirst.stacks}중첩`, fighter);
    }
  },

  modifyAttackPower(battle, choice, power) {
    if (!choice.action.isCommonAction("normal_attack")) return power;
    const thirst = battle.opponent(choice.actor).statuses["갈증"];
    return Number(power) + (thirst ? Number(thirst.stacks) * 2 : 0);
  },

  estimatedPower(_battle, _actor, target, action, power) {
    if (!action.isCommonAction("normal_attack")) return power;
    const thirst = target.statuses["갈증"];
    return Number(power) + (thirst ? Number(thirst.stacks) * 2 : 0);
  },

  onHitAfterDefenseAsActor(battle, choice) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    const action = choice.action;
    if (action.isSkill(CHARACTER_ID, 3)) {
      const reduced = battle.reduceMp(target, 50, "말라붙는 대지");
      const stacks = floorInt(reduced * 0.1);
      if (stacks > 0) battle.addStatus(target, "갈증", 4, stacks, actor.name, true);
    } else if (action.isSkill(CHARACTER_ID, 0)) {
      const selectedKind = battle.record.selectedKind[target.side];
      if (selectedKind === "액티브 공격" || selectedKind === "액티브 비공격") {
        battle.addStatus(target, "갈증", 4, 1, actor.name, true);
      }
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      battle.reduceMp(target, 15, "신기루의 저주");
      battle.addStatus(target, "갈증", 3, 1, actor.name, true);
    }
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    battle.applyDefense(choice.actor, choice.action.name);
    return true;
  },

  onDefenseHit,
  onHitAfterDefenseAsTarget: onDefenseHit,

  aiScore(battle, actor, target, action) {
    let value = 0;
    const thirst = target.statuses["갈증"];
    const thirstStacks = thirst ? Number(thirst.stacks) : 0;
    const counts = recentKindCounts(battle, target);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const highMpRead = highMpSkillRead(target);
    const meditationLoop = Number(counts.meditation || 0) >= 2;

    if (action.isCommonAction("normal_attack")) {
      value += thirstStacks * 170;
      if (meditationLoop) value += 360 + thirstStacks * 180;
    } else if (action.isSkill(CHARACTER_ID, 0)) {
      if (highMpRead > 0 || Number(counts.attack || 0) + Number(counts.meditation || 0) > Number(counts.defense || 0)) {
        value += 260 + highMpRead * 180;
      }
      if (thirstStacks <= 0) value += 140;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      value += incoming * 1.15 + Number(counts.attack || 0) * 240;
      if (highMpRead >= 1) value += 380;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      if (highMpRead >= 1) value += 780 + highMpRead * 420;
      if (target.mp >= 35) value += Math.min(700, target.mp * 8);
      if (target.mp <= 15) value -= 420;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      if (meditationLoop) value += 2100 + Math.min(1200, target.mp * 14);
      else if (target.mp >= 72) value += 1150;
      else if (target.mp < 38) value -= 900;
      if (thirstStacks >= 3) value += thirstStacks * 140;
    }
    return value;
  },
};
