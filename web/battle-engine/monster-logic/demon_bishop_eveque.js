"use strict";

const CHARACTER_ID = "demon_bishop_eveque";
const REPEAT_SLOT = 0;
const SANCTUARY_SLOT = 1;
const CHANGE_SLOT = 2;
const SANCTUARY_NAME = "회색의 성역";
const SANCTUARY_FLAG = "evequeSanctuaryActive";

function previousActionHistory(battle, fighter) {
  let history = fighter.selectedHistory || [];
  if (Object.hasOwn(battle.record.selected, fighter.side)) history = history.slice(0, -1);
  return history;
}

function previousActionKey(battle, fighter) {
  return previousActionHistory(battle, fighter).at(-1) || null;
}

function currentActionRelation(battle, fighter) {
  const previous = previousActionKey(battle, fighter);
  const current = battle.record.selectedKey[fighter.side];
  if (!previous || !current) return null;
  return current === previous ? "repeat" : "change";
}

function repeatChance(battle, fighter) {
  const history = previousActionHistory(battle, fighter).slice(-6);
  if (!history.length) return null;
  if (history.length === 1) return 0.35;
  let repeats = 0;
  for (let index = 1; index < history.length; index += 1) {
    if (history[index] === history[index - 1]) repeats += 1;
  }
  const transitions = history.length - 1;
  return Math.max(0.2, Math.min(0.65, (repeats + 1) / (transitions + 3)));
}

function targetAttackChance(battle, target) {
  const counts = battle.recentKindCounts(target, 4);
  const total = counts.attack + counts.defense + counts.meditation;
  return total > 0 ? counts.attack / total : 0.5;
}

module.exports = {
  hiddenCounters: [SANCTUARY_FLAG],

  resetTurnFlags(_battle, fighter) {
    fighter.counters[SANCTUARY_FLAG] = 0;
  },

  attackDamageMultipliers(battle, choice) {
    const target = battle.opponent(choice.actor);
    const relation = currentActionRelation(battle, target);
    if (choice.action.isSkill(CHARACTER_ID, REPEAT_SLOT) && relation === "repeat") return [1.5];
    if (choice.action.isSkill(CHARACTER_ID, CHANGE_SLOT) && relation === "change") return [1.3];
    return [];
  },

  estimatedDamageMultipliers(battle, _actor, target, action) {
    const chance = repeatChance(battle, target);
    if (chance == null) return [];
    if (action.isSkill(CHARACTER_ID, REPEAT_SLOT)) return [1 + chance * 0.5];
    if (action.isSkill(CHARACTER_ID, CHANGE_SLOT)) return [1 + (1 - chance) * 0.3];
    return [];
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, SANCTUARY_SLOT)) return false;
    battle.applyDefense(choice.actor, SANCTUARY_NAME, choice.defenseBonusReduction);
    choice.actor.counters[SANCTUARY_FLAG] = 1;
    battle.logs.push(`${choice.actor.name}이 회색의 성역을 펼쳤다.`);
    return true;
  },

  onTurnEnd(battle, fighter) {
    if (Number(fighter.counters[SANCTUARY_FLAG] || 0) <= 0) return;
    fighter.counters[SANCTUARY_FLAG] = 0;
    if (Number(battle.record.attackDamageTaken[fighter.side] || 0) > 0) return;
    battle.heal(fighter, Math.trunc(fighter.maxHp * 0.15), SANCTUARY_NAME);
  },

  aiScore(battle, actor, target, action, expectedDamage) {
    const chance = repeatChance(battle, target);
    if (action.isSkill(CHARACTER_ID, REPEAT_SLOT)) {
      return 170 + Number(expectedDamage || 0) * 0.35 + Number(chance || 0) * 420;
    }
    if (action.isSkill(CHARACTER_ID, SANCTUARY_SLOT)) {
      const missingHp = Math.max(0, actor.maxHp - actor.hp);
      const possibleHeal = Math.min(missingHp, Math.trunc(actor.maxHp * 0.15));
      const attackChance = targetAttackChance(battle, target);
      const incoming = battle.estimateBestIncomingDamage(target, actor);
      return 240 + incoming * attackChance * 0.55 + possibleHeal * (1 - attackChance) * 2.4;
    }
    if (action.isSkill(CHARACTER_ID, CHANGE_SLOT)) {
      return 210 + Number(expectedDamage || 0) * 0.4 + (chance == null ? 0 : 1 - chance) * 360;
    }
    return 0;
  },
};
