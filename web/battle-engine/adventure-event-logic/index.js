"use strict";

const STAT_FIELDS = Object.freeze({
  atk: { label: "ATK", field: "baseAtk" },
  def: { label: "DEF", field: "baseDef" },
  spd: { label: "SPD", field: "baseSpd" },
});

function applyExtendedAdventureEventChoice({ battle, adventure, event, choice, hpCost = 0, mpCost = 0 }) {
  const fighter = battle.player;
  const effect = choice.effect || {};
  let result = { id: choice.id, type: effect.type };

  switch (effect.type) {
    case "forge_skill_power": {
      const action = randomActiveSkill(battle, fighter, { requiresPower: true });
      const spent = mpCost > 0
        ? spendMp(battle, fighter, mpCost, "무기 벼리기")
        : { mpBefore: fighter.mp, mpAfter: fighter.mp, mpSpent: 0 };
      result = { ...result, ...spent, skill: applySkillModifier(fighter, adventure, action, "power", effect.skillPowerMultiplier || 1.2) };
      break;
    }
    case "forge_defense":
      result = {
        ...result,
        hp: loseHp(fighter, hpCost),
        stats: applyStatDeltas(battle, adventure, { [effect.statId || "def"]: Number(effect.statBonus || 0.2) }),
      };
      break;
    case "forge_skill_tradeoff": {
      const action = randomActiveSkill(battle, fighter, { attacksOnly: true, requiresPower: true });
      result = {
        ...result,
        costSkill: applySkillModifier(fighter, adventure, action, "cost", effect.skillCostMultiplier || 0.7),
        powerSkill: applySkillModifier(fighter, adventure, action, "power", effect.skillPowerMultiplier || 0.9),
      };
      break;
    }
    case "witch_red_potion":
      result = { ...result, maxHp: multiplyMaxHp(fighter, effect.maxHpMultiplier || 0.9), heal: restoreHp(battle, fighter, 1, "붉은 약") };
      break;
    case "witch_blue_potion":
      result = { ...result, restore: restoreMp(battle, fighter, 1, "푸른 약") };
      result.nextBattleEffect = addNextBattleEffect(adventure, {
        type: "all_skill_cost",
        battlesRemaining: 1,
        multiplier: Number(effect.nextBattleSkillCostMultiplier || 1.2),
      });
      break;
    case "witch_black_potion": {
      const roll = battle.roll();
      const success = roll < Number(effect.successRate || 0.5) * 100;
      const delta = success ? Number(effect.successStatBonus || 0.2) : -Number(effect.failureStatPenalty || 0.1);
      result = {
        ...result,
        roll: roundStat(roll),
        success,
        stats: applyStatDeltas(battle, adventure, { atk: delta, def: delta, spd: delta }, success ? null : event.id),
      };
      break;
    }
    case "mirror_raise_lowest_stat": {
      const statId = lowestStatId(adventure);
      result = { ...result, statId, stats: applyStatDeltas(battle, adventure, { [statId]: Number(effect.statBonus || 0.2) }) };
      break;
    }
    case "mirror_remove_penalty":
      result = { ...result, hp: loseHp(fighter, hpCost), removedPenalties: removePenaltyBundles(battle, adventure, Number(effect.removePenaltyCount || 1)) };
      break;
    case "mirror_retreat":
      result = { ...result, heal: restoreHp(battle, fighter, Number(effect.restoreHpRate || 0.1), "달빛 호수"), ambush: adjustAmbushIndex(adventure, Number(effect.ambushChanceStep || -1)) };
      break;
    case "library_tactics":
      result.nextBattleEffect = addNextBattleEffect(adventure, {
        type: "damage",
        battlesRemaining: Number(effect.battleCount || 2),
        multiplier: Number(effect.damageMultiplier || 1.15),
      });
      result.battleCount = Number(effect.battleCount || 2);
      break;
    case "library_skill_cost": {
      const action = randomActiveSkill(battle, fighter);
      result.costSkill = applySkillModifier(fighter, adventure, action, "cost", Number(effect.skillCostMultiplier || 0.8));
      if (Number(effect.maxMpPenalty || 0) > 0) {
        result.maxMp = changeMaxMp(fighter, -Number(effect.maxMpPenalty));
      }
      result.skillName = action.name;
      break;
    }
    case "storm_imbue_skill": {
      const action = randomActiveSkill(battle, fighter, { requiresAccuracy: true });
      result.costSkill = applySkillModifier(fighter, adventure, action, "cost", Number(effect.skillCostMultiplier || 0.75));
      result.accuracySkill = applySkillModifier(fighter, adventure, action, "accuracy", -Number(effect.accuracyPenalty || 5));
      result.skillName = action.name;
      break;
    }
    case "library_forbidden_book":
      result = { ...result, maxMp: changeMaxMp(fighter, Number(effect.maxMpBonus || 20)), maxHp: multiplyMaxHp(fighter, effect.maxHpMultiplier || 0.9) };
      break;
    case "nest_bonus_battle":
      return { ...result, startsBattle: true, battleConfig: { enemyStartingHpRate: Number(effect.enemyStartingHpRate || 0.8), rewardChoiceCount: Number(effect.rewardChoiceCount || 2) } };
    case "nest_steal_egg":
      adventure.battleStartMpRecovery = Number(adventure.battleStartMpRecovery || 0) + Number(effect.battleStartMpRecovery || 5);
      result = { ...result, battleStartMpRecovery: adventure.battleStartMpRecovery, ambush: adjustAmbushIndex(adventure, Number(effect.ambushChanceStep || 1)) };
      break;
    case "nest_detour":
      adventure.nextAmbushChanceOverride = Number(effect.nextAmbushChance ?? 0);
      result.nextAmbushChance = adventure.nextAmbushChanceOverride;
      break;
    case "passage_return": {
      const snapshot = adventure.previousBattleSnapshot;
      const before = { hp: fighter.hp, mp: fighter.mp };
      if (snapshot) {
        fighter.hp = clamp(Number(snapshot.hp), 0, fighter.maxHp);
        fighter.mp = clamp(Number(snapshot.mp), 0, fighter.maxMp);
      }
      result = { ...result, before, after: { hp: fighter.hp, mp: fighter.mp }, restored: Boolean(snapshot) };
      break;
    }
    case "passage_shortcut":
      result.stats = applyStatDeltas(battle, adventure, allStatDeltas(Number(effect.allStatBonus || 0.1)));
      adventure.pendingStageAdvance = Number(adventure.pendingStageAdvance || 0) + Number(effect.advanceStage || 1);
      result.advanceStage = Number(effect.advanceStage || 1);
      break;
    case "passage_blockade":
      result.nextBattleEffect = addNextBattleEffect(adventure, { type: "skip_enemy_action", battlesRemaining: 1 });
      result.skipEnemyFirstTurn = true;
      break;
    case "merchant_survival_amulet":
      result.hp = loseHp(fighter, hpCost);
      adventure.playerSurviveDefeatCount = Number(adventure.playerSurviveDefeatCount || 0) + Number(effect.surviveDefeatCount || 1);
      fighter.adventureSurviveDefeatCount = adventure.playerSurviveDefeatCount;
      result.surviveDefeatCount = adventure.playerSurviveDefeatCount;
      break;
    case "merchant_hourglass":
      result = { ...result, ...spendMp(battle, fighter, mpCost || 30, "모래시계") };
      adventure.nextAmbushChanceOverride = Number(effect.nextAmbushChance ?? 0);
      adventure.routeRerollCount = Number(adventure.routeRerollCount || 0) + Number(effect.routeRerollCount || 1);
      result.nextAmbushChance = adventure.nextAmbushChanceOverride;
      result.routeRerollCount = adventure.routeRerollCount;
      break;
    case "merchant_sell_memory": {
      const statId = battle.rng.choice(Object.keys(STAT_FIELDS));
      result = {
        ...result,
        statId,
        stats: applyStatDeltas(battle, adventure, { [statId]: -Number(effect.randomStatPenalty || 0.1) }, event.id),
        heal: restoreHp(battle, fighter, Number(effect.restoreHpRate || 1), "기억의 대가"),
        restore: restoreMp(battle, fighter, Number(effect.restoreMpRate || 1), "기억의 대가"),
      };
      break;
    }
    case "idol_gamble": {
      const roll = battle.roll();
      const success = roll < Number(effect.successRate || 0.5) * 100;
      const statId = battle.rng.choice(Object.keys(STAT_FIELDS));
      const delta = success ? Number(effect.successStatBonus || 0.4) : -Number(effect.failureStatPenalty || 0.2);
      result = { ...result, roll: roundStat(roll), success, statId, stats: applyStatDeltas(battle, adventure, { [statId]: delta }, success ? null : event.id) };
      break;
    }
    case "idol_purify":
      result = { ...result, ...spendMp(battle, fighter, mpCost || 30, "우상 정화"), removedPenalties: removePenaltyBundles(battle, adventure, Infinity) };
      break;
    case "idol_destroy":
      result.hp = loseHp(fighter, hpCost);
      adventure.futureEnemyMaxHpMultiplier = roundStat(Number(adventure.futureEnemyMaxHpMultiplier || 1) * Number(effect.futureEnemyMaxHpMultiplier || 0.95));
      result.futureEnemyMaxHpMultiplier = adventure.futureEnemyMaxHpMultiplier;
      break;
    case "camp_sleep":
      result.heal = restoreHp(battle, fighter, Number(effect.restoreHpRate || 0.5), "야영지 휴식");
      adventure.nextAmbushChanceOverride = Number(effect.nextAmbushChance ?? 100);
      result.nextAmbushChance = adventure.nextAmbushChanceOverride;
      break;
    case "camp_rations":
      result.heal = restoreHp(battle, fighter, Number(effect.restoreHpRate || 0.2), "야영지 식량");
      result.postBattleHeal = changePostBattleHeal(adventure, Number(effect.postBattleHealRateBonus || 0.05));
      break;
    case "camp_training": {
      result.hp = loseHp(fighter, Number(effect.hpLoss || 10));
      const statId = lowestStatId(adventure);
      result.statId = statId;
      result.stats = applyStatDeltas(battle, adventure, { [statId]: Number(effect.lowestStatBonus || 0.15) });
      break;
    }
    case "crossroads_preview":
      adventure.routeRerollCount = Number(adventure.routeRerollCount || 0) + Number(effect.routeRerollCount || 1);
      result.routeRerollCount = adventure.routeRerollCount;
      break;
    case "crossroads_hidden_gold":
      break;
    case "crossroads_skip_stage":
      result.hp = loseHp(fighter, hpCost);
      adventure.pendingStageAdvance = Number(adventure.pendingStageAdvance || 0) + Number(effect.advanceStage || 1);
      result.advanceStage = Number(effect.advanceStage || 1);
      break;
    case "graveyard_prayer":
      result.nextBattleEffect = addNextBattleEffect(adventure, {
        type: "turn_end_mp",
        battlesRemaining: Number(effect.battleCount || 3),
        amount: Number(effect.turnEndMpBonus || 2),
      });
      result.battleCount = Number(effect.battleCount || 3);
      break;
    case "graveyard_dig": {
      const roll = battle.roll();
      const success = roll < Number(effect.successRate || 0.7) * 100;
      result = { ...result, roll: roundStat(roll), success };
      if (success) {
        const statId = battle.rng.choice(Object.keys(STAT_FIELDS));
        result.statId = statId;
        result.stats = applyStatDeltas(battle, adventure, { [statId]: Number(effect.randomStatBonus || 0.2) });
      } else {
        result.hp = loseHp(fighter, Math.trunc(fighter.maxHp * Number(effect.failureHpLossRate || 0.25)));
      }
      break;
    }
    case "graveyard_elite_battle":
      return { ...result, startsBattle: true, battleConfig: { enemyAllStatMultiplier: Number(effect.enemyAllStatMultiplier || 1.15), victoryMaxHpMultiplier: Number(effect.victoryMaxHpMultiplier || 1.2) } };
    case "knight_sword":
    case "knight_shield": {
      const deltas = {};
      for (const [statId, value] of Object.entries(effect.statBonus || {})) deltas[statId] = Number(value);
      for (const [statId, value] of Object.entries(effect.statPenalty || {})) deltas[statId] = -Number(value);
      result.stats = applyStatDeltas(battle, adventure, deltas, event.id);
      break;
    }
    case "knight_burial":
      result = { ...result, maxHp: multiplyMaxHp(fighter, effect.maxHpMultiplier || 1.1), heal: restoreHp(battle, fighter, Number(effect.restoreHpRate || 0.3), "기사의 안식") };
      break;
    case "storm_absorb": {
      const roll = battle.roll();
      const success = roll < Number(effect.successRate || 0.7) * 100;
      result = { ...result, roll: roundStat(roll), success, mpBefore: fighter.mp };
      if (success) result.maxMp = changeMaxMp(fighter, Number(effect.successMaxMpBonus || 20));
      else {
        result.maxMp = changeMaxMp(fighter, -Number(effect.failureMaxMpPenalty || 10));
        fighter.mp = Number(effect.failureSetMp || 0);
      }
      result.mpAfter = fighter.mp;
      break;
    }
    case "storm_release":
      result.nextBattleEffect = addNextBattleEffect(adventure, {
        type: "both_turn_end_fixed_damage",
        battlesRemaining: 1,
        amount: Number(effect.nextBattleBothTurnEndFixedDamage || 5),
      });
      result.stats = applyStatDeltas(battle, adventure, { [effect.statId || "atk"]: Number(effect.statBonus || 0.2) });
      break;
    case "garden_white_flower":
      result.stats = applyStatDeltas(battle, adventure, { [effect.statId || "atk"]: -Number(effect.statPenalty || 0.1) }, event.id);
      result.heal = restoreHp(battle, fighter, Number(effect.restoreHpRate || 1), "흰 꽃");
      break;
    case "garden_black_flower":
      result.stats = applyStatDeltas(battle, adventure, { [effect.statId || "atk"]: Number(effect.statBonus || 0.2) });
      result.postBattleHeal = changePostBattleHeal(adventure, -Number(effect.postBattleHealRatePenalty || 0.1));
      break;
    case "garden_gray_flower": {
      const deltas = {};
      for (const [statId, value] of Object.entries(effect.statBonus || {})) deltas[statId] = Number(value);
      result.stats = applyStatDeltas(battle, adventure, deltas);
      result.maxMp = changeMaxMp(fighter, -Number(effect.maxMpPenalty || 10));
      break;
    }
    case "workbench_overload": {
      const action = randomActiveSkill(battle, fighter, { attacksOnly: true, requiresPower: true });
      result.costSkill = applySkillModifier(fighter, adventure, action, "cost", Number(effect.skillCostMultiplier || 1.3));
      result.powerSkill = applySkillModifier(fighter, adventure, action, "power", Number(effect.skillPowerMultiplier || 1.4));
      result.skillName = action.name;
      break;
    }
    case "workbench_shortcut": {
      const action = randomActiveSkill(battle, fighter);
      result.costSkill = applySkillModifier(fighter, adventure, action, "cost", Number(effect.skillCostMultiplier || 1.2));
      result.prioritySkill = applySkillModifier(fighter, adventure, action, "priority", Number(effect.priorityBonus || 1));
      result.skillName = action.name;
      break;
    }
    case "workbench_aim": {
      const action = randomActiveSkill(battle, fighter, {
        attacksOnly: true,
        requiresPower: true,
        requiresAccuracy: true,
        accuracyBelow: Number(effect.accuracyBelow || 100),
      });
      result.powerSkill = applySkillModifier(fighter, adventure, action, "power", Number(effect.skillPowerMultiplier || 0.9));
      result.accuracySkill = applySkillModifier(fighter, adventure, action, "accuracy", Number(effect.accuracyBonus || 20));
      result.skillName = action.name;
      break;
    }
    case "common_action_mastery": {
      const actionKind = String(effect.actionKind || "");
      const action = commonAction(battle, fighter, actionKind);
      if (actionKind === "normal_attack") {
        const before = Number(adventure.playerCommonAttackPowerBonus || 0);
        const after = roundStat(before + Number(effect.powerBonus || 8));
        adventure.playerCommonAttackPowerBonus = after;
        fighter.adventureCommonAttackPowerBonus = after;
        result.commonAction = {
          kind: actionKind,
          name: action.name,
          before: Number(action.power || 0) + before,
          after: Number(action.power || 0) + after,
          unit: "power",
        };
      } else if (actionKind === "defense") {
        const before = Number(adventure.playerCommonDefenseReductionBonus || 0);
        const after = roundStat(before + Number(effect.defenseReductionBonus || 0.15));
        adventure.playerCommonDefenseReductionBonus = after;
        fighter.adventureCommonDefenseReductionBonus = after;
        result.commonAction = { kind: actionKind, name: action.name, before, after, unit: "defense" };
      } else if (actionKind === "meditation") {
        const before = Number(adventure.playerMeditationRecoveryBonus || 0);
        const after = roundStat(before + Number(effect.meditationRecoveryBonus || 10));
        adventure.playerMeditationRecoveryBonus = after;
        fighter.adventureMeditationRecoveryBonus = after;
        result.commonAction = { kind: actionKind, name: action.name, before, after, unit: "meditation" };
      } else {
        throw new Error("알 수 없는 공통 행동입니다.");
      }
      break;
    }
    case "battle_rhythm": {
      const rhythm = {
        kind: String(effect.rhythm || ""),
        earlyTurnEnd: Math.max(1, Math.trunc(Number(effect.earlyTurnEnd || 2))),
        earlyOutgoingDamageMultiplier: Number(effect.earlyOutgoingDamageMultiplier || 1),
        lateOutgoingDamageMultiplier: Number(effect.lateOutgoingDamageMultiplier || 1),
        earlyIncomingDamageMultiplier: Number(effect.earlyIncomingDamageMultiplier || 1),
        lateIncomingDamageMultiplier: Number(effect.lateIncomingDamageMultiplier || 1),
      };
      adventure.playerBattleRhythm = rhythm;
      fighter.adventureBattleRhythm = { ...rhythm };
      result.rhythm = { ...rhythm };
      break;
    }
    case "reward_specialization": {
      const specialization = {
        preferredStat: String(effect.preferredStat || "atk"),
        preferredBonus: Number(effect.preferredBonus || 0.2),
        otherBonus: Number(effect.otherBonus || 0.05),
        battlesRemaining: Math.max(1, Math.trunc(Number(effect.battleCount || 3))),
      };
      adventure.rewardSpecialization = specialization;
      result.rewardSpecialization = { ...specialization };
      result.battleCount = specialization.battlesRemaining;
      break;
    }
    default:
      throw new Error("아직 구현되지 않은 Adventure 이벤트입니다.");
  }

  return result;
}

function activeSkills(battle, fighter) {
  return battle.availableActions(fighter).filter((action) => action.isActive);
}

function randomActiveSkill(
  battle,
  fighter,
  { attacksOnly = false, requiresPower = false, requiresAccuracy = false, accuracyBelow = null } = {},
) {
  const actions = activeSkills(battle, fighter).filter((action) => {
    if (attacksOnly && !action.isAttack) return false;
    if (requiresPower && !Number.isFinite(Number(action.power))) return false;
    if (requiresAccuracy && (action.accuracy == null || !Number.isFinite(Number(action.accuracy)))) return false;
    if (accuracyBelow != null && Number(action.accuracy) >= Number(accuracyBelow)) return false;
    return true;
  });
  if (!actions.length) throw new Error("조건에 맞는 액티브 스킬이 없습니다.");
  return battle.rng.choice(actions);
}

function applySkillModifier(fighter, adventure, action, kind, multiplierOrDelta) {
  const fields = {
    cost: ["playerSkillCostMultipliers", "adventureSkillCostMultipliers"],
    power: ["playerSkillPowerMultipliers", "adventureSkillPowerMultipliers"],
    accuracy: ["playerSkillAccuracyModifiers", "adventureSkillAccuracyModifiers"],
    priority: ["playerSkillPriorityModifiers", "adventureSkillPriorityModifiers"],
  };
  const [adventureField, fighterField] = fields[kind] || [];
  if (!adventureField) throw new Error("알 수 없는 스킬 강화 종류입니다.");
  const values = { ...(adventure[adventureField] || {}) };
  const additive = kind === "accuracy" || kind === "priority";
  const before = Number(values[action.key] ?? (additive ? 0 : 1));
  const after = additive
    ? roundStat(before + Number(multiplierOrDelta || 0))
    : roundStat(before * Number(multiplierOrDelta || 1));
  values[action.key] = after;
  adventure[adventureField] = values;
  fighter[fighterField] = { ...values };
  return { actionKey: action.key, skillName: action.name, before, after, kind };
}

function commonAction(battle, fighter, kind) {
  const action = battle.availableActions(fighter).find((candidate) => candidate.isCommonAction(kind));
  if (!action) throw new Error("조건에 맞는 공통 행동이 없습니다.");
  return action;
}

function applyStatDeltas(battle, adventure, deltas, penaltySource = null) {
  const results = [];
  const penaltyChanges = {};
  for (const [statId, rawDelta] of Object.entries(deltas || {})) {
    const delta = Number(rawDelta || 0);
    if (!STAT_FIELDS[statId] || !delta) continue;
    const result = changeStat(battle, adventure, statId, delta);
    results.push(result);
    if (delta < 0) penaltyChanges[statId] = roundStat(result.afterMultiplier - result.beforeMultiplier);
  }
  if (penaltySource && Object.keys(penaltyChanges).length) {
    const bundles = [...(adventure.permanentPenaltyBundles || [])];
    bundles.push({ id: `${penaltySource}:${bundles.length + 1}`, source: penaltySource, changes: penaltyChanges });
    adventure.permanentPenaltyBundles = bundles;
  }
  return results;
}

function changeStat(battle, adventure, statId, delta) {
  const config = STAT_FIELDS[statId];
  if (!config) throw new Error("알 수 없는 Adventure 능력치입니다.");
  const multipliers = { atk: 1, def: 1, spd: 1, ...(adventure.playerStatMultipliers || {}) };
  const beforeMultiplier = Number(multipliers[statId] || 1);
  const afterMultiplier = Math.max(0.1, roundStat(beforeMultiplier + Number(delta || 0)));
  const before = Number(battle.player[config.field]);
  const after = roundStat(before * (afterMultiplier / beforeMultiplier));
  battle.player[config.field] = after;
  multipliers[statId] = afterMultiplier;
  adventure.playerStatMultipliers = multipliers;
  return { id: statId, label: config.label, before, after, beforeMultiplier, afterMultiplier, delta: roundStat(afterMultiplier - beforeMultiplier) };
}

function removePenaltyBundles(battle, adventure, count) {
  const bundles = [...(adventure.permanentPenaltyBundles || [])];
  const removeCount = count === Infinity ? bundles.length : Math.max(0, Math.trunc(Number(count || 0)));
  const removed = [];
  while (bundles.length && removed.length < removeCount) {
    const bundle = bundles.pop();
    const restoredStats = [];
    for (const [statId, delta] of Object.entries(bundle.changes || {})) {
      if (Number(delta) < 0) restoredStats.push(changeStat(battle, adventure, statId, -Number(delta)));
    }
    removed.push({ ...bundle, restoredStats });
  }
  adventure.permanentPenaltyBundles = bundles;
  return removed;
}

function lowestStatId(adventure) {
  const multipliers = { atk: 1, def: 1, spd: 1, ...(adventure.playerStatMultipliers || {}) };
  return Object.keys(STAT_FIELDS).reduce((lowest, statId) => Number(multipliers[statId]) < Number(multipliers[lowest]) ? statId : lowest, "atk");
}

function loseHp(fighter, amount) {
  const before = fighter.hp;
  fighter.hp = Math.max(0, fighter.hp - Math.max(0, Math.trunc(Number(amount || 0))));
  return { before, after: fighter.hp, amount: before - fighter.hp };
}

function restoreHp(battle, fighter, rate, reason) {
  const before = fighter.hp;
  const amount = Math.trunc(fighter.maxHp * Math.max(0, Number(rate || 0)));
  battle.heal(fighter, amount, reason);
  return { before, after: fighter.hp, amount: fighter.hp - before };
}

function restoreMp(battle, fighter, rate, reason) {
  const before = fighter.mp;
  const amount = Math.trunc(fighter.maxMp * Math.max(0, Number(rate || 0)));
  battle.restoreMp(fighter, amount, reason);
  return { before, after: fighter.mp, amount: fighter.mp - before };
}

function spendMp(battle, fighter, amount, reason) {
  const before = fighter.mp;
  const spent = battle.reduceMp(fighter, amount, reason);
  return { mpBefore: before, mpAfter: fighter.mp, mpSpent: spent };
}

function multiplyMaxHp(fighter, multiplier) {
  const before = fighter.maxHp;
  fighter.maxHp = Math.max(1, Math.round(before * Number(multiplier || 1)));
  fighter.hp = Math.min(fighter.hp, fighter.maxHp);
  return { before, after: fighter.maxHp };
}

function changeMaxMp(fighter, amount) {
  const before = fighter.maxMp;
  fighter.maxMp = Math.max(1, Math.trunc(before + Number(amount || 0)));
  fighter.mp = Math.min(fighter.mp, fighter.maxMp);
  return { before, after: fighter.maxMp };
}

function changePostBattleHeal(adventure, delta) {
  const before = Number(adventure.postBattleHealRateBonus || 0);
  const after = roundStat(before + Number(delta || 0));
  adventure.postBattleHealRateBonus = after;
  return { before, after, delta: roundStat(after - before) };
}

function adjustAmbushIndex(adventure, delta) {
  const before = clamp(Math.trunc(Number(adventure.ambushChanceIndex || 0)), 0, 3);
  const after = clamp(before + Math.trunc(Number(delta || 0)), 0, 3);
  adventure.ambushChanceIndex = after;
  adventure.ambushChance = [0, 20, 60, 100][after];
  return { before, after, chance: adventure.ambushChance };
}

function addNextBattleEffect(adventure, effect) {
  adventure.nextBattleEffects = [...(adventure.nextBattleEffects || []), effect];
  return { ...effect };
}

function allStatDeltas(amount) {
  return { atk: amount, def: amount, spd: amount };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundStat(value) {
  const rounded = Math.round(Number(value) * 100) / 100;
  return Number.isInteger(rounded) ? Math.trunc(rounded) : rounded;
}

module.exports = {
  applyExtendedAdventureEventChoice,
};
