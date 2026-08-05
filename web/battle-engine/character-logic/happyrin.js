"use strict";

const CHARACTER_ID = "happyrin";
const MADNESS = "광증";
const MAX_MADNESS = 10;

function madnessStacks(fighter) {
  return Number(fighter.statuses[MADNESS]?.stacks || 0);
}

function addMadness(battle, fighter, turns, stacks, source) {
  battle.addStatus(fighter, MADNESS, turns, stacks, source, true, MAX_MADNESS);
}

function randomIntInclusive(battle, low, high) {
  return low + battle.rng.range(high - low + 1);
}

function activeSkillActions(battle, actor) {
  return battle.availableActions(actor).filter((action) => action.isActive);
}

function madnessResultValue(battle, actor, target, action, replaced, incoming) {
  const ownMadness = madnessStacks(actor);
  const targetMadness = madnessStacks(target);
  const hitRate = battle.estimateHitRate(actor, target, action) / 100;
  let damage = battle.estimateActionDamage(actor, target, action, false);
  if (replaced && action.isSkill(CHARACTER_ID, 1)) damage *= 2;
  if (replaced && action.isSkill(CHARACTER_ID, 2)) {
    const oneHit = battle.calculateEstimatedDamage(actor, target, action);
    const hitCap = madnessStacks(actor) + madnessStacks(target);
    damage = oneHit * ((1 + hitCap) / 2);
  }
  const expectedDamage = damage * hitRate;
  let value = expectedDamage * 3.2;
  if (action.isAttack && expectedDamage >= target.hp) value += 7200;
  else if (action.isAttack && damage >= target.hp) value += 4600 * hitRate;

  if (action.isSkill(CHARACTER_ID, 0)) {
    if (replaced) value += Math.max(0, Math.min(1, MAX_MADNESS - targetMadness)) * 360 * hitRate;
    else value += ownMadness < 4 ? 180 : -180;
  } else if (action.isSkill(CHARACTER_ID, 1)) {
    const ownAfterCondition = Math.min(MAX_MADNESS, ownMadness + 1);
    const stacks = ownAfterCondition * (replaced ? 2 : 1);
    const applied = Math.min(MAX_MADNESS - targetMadness, stacks);
    value += Math.max(0, applied) * (145 + ownAfterCondition * 18) * hitRate;
    if (ownMadness >= 8) value -= 220;
  } else if (action.isSkill(CHARACTER_ID, 2)) {
    const hitCap = ownMadness + (replaced ? targetMadness : 0);
    if (hitCap < 1) value -= 2400;
    else value += Math.min(10, hitCap) * 115 * hitRate;
    if (replaced && targetMadness >= 2) value += Math.min(6, targetMadness) * 140 * hitRate;
  } else if (action.isSkill(CHARACTER_ID, 3)) {
    const multiplier = replaced ? 1.7 : 1.2;
    value += multiplier < 1.5 ? 950 : 2550;
    value += Math.max(0, actor.maxHp - actor.hp) * (multiplier < 1.5 ? 0.8 : 1.25);
    if (incoming >= actor.hp) value -= 650;
    if (ownMadness >= 8) value -= 240;
  }
  if (replaced) value += 7 * 42;
  return value;
}

function madnessDecoyBonus(battle, actor, target, action, incoming) {
  const ownMadness = madnessStacks(actor);
  if (ownMadness <= 0 || !action.isActive) return 0;
  const proc = Math.min(1, ownMadness / 10);
  const options = activeSkillActions(battle, actor).filter((candidate) => candidate.key !== action.key);
  if (!options.length) return 0;
  const direct = madnessResultValue(battle, actor, target, action, false, incoming);
  const replacementValues = options.map((candidate) => madnessResultValue(battle, actor, target, candidate, true, incoming));
  const replacementAverage = replacementValues.reduce((sum, item) => sum + item, 0) / replacementValues.length;
  let bonus = (replacementAverage - direct) * proc;
  if (ownMadness >= 6 && replacementAverage > direct) {
    const bestReplacement = Math.max(...replacementValues);
    bonus += Math.max(0, bestReplacement - replacementAverage) * proc * 0.18;
    bonus *= 1 + (ownMadness - 5) * 0.22;
    bonus = Math.min(bonus, 1150 + ownMadness * 70);
    const pressure = incoming / Math.max(1, actor.hp);
    const hpRatio = actor.hp / Math.max(1, actor.maxHp);
    if (pressure >= 1) bonus *= 0.2;
    else if (pressure >= 0.65 && hpRatio < 0.55) bonus *= 0.4;
    else if (pressure >= 0.45 && hpRatio < 0.45) bonus *= 0.65;
  }
  return bonus;
}

function rawDamage(expectedDamage, hitRate) { return hitRate > 0 ? expectedDamage / hitRate : 0; }

module.exports = {
  onActionStartStatus(battle, choice) {
    const actor = choice.actor;
    const original = choice.action;
    if (choice.actionReplacementLocked) return false;
    const status = actor.statuses[MADNESS];
    if (!status || !original.isActive) return false;
    const chance = Math.min(100, Number(status.stacks) * 10);
    const roll = battle.roll(MADNESS);
    battle.logs.push(`광증 판정 ${chance}% / 판정값 ${roll.toFixed(2)}`);
    if (roll >= chance) return false;
    const options = activeSkillActions(battle, actor).filter((action) => action.key !== original.key);
    if (!options.length) return false;
    const replacement = battle.rng.choice(options);
    choice.action = replacement;
    choice.power = replacement.power;
    choice.accuracy = replacement.accuracy;
    choice.hitCount = 1;
    choice.madnessReplaced = true;
    choice.madnessOriginalActionKey = original.key;
    if (replacement.characterId === "gandrick") {
      choice.selectedBullets = replacement.isSkill("gandrick", 3) ? Number(actor.counters["탄환"] || 0) : null;
    }
    if (replacement.characterId === "balef" && replacement.isActive && replacement.isAttack && choice.prevAttackActive == null) {
      const selected = actor.selectedAttackActiveHistory || [];
      choice.prevAttackActive = selected.length ? selected[selected.length - 1] : null;
    }
    if (!battle.record.madnessDecided) battle.record.madnessDecided = {};
    battle.record.madnessDecided[actor.side] = true;
    battle.logs.push(`광증으로 ${original.name} 대신 ${replacement.name}이 결정되었다.`);
    return false;
  },

  applyConditionEffects(battle, choice) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    if (choice.action.isSkill(CHARACTER_ID, 1)) {
      addMadness(battle, actor, 2, 1, choice.action.name);
    } else if (choice.action.isSkill(CHARACTER_ID, 2)) {
      let cap = madnessStacks(actor);
      if (choice.madnessReplaced) cap += madnessStacks(target);
      if (cap < 1) return false;
      choice.hitCount = randomIntInclusive(battle, 1, cap);
      battle.logs.push(`[연격] 광증 중첩 수 ${cap} 기준으로 ${choice.hitCount}회로 결정되었다.`);
    }
    return true;
  },

  attackDamageMultipliers(_battle, choice) {
    return choice.action.isSkill(CHARACTER_ID, 1) && choice.madnessReplaced ? [2] : [];
  },

  onHitAfterDefenseAsActor(battle, choice) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    if (choice.action.isSkill(CHARACTER_ID, 0)) {
      addMadness(battle, choice.madnessReplaced ? target : actor, 5, 1, choice.action.name);
    } else if (choice.action.isSkill(CHARACTER_ID, 1)) {
      let stacks = madnessStacks(actor);
      if (choice.madnessReplaced) stacks *= 2;
      addMadness(battle, target, 4, stacks, choice.action.name);
    }
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 3)) return false;
    addMadness(battle, choice.actor, 4, 5, choice.action.name);
    const multiplier = choice.madnessReplaced ? 1.7 : 1.2;
    for (const stat of ["atk", "def", "spd"]) battle.addStatEffect(choice.actor, stat, multiplier, 4, choice.action.name);
    return true;
  },

  onTurnEnd(battle, fighter) {
    if ((battle.activeCharacterId?.(fighter) || fighter.characterId) !== CHARACTER_ID) return;
    const decided = battle.record.madnessDecided || {};
    const opponent = battle.opponent(fighter);
    if (decided[fighter.side]) battle.heal(fighter, 7, "복약 지도");
    if (decided[opponent.side]) battle.fixedDamage(opponent, 7, "복약 지도", fighter);
  },

  setupValue(battle, actor, target, action) {
    const ownMadness = madnessStacks(actor);
    const targetMadness = madnessStacks(target);
    if (action.isSkill(CHARACTER_ID, 3)) {
      const incoming = battle.estimateBestIncomingDamage(target, actor);
      if (ownMadness < 5) {
        let value = actor.hp > incoming * 1.15 ? 3500 : 950;
        if (action.mp <= actor.mp && actor.mp <= action.mp + 16) value += 520;
        return value;
      }
      return 240;
    }
    if (action.isSkill(CHARACTER_ID, 1)) return Math.max(180, (MAX_MADNESS - targetMadness) * 70);
    if (action.isSkill(CHARACTER_ID, 0) && ownMadness < 3) return 220;
    return 0;
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const damage = rawDamage(expectedDamage, hitRate);
    const ownMadness = madnessStacks(actor);
    const targetMadness = madnessStacks(target);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    value += madnessDecoyBonus(battle, actor, target, action, incoming);
    if (ownMadness >= 6 && action.isActive) value -= (ownMadness - 5) * 130;
    if (ownMadness >= 7 && action.isCommonAction("meditation")) value += 260;

    if (action.isSkill(CHARACTER_ID, 0)) {
      value += Math.max(0, 4 - ownMadness) * 120;
      if (ownMadness === 0) {
        const turnMp = battle.turnEndMpRecovery(actor);
        if (action.mp <= actor.mp && actor.mp < 37 && actor.mp + turnMp < 37) value += 900;
        else if (actor.mp + turnMp >= 37) value -= 260;
      } else if (ownMadness <= 2) value += 360;
      if (ownMadness >= 6) value -= 180;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      value += Math.max(1, ownMadness + 1) * 150 * hitRate;
      value += Math.max(0, 6 - targetMadness) * 90;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      if (damage >= target.hp) value += 1800;
      else value += Math.max(0, ownMadness - 1) * 170 * hitRate;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      value += 620;
      if (ownMadness < 5) {
        value += 800;
        if (actor.hp > incoming * 1.15) value += 720;
      }
      if (incoming >= actor.hp) value -= 500;
    }
    return value;
  },

  estimatedHitCount(actor, action, useMax) {
    if (!action.isSkill(CHARACTER_ID, 2)) return null;
    const cap = Math.max(1, madnessStacks(actor));
    return useMax ? cap : (1 + cap) / 2;
  },

  wouldConditionFail(_battle, actor, _target, action) {
    return action.isSkill(CHARACTER_ID, 2) ? madnessStacks(actor) < 1 : null;
  },
};
