"use strict";

const {
  Battle,
  Mulberry32,
  resolveCharacterIndex,
  resolveInscriptionId,
} = require("./engine");
const { applyExtendedAdventureEventChoice } = require("./adventure-event-logic");

const ADVENTURE_TOTAL_STAGES = 10;
const ADVENTURE_MONSTER_INSCRIPTION_ID = "gray";
const ADVENTURE_MONSTER_PERSONALITY_ID = "R";
const ADVENTURE_POST_BATTLE_HEAL_RATE = 0.2;
const ADVENTURE_TOWN_RESTORE_RATE = 0.3;
const ADVENTURE_STAT_BONUS_STEP = 0.1;
const ADVENTURE_AMBUSH_RATES = Object.freeze([0, 20, 60, 100]);
const ADVENTURE_REWARD_STATS = Object.freeze({
  atk: { label: "ATK", field: "baseAtk" },
  def: { label: "DEF", field: "baseDef" },
  spd: { label: "SPD", field: "baseSpd" },
});

function createAdventureBattle({ characters, monsters, events = [], inscriptions, payload = {}, stage = 1 }) {
  const normalMonsters = Array.isArray(monsters) ? monsters.filter((monster) => !monster?.boss) : [];
  if (!normalMonsters.length) {
    throw new Error("Adventure 몬스터 데이터가 없습니다.");
  }

  const currentStage = normalizeAdventureStage(stage);
  const rng = new Mulberry32(payload.seed ?? null);
  const playerIndex = resolveCharacterIndex(characters, payload.playerIndex, rng);
  const playerInscriptionId = resolveInscriptionId(inscriptions, payload.playerInscriptionId, rng);
  const monster = scaleAdventureMonster(rng.choice(normalMonsters), currentStage);
  const combatants = [...characters, monster];
  const battle = new Battle({
    characters: combatants,
    inscriptions,
    playerIndex,
    aiIndex: combatants.length - 1,
    personalityId: ADVENTURE_MONSTER_PERSONALITY_ID,
    rng,
    playerInscriptionId,
    aiInscriptionId: ADVENTURE_MONSTER_INSCRIPTION_ID,
    maxTurns: payload.maxTurns || 200,
  });

  return {
    battle,
    adventure: {
      stage: currentStage,
      totalStages: ADVENTURE_TOTAL_STAGES,
      phase: "battle",
      monsterId: monster.id,
      monsterName: monster.name,
      monsterTitle: monster.title,
      blessingMultiplier: adventureStageMultiplier(currentStage),
      monster,
      isFinalBattle: false,
      playerStatMultipliers: { atk: 1, def: 1, spd: 1 },
      playerMpRecoveryBonus: 0,
      playerTurnEndHpRecovery: 0,
      playerSkillCostMultipliers: {},
      playerSkillPowerMultipliers: {},
      playerSkillAccuracyModifiers: {},
      playerSkillPriorityModifiers: {},
      playerCommonAttackPowerBonus: 0,
      playerCommonDefenseReductionBonus: 0,
      playerMeditationRecoveryBonus: 0,
      playerBattleRhythm: null,
      playerRelic: null,
      rewardSpecialization: null,
      playerSurviveDefeatCount: 0,
      postBattleHealRateBonus: 0,
      battleStartMpRecovery: 0,
      futureEnemyMaxHpMultiplier: 1,
      permanentPenaltyBundles: [],
      nextBattleEffects: [],
      routeRerollCount: 0,
      eventDestinations: events
        .filter((event) => !event?.routeManaged)
        .map((event) => ({
          id: event.id,
          title: event.name,
          symbol: event.symbol || "◆",
          repeatable: Boolean(event.repeatable),
          unavailableAfterBattle: Boolean(event.unavailableAfterBattle),
          startsBattle: Boolean(event.combat),
        })),
      eventVisitCounts: {},
      justCompletedBattle: true,
      ambushChanceIndex: 0,
      ambushChance: ADVENTURE_AMBUSH_RATES[0],
      deferredDestinationId: null,
      encounteredMonsterIds: [monster.id],
      remainingMonsterCount: Math.max(0, normalMonsters.length - 1),
      choices: [],
    },
  };
}

function createNextAdventureBattle({ characters, monsters, inscriptions, previousBattle, adventure, battleConfig = {} }) {
  if (!previousBattle?.player || !adventure) throw new Error("이어갈 Adventure 전투 정보가 없습니다.");
  const encounteredIds = new Set(adventure.encounteredMonsterIds || []);
  const availableMonsters = monsters.filter((monster) => !monster?.boss && !encounteredIds.has(monster.id));
  if (!availableMonsters.length) throw new Error("아직 만나지 않은 Adventure 몬스터가 없습니다.");

  const rng = previousBattle.rng;
  const playerIndex = characters.findIndex((character) => character.id === previousBattle.player.characterId);
  if (playerIndex < 0) throw new Error("Adventure 플레이어 캐릭터를 찾을 수 없습니다.");
  const monster = scaleAdventureMonster(
    rng.choice(availableMonsters),
    adventure.stage,
    Number(adventure.futureEnemyMaxHpMultiplier || 1),
  );
  const combatants = [...characters, monster];
  const battle = new Battle({
    characters: combatants,
    inscriptions,
    playerIndex,
    aiIndex: combatants.length - 1,
    personalityId: ADVENTURE_MONSTER_PERSONALITY_ID,
    rng,
    playerInscriptionId: previousBattle.player.inscriptionId,
    aiInscriptionId: ADVENTURE_MONSTER_INSCRIPTION_ID,
    maxTurns: previousBattle.maxTurns || 200,
  });

  carryAdventurePlayerState(battle.player, previousBattle.player, adventure);
  applyAdventureBattleConfig(battle, adventure, battleConfig);
  activateNextBattleEffects(battle, adventure);
  encounteredIds.add(monster.id);
  adventure.phase = "battle";
  adventure.monsterId = monster.id;
  adventure.monsterName = monster.name;
  adventure.monsterTitle = monster.title;
  adventure.blessingMultiplier = adventureStageMultiplier(adventure.stage);
  adventure.monster = monster;
  adventure.isFinalBattle = false;
  adventure.ambushChanceIndex = 0;
  adventure.ambushChance = ADVENTURE_AMBUSH_RATES[0];
  adventure.encounteredMonsterIds = [...encounteredIds];
  adventure.remainingMonsterCount = Math.max(0, availableMonsters.length - 1);
  adventure.playerCarryover = { hp: battle.player.hp, mp: battle.player.mp };
  adventure.choices = [];
  adventure.settled = false;
  adventure.activeBattleConfig = { ...battleConfig };
  delete adventure.settlement;
  return { battle, adventure };
}

function createFinalAdventureBattle({ characters, monsters, inscriptions, previousBattle, adventure }) {
  if (!previousBattle?.player || !adventure) throw new Error("이어갈 Adventure 전투 정보가 없습니다.");
  const bossData = monsters.find((monster) => monster?.boss);
  if (!bossData) throw new Error("Adventure 최종 보스 데이터가 없습니다.");

  const rng = previousBattle.rng;
  const playerIndex = characters.findIndex((character) => character.id === previousBattle.player.characterId);
  if (playerIndex < 0) throw new Error("Adventure 플레이어 캐릭터를 찾을 수 없습니다.");
  const boss = scaleAdventureMonster(
    bossData,
    Number(adventure.totalStages || ADVENTURE_TOTAL_STAGES),
    Number(adventure.futureEnemyMaxHpMultiplier || 1),
  );
  const combatants = [...characters, boss];
  const battle = new Battle({
    characters: combatants,
    inscriptions,
    playerIndex,
    aiIndex: combatants.length - 1,
    personalityId: ADVENTURE_MONSTER_PERSONALITY_ID,
    rng,
    playerInscriptionId: previousBattle.player.inscriptionId,
    aiInscriptionId: ADVENTURE_MONSTER_INSCRIPTION_ID,
    maxTurns: previousBattle.maxTurns || 200,
  });

  carryAdventurePlayerState(battle.player, previousBattle.player, adventure);
  applyAdventureBattleConfig(battle, adventure);
  activateNextBattleEffects(battle, adventure);
  adventure.stage = Number(adventure.totalStages || ADVENTURE_TOTAL_STAGES);
  adventure.phase = "battle";
  adventure.isFinalBattle = true;
  adventure.finalBossId = boss.id;
  adventure.finalBossName = boss.name;
  adventure.monsterId = boss.id;
  adventure.monsterName = boss.name;
  adventure.monsterTitle = boss.title;
  adventure.blessingMultiplier = adventureStageMultiplier(adventure.stage);
  adventure.monster = boss;
  adventure.remainingMonsterCount = 0;
  adventure.playerCarryover = { hp: battle.player.hp, mp: battle.player.mp };
  adventure.choices = [];
  adventure.settled = false;
  adventure.activeBattleConfig = {};
  delete adventure.settlement;
  return { battle, adventure };
}

function carryAdventurePlayerState(nextPlayer, previousPlayer, adventure) {
  nextPlayer.maxHp = Number(previousPlayer.maxHp);
  nextPlayer.hp = Math.max(0, Math.min(nextPlayer.maxHp, Number(adventure.playerCarryover?.hp ?? previousPlayer.hp)));
  nextPlayer.maxMp = Number(previousPlayer.maxMp);
  nextPlayer.mp = Math.max(0, Math.min(nextPlayer.maxMp, Number(adventure.playerCarryover?.mp ?? previousPlayer.mp)));
  nextPlayer.baseAtk = Number(previousPlayer.baseAtk);
  nextPlayer.baseDef = Number(previousPlayer.baseDef);
  nextPlayer.baseSpd = Number(previousPlayer.baseSpd);
  nextPlayer.adventureMpRecoveryBonus = Number(adventure.playerMpRecoveryBonus || 0);
  nextPlayer.adventureTurnEndHpRecovery = Number(adventure.playerTurnEndHpRecovery || 0);
  nextPlayer.adventureSkillCostMultipliers = { ...(adventure.playerSkillCostMultipliers || {}) };
  nextPlayer.adventureSkillPowerMultipliers = { ...(adventure.playerSkillPowerMultipliers || {}) };
  nextPlayer.adventureSkillAccuracyModifiers = { ...(adventure.playerSkillAccuracyModifiers || {}) };
  nextPlayer.adventureSkillPriorityModifiers = { ...(adventure.playerSkillPriorityModifiers || {}) };
  nextPlayer.adventureCommonAttackPowerBonus = Number(adventure.playerCommonAttackPowerBonus || 0);
  nextPlayer.adventureCommonDefenseReductionBonus = Number(adventure.playerCommonDefenseReductionBonus || 0);
  nextPlayer.adventureMeditationRecoveryBonus = Number(adventure.playerMeditationRecoveryBonus || 0);
  nextPlayer.adventureBattleRhythm = adventure.playerBattleRhythm ? structuredCloneCompat(adventure.playerBattleRhythm) : null;
  nextPlayer.adventureRelic = adventure.playerRelic
    ? { ...structuredCloneCompat(adventure.playerRelic), used: false }
    : null;
  nextPlayer.adventureSurviveDefeatCount = Number(adventure.playerSurviveDefeatCount || 0);
}

function adventureRewardChoices(selectedRewardIds = [], adventure = null) {
  if (!Array.isArray(selectedRewardIds)) {
    adventure = selectedRewardIds;
    selectedRewardIds = [];
  }
  const selected = new Set(selectedRewardIds || []);
  return Object.entries(ADVENTURE_REWARD_STATS).map(([id, reward]) => ({
    id,
    type: "reward",
    symbol: reward.label,
    title: `${reward.label}를 강화한다.`,
    description: `${reward.label} +${Math.round(adventureRewardStep(adventure, id) * 100)}%`,
    disabled: selected.has(id),
    disabledReason: selected.has(id) ? "이미 선택한 보상" : "",
  }));
}

function adventureTownMealChoices(townEvent = null) {
  if (Array.isArray(townEvent?.choices)) {
    return townEvent.choices.slice(0, 3).map((choice) => ({
      id: choice.id,
      type: "town_meal",
      symbol: choice.symbol || "◆",
      title: choice.title,
      description: choice.description || "",
    }));
  }
  return [
    { id: "mushroom_stew", type: "town_meal", symbol: "MP", title: "버섯 스튜", description: "최대 MP의 30%를 회복한다." },
    { id: "beef_stew", type: "town_meal", symbol: "HP", title: "비프 스튜", description: "최대 HP의 30%를 회복한다." },
    { id: "spicy_stew", type: "town_meal", symbol: "+10%", title: "매콤 스튜", description: "ATK·DEF·SPD 중 하나가 무작위로 10% 강화된다." },
  ];
}

function adventureTownChoices() {
  return [{
    id: "town",
    type: "destination",
    symbol: "◆",
    title: "마을",
    description: "",
  }];
}

function adventureRouteChoices(adventure, { includeTown = false, rng = null } = {}) {
  if (Number(adventure.stage || 1) >= Number(adventure.totalStages || ADVENTURE_TOTAL_STAGES)) {
    return [{
      id: "final_battle",
      type: "destination",
      symbol: "♛",
      title: "최종 결전을 향한다.",
      description: "",
    }];
  }
  const visitCounts = adventure.eventVisitCounts || {};
  const deferredDestinationId = String(adventure.deferredDestinationId || "");
  const destinations = [];
  if ((includeTown || deferredDestinationId === "town") && Number(visitCounts.town || 0) < 2) {
    destinations.push({ id: "town", type: "destination", symbol: "◆", title: "마을", description: "" });
  }
  for (const event of adventure.eventDestinations || []) {
    if (!event?.id) continue;
    if (!event.repeatable && Number(visitCounts[event.id] || 0) >= 1) continue;
    if (event.unavailableAfterBattle && adventure.justCompletedBattle) continue;
    if (event.startsBattle && Number(adventure.remainingMonsterCount || 0) <= 0) continue;
    destinations.push({
      id: event.id,
      type: "destination",
      symbol: event.symbol || "◆",
      title: event.title || event.id,
      description: "",
    });
  }

  const forceTown = Boolean(adventure.forceTownNextRoute) && Number(visitCounts.town || 0) < 2;
  if (forceTown && !destinations.some((destination) => destination.id === "town")) {
    destinations.push({ id: "town", type: "destination", symbol: "◆", title: "마을", description: "" });
  }
  adventure.forceTownNextRoute = false;

  const deferredDestination = destinations.find((destination) => destination.id === deferredDestinationId);
  if (!deferredDestination) {
    if (!forceTown) return selectAdventureDestinations(destinations, 3, rng);
    const town = destinations.find((destination) => destination.id === "town");
    const sides = selectAdventureDestinations(destinations.filter((destination) => destination.id !== "town"), 2, rng);
    return sides.length >= 2 ? [sides[0], town, sides[1]] : [town, ...sides];
  }

  const sideDestinations = selectAdventureDestinations(
    destinations.filter((destination) => destination.id !== deferredDestinationId),
    2,
    rng,
  );
  if (sideDestinations.length >= 2) {
    return [sideDestinations[0], deferredDestination, sideDestinations[1]];
  }
  return [...sideDestinations, deferredDestination];
}

function rollAdventureAmbush(battle, adventure, destinationId) {
  const chanceIndex = Math.max(
    0,
    Math.min(ADVENTURE_AMBUSH_RATES.length - 1, Math.trunc(Number(adventure.ambushChanceIndex) || 0)),
  );
  const canBeAmbushed = Number(adventure.remainingMonsterCount || 0) > 0;
  const override = Number(adventure.nextAmbushChanceOverride);
  const hasOverride = Number.isFinite(override);
  const chance = canBeAmbushed
    ? hasOverride ? Math.max(0, Math.min(100, override)) : ADVENTURE_AMBUSH_RATES[chanceIndex]
    : 0;
  if (hasOverride) delete adventure.nextAmbushChanceOverride;
  const roll = chance > 0 ? Math.floor(battle.rng.next() * 100) + 1 : null;
  const triggered = roll !== null && roll <= chance;

  adventure.lastAmbushChance = chance;
  adventure.lastAmbushRoll = roll;
  adventure.lastAmbushTriggered = triggered;
  if (triggered) {
    adventure.ambushChanceIndex = 0;
    adventure.ambushChance = ADVENTURE_AMBUSH_RATES[0];
    adventure.deferredDestinationId = String(destinationId || "");
  } else {
    const nextIndex = Math.min(ADVENTURE_AMBUSH_RATES.length - 1, chanceIndex + 1);
    adventure.ambushChanceIndex = nextIndex;
    adventure.ambushChance = canBeAmbushed ? ADVENTURE_AMBUSH_RATES[nextIndex] : 0;
    adventure.deferredDestinationId = null;
  }

  return { chance, roll, triggered };
}

function selectAdventureDestinations(destinations, limit, rng) {
  const pool = [...destinations];
  const selected = [];
  while (pool.length && selected.length < limit) {
    const index = rng ? rng.range(pool.length) : 0;
    selected.push(pool.splice(index, 1)[0]);
  }
  return selected;
}

function adventureEventChoices(event, battle = null, adventure = null) {
  if (!event || !Array.isArray(event.choices)) return [];
  return event.choices.slice(0, 3).map((choice) => {
    const mpCost = Math.max(0, Math.trunc(Number(choice.effect?.mpCost || 0)));
    const requiresFullMpCost = Boolean(choice.effect?.requiresFullMpCost);
    const hpCostRate = Math.max(0, Number(choice.effect?.hpCostRate || 0));
    const hpCost = battle?.player ? Math.trunc(battle.player.maxHp * hpCostRate) : 0;
    const requiresFullHpCost = Boolean(choice.effect?.requiresFullHpCost);
    const lacksMp = Boolean(requiresFullMpCost && battle?.player && battle.player.mp < mpCost);
    const lacksHp = Boolean(requiresFullHpCost && battle?.player && battle.player.hp < hpCost);
    const startsBattle = ["nest_bonus_battle", "graveyard_elite_battle"].includes(String(choice.effect?.type || ""));
    const lacksMonster = Boolean(startsBattle && Number(battle?.adventureRemainingMonsterCount ?? 1) <= 0);
    const stageSkipLocked = isAdventureStageSkipLocked(choice, adventure);
    const disabled = lacksMp || lacksHp || lacksMonster || stageSkipLocked;
    return {
      id: choice.id,
      type: "event_choice",
      symbol: choice.symbol || "◆",
      title: choice.title,
      description: choice.description || "",
      disabled,
      disabledReason: stageSkipLocked
        ? "최종 결전 직전에는 스테이지를 건너뛸 수 없음"
        : lacksMp
          ? `MP ${mpCost} 필요`
          : lacksHp
            ? `HP ${hpCost} 필요`
            : lacksMonster
              ? "남은 마왕군 없음"
              : "",
    };
  });
}

function isAdventureStageSkipLocked(choice, adventure) {
  const advanceStage = Math.max(0, Math.trunc(Number(choice?.effect?.advanceStage || 0)));
  if (advanceStage <= 0 || !adventure) return false;
  const totalStages = Math.max(1, Math.trunc(Number(adventure.totalStages || ADVENTURE_TOTAL_STAGES)));
  return Number(adventure.stage || 1) >= totalStages - 1;
}

function enterAdventureEvent(battle, adventure, event) {
  if (!event?.id) throw new Error("Adventure 이벤트 데이터가 없습니다.");
  const visitCounts = { ...(adventure.eventVisitCounts || {}) };
  if (Number(visitCounts[event.id] || 0) >= 1) {
    throw new Error("이미 방문한 Adventure 이벤트입니다.");
  }
  visitCounts[event.id] = Number(visitCounts[event.id] || 0) + 1;
  adventure.eventVisitCounts = visitCounts;
  adventure.phase = "event";
  adventure.currentEvent = structuredCloneCompat(event);
  battle.adventureRemainingMonsterCount = Number(adventure.remainingMonsterCount || 0);
  adventure.choices = adventureEventChoices(event, battle, adventure);
  delete battle.adventureRemainingMonsterCount;
}

function rerollAdventureRouteChoices(battle, adventure) {
  const remaining = Math.max(0, Math.trunc(Number(adventure.routeRerollCount || 0)));
  if (adventure.phase !== "route" || remaining <= 0) throw new Error("지금은 행선지를 다시 뽑을 수 없습니다.");
  adventure.routeRerollCount = remaining - 1;
  adventure.choices = adventureRouteChoices(adventure, { rng: battle.rng });
  return adventure.choices;
}

function applyAdventureReward(battle, adventure, choiceId) {
  const rewardId = String(choiceId || "").toLowerCase();
  const reward = ADVENTURE_REWARD_STATS[rewardId];
  if (!reward) throw new Error("알 수 없는 Adventure 보상입니다.");
  if (!battle?.gameOver || battle.winner?.side !== battle.player?.side) {
    throw new Error("승리한 전투에서만 보상을 선택할 수 있습니다.");
  }

  const rewardStep = adventureRewardStep(adventure, rewardId);
  const result = increaseAdventureStat(battle, adventure, rewardId, rewardStep);

  const selectedRewardIds = [...(adventure.selectedRewardIds || []), rewardId];
  adventure.selectedRewardIds = selectedRewardIds;
  const remainingRewards = Math.max(0, Math.trunc(Number(adventure.rewardChoicesRemaining || 1)) - 1);
  adventure.rewardChoicesRemaining = remainingRewards;
  if (remainingRewards > 0) {
    adventure.phase = "reward";
    adventure.choices = adventureRewardChoices(selectedRewardIds, adventure);
    return { ...reward, ...result, id: rewardId, rewardStep, remainingRewards };
  }

  let rewardSpecialization = null;
  if (Number(adventure.rewardSpecialization?.battlesRemaining || 0) > 0) {
    const before = Number(adventure.rewardSpecialization.battlesRemaining);
    const after = Math.max(0, before - 1);
    rewardSpecialization = { before, after };
    adventure.rewardSpecialization = after > 0
      ? { ...adventure.rewardSpecialization, battlesRemaining: after }
      : null;
  }

  const completedStage = completeAdventureStage(adventure);
  adventure.phase = "route";
  adventure.justCompletedBattle = true;
  adventure.selectedReward = rewardId;
  adventure.selectedRewardIds = [];
  adventure.choices = completedStage === 1
    ? adventureTownChoices()
    : adventureRouteChoices(adventure, { includeTown: true, rng: battle.rng });
  return { ...reward, ...result, id: rewardId, rewardStep, rewardSpecialization };
}

function enterAdventureTown(adventure, choiceId, townEvent = null) {
  if (String(choiceId || "") !== "town") throw new Error("알 수 없는 행선지입니다.");
  const visitCounts = { ...(adventure.eventVisitCounts || {}) };
  if (Number(visitCounts.town || 0) >= 2) throw new Error("마을은 한 여정에서 두 번까지만 방문할 수 있습니다.");
  visitCounts.town = Number(visitCounts.town || 0) + 1;
  adventure.eventVisitCounts = visitCounts;
  adventure.phase = "town";
  adventure.currentTown = townEvent ? structuredCloneCompat(townEvent) : null;
  adventure.choices = adventureTownMealChoices(townEvent);
}

function applyAdventureTownMeal(battle, adventure, choiceId) {
  const mealId = String(choiceId || "");
  const fighter = battle.player;
  const mealEffect = adventure.currentTown?.choices?.find((choice) => choice.id === mealId)?.effect || {};
  let result;

  if (mealId === "mushroom_stew") {
    const before = fighter.mp;
    const recovery = Math.trunc(fighter.maxMp * Number(mealEffect.restoreMpRate || ADVENTURE_TOWN_RESTORE_RATE));
    battle.restoreMp(fighter, recovery, "버섯 스튜");
    result = { id: mealId, label: "버섯 스튜", resource: "MP", before, after: fighter.mp, recovery };
  } else if (mealId === "beef_stew") {
    const before = fighter.hp;
    const recovery = Math.trunc(fighter.maxHp * Number(mealEffect.restoreHpRate || ADVENTURE_TOWN_RESTORE_RATE));
    battle.heal(fighter, recovery, "비프 스튜");
    result = { id: mealId, label: "비프 스튜", resource: "HP", before, after: fighter.hp, recovery };
  } else if (mealId === "spicy_stew") {
    const statId = battle.rng.choice(Object.keys(ADVENTURE_REWARD_STATS));
    result = {
      id: mealId,
      label: "매콤 스튜",
      stat: increaseAdventureStat(battle, adventure, statId, Number(mealEffect.statBonus || ADVENTURE_STAT_BONUS_STEP)),
    };
  } else {
    throw new Error("알 수 없는 마을 식사입니다.");
  }

  adventure.phase = "route";
  completeAdventureStage(adventure);
  adventure.justCompletedBattle = false;
  adventure.selectedTownMeal = mealId;
  adventure.mealResult = result;
  adventure.playerCarryover = { hp: fighter.hp, mp: fighter.mp };
  adventure.choices = adventureRouteChoices(adventure, { rng: battle.rng });
  return result;
}

function applyAdventureEventChoice(battle, adventure, choiceId) {
  const event = adventure.currentEvent;
  const choice = event?.choices?.find((item) => item.id === String(choiceId || ""));
  if (!choice) throw new Error("알 수 없는 Adventure 이벤트 선택지입니다.");
  if (isAdventureStageSkipLocked(choice, adventure)) {
    throw new Error("최종 결전 직전에는 스테이지를 건너뛸 수 없습니다.");
  }

  const fighter = battle.player;
  const effect = choice.effect || {};
  const mpCost = Math.max(0, Math.trunc(Number(effect.mpCost || 0)));
  if (effect.requiresFullMpCost && fighter.mp < mpCost) {
    throw new Error(`MP가 ${mpCost} 이상이어야 선택할 수 있습니다.`);
  }
  const hpCost = Math.max(0, Math.trunc(fighter.maxHp * Number(effect.hpCostRate || 0)));
  if (effect.requiresFullHpCost && fighter.hp < hpCost) {
    throw new Error(`HP가 ${hpCost} 이상이어야 선택할 수 있습니다.`);
  }
  let result;

  if (event.id === "magic_stone_mine" && effect.type === "calm") {
    const mpBefore = fighter.mp;
    const mpSpent = battle.reduceMp(fighter, mpCost || 20, "마석 광산 진정");
    const beforeBonus = Number(adventure.playerMpRecoveryBonus || 0);
    const afterBonus = beforeBonus + Number(effect.mpRecoveryBonus || 2);
    adventure.playerMpRecoveryBonus = afterBonus;
    fighter.adventureMpRecoveryBonus = afterBonus;
    result = { id: choice.id, type: effect.type, mpBefore, mpAfter: fighter.mp, mpSpent, beforeBonus, afterBonus };
  } else if (event.id === "magic_stone_mine" && effect.type === "absorb") {
    const activeActions = battle.availableActions(fighter).filter((action) => action.isActive);
    if (!activeActions.length) throw new Error("흡수할 액티브 스킬이 없습니다.");
    const action = battle.rng.choice(activeActions);
    const roll = battle.roll();
    const successRate = Number(effect.successRate || 0.75);
    const success = roll < successRate * 100;
    const appliedMultiplier = Number(success ? effect.successMultiplier || 0.7 : effect.failureMultiplier || 1.3);
    const multipliers = { ...(adventure.playerSkillCostMultipliers || {}) };
    const beforeMultiplier = Number(multipliers[action.key] || 1);
    const afterMultiplier = roundStat(beforeMultiplier * appliedMultiplier);
    multipliers[action.key] = afterMultiplier;
    adventure.playerSkillCostMultipliers = multipliers;
    fighter.adventureSkillCostMultipliers = { ...multipliers };
    result = {
      id: choice.id,
      type: effect.type,
      actionKey: action.key,
      skillName: action.name,
      roll: roundStat(roll),
      successRate,
      success,
      appliedMultiplier,
      beforeMultiplier,
      afterMultiplier,
    };
  } else if (event.id === "magic_stone_mine" && effect.type === "ignore") {
    const hpBefore = fighter.hp;
    const requestedLoss = Math.max(0, Math.trunc(Number(effect.hpLoss || 10)));
    fighter.hp = Math.max(0, fighter.hp - requestedLoss);
    result = {
      id: choice.id,
      type: effect.type,
      hpBefore,
      hpAfter: fighter.hp,
      hpLoss: hpBefore - fighter.hp,
      requestedLoss,
    };
  } else if (event.id === "potato_farm" && effect.type === "potato_heal") {
    result = applyAdventureTurnEndHpRecovery(fighter, adventure, Number(effect.turnEndHpRecovery || 1), choice.id, effect.type);
  } else if (event.id === "potato_farm" && effect.type === "potato_buy") {
    const mpBefore = fighter.mp;
    const mpSpent = battle.reduceMp(fighter, mpCost || 15, "감자 구입");
    result = {
      ...applyAdventureTurnEndHpRecovery(fighter, adventure, Number(effect.turnEndHpRecovery || 2), choice.id, effect.type),
      mpBefore,
      mpAfter: fighter.mp,
      mpSpent,
    };
  } else if (event.id === "potato_farm" && effect.type === "potato_bake") {
    const roll = battle.roll();
    const successRate = Number(effect.successRate || 0.7);
    const success = roll < successRate * 100;
    result = success
      ? {
          ...applyAdventureTurnEndHpRecovery(fighter, adventure, Number(effect.turnEndHpRecovery || 3), choice.id, effect.type),
          roll: roundStat(roll),
          successRate,
          success,
        }
      : {
          id: choice.id,
          type: effect.type,
          roll: roundStat(roll),
          successRate,
          success,
          beforeRecovery: Number(adventure.playerTurnEndHpRecovery || 0),
          afterRecovery: Number(adventure.playerTurnEndHpRecovery || 0),
          addedRecovery: 0,
        };
  } else if (event.id === "spring_of_life" && effect.type === "spring_drink") {
    const mpBefore = fighter.mp;
    const hpBefore = fighter.hp;
    const mpSpent = battle.reduceMp(fighter, mpCost || 30, "생명의 샘");
    battle.heal(fighter, fighter.maxHp - fighter.hp, "생명의 샘");
    result = {
      id: choice.id,
      type: effect.type,
      mpBefore,
      mpAfter: fighter.mp,
      mpSpent,
      hpBefore,
      hpAfter: fighter.hp,
      recoveredHp: fighter.hp - hpBefore,
    };
  } else if (event.id === "spring_of_life" && effect.type === "spring_wash") {
    const hpBefore = fighter.hp;
    const maxHpBefore = fighter.maxHp;
    const maxHpAfter = Math.round(maxHpBefore * Number(effect.maxHpMultiplier || 1.15));
    fighter.hp = Math.max(0, fighter.hp - hpCost);
    fighter.maxHp = maxHpAfter;
    result = {
      id: choice.id,
      type: effect.type,
      hpBefore,
      hpAfter: fighter.hp,
      hpSpent: hpBefore - fighter.hp,
      maxHpBefore,
      maxHpAfter,
    };
  } else if (event.id === "spring_of_life" && effect.type === "spring_bottle") {
    const beforeRate = Number(adventure.postBattleHealRateBonus || 0);
    const addedRate = Number(effect.postBattleHealRateBonus || 0.1);
    const afterRate = roundStat(beforeRate + addedRate);
    adventure.postBattleHealRateBonus = afterRate;
    result = {
      id: choice.id,
      type: effect.type,
      beforeRate,
      afterRate,
      addedRate,
      totalRate: roundStat(ADVENTURE_POST_BATTLE_HEAL_RATE + afterRate),
    };
  } else if (event.id === "blood_altar" && effect.type === "blood_altar") {
    const hpBefore = fighter.hp;
    fighter.hp = Math.max(0, fighter.hp - hpCost);
    result = {
      id: choice.id,
      type: effect.type,
      hpBefore,
      hpAfter: fighter.hp,
      hpSpent: hpBefore - fighter.hp,
      stat: increaseAdventureStat(
        battle,
        adventure,
        String(effect.statId || ""),
        Number(effect.statBonus || 0.3),
      ),
    };
  } else {
    result = applyExtendedAdventureEventChoice({ battle, adventure, event, choice, hpCost, mpCost });
  }

  adventure.selectedEventChoice = choice.id;
  adventure.eventResult = result;
  adventure.playerCarryover = { hp: fighter.hp, mp: fighter.mp };
  if (result.startsBattle) {
    return { ...result, label: choice.title, eventId: event.id, eventName: event.name };
  }
  return finishAdventureEventChoice(battle, adventure, {
    ...result,
    label: choice.title,
    eventId: event.id,
    eventName: event.name,
  });
}

function finishAdventureEventChoice(battle, adventure, result) {
  const fighter = battle.player;
  if (fighter.hp <= 0) {
    battle.gameOver = true;
    battle.winner = battle.ai;
    battle.loser = fighter;
    adventure.phase = "defeat";
    adventure.choices = [];
  } else {
    adventure.phase = "route";
    completeAdventureStage(adventure);
    const extraAdvance = Math.max(0, Math.trunc(Number(adventure.pendingStageAdvance || 0)));
    if (extraAdvance > 0) {
      adventure.stage = Math.min(Number(adventure.totalStages || ADVENTURE_TOTAL_STAGES), adventure.stage + extraAdvance);
      delete adventure.pendingStageAdvance;
    }
    adventure.justCompletedBattle = false;
    adventure.choices = adventureRouteChoices(adventure, { rng: battle.rng });
  }
  return result;
}

function applyAdventureTurnEndHpRecovery(fighter, adventure, amount, choiceId, type) {
  const addedRecovery = Math.max(0, Math.trunc(Number(amount || 0)));
  const beforeRecovery = Number(adventure.playerTurnEndHpRecovery || 0);
  const afterRecovery = beforeRecovery + addedRecovery;
  adventure.playerTurnEndHpRecovery = afterRecovery;
  fighter.adventureTurnEndHpRecovery = afterRecovery;
  return { id: choiceId, type, beforeRecovery, afterRecovery, addedRecovery };
}

function increaseAdventureStat(battle, adventure, statId, step = ADVENTURE_STAT_BONUS_STEP) {
  const reward = ADVENTURE_REWARD_STATS[statId];
  if (!reward) throw new Error("알 수 없는 Adventure 능력치입니다.");
  const multipliers = {
    atk: 1,
    def: 1,
    spd: 1,
    ...(adventure.playerStatMultipliers || {}),
  };
  const beforeMultiplier = Number(multipliers[statId] || 1);
  const afterMultiplier = roundStat(beforeMultiplier + Number(step || 0));
  const before = Number(battle.player[reward.field]);
  const after = roundStat(before * (afterMultiplier / beforeMultiplier));
  battle.player[reward.field] = after;
  multipliers[statId] = afterMultiplier;
  adventure.playerStatMultipliers = multipliers;
  return { id: statId, label: reward.label, before, after, beforeMultiplier, afterMultiplier };
}

function adventureRewardStep(adventure, statId) {
  const specialization = adventure?.rewardSpecialization;
  if (Number(specialization?.battlesRemaining || 0) <= 0) return ADVENTURE_STAT_BONUS_STEP;
  return String(specialization.preferredStat || "") === String(statId || "")
    ? Number(specialization.preferredBonus || ADVENTURE_STAT_BONUS_STEP)
    : Number(specialization.otherBonus || ADVENTURE_STAT_BONUS_STEP);
}

function applyAdventurePreemptiveStrike(battle, enemyHpLossRate = 0.1) {
  const target = battle?.ai;
  if (!target) throw new Error("선제 공격 대상이 없습니다.");
  const rate = Math.max(0, Math.min(1, Number(enemyHpLossRate) || 0.1));
  const hpBefore = target.hp;
  const requestedLoss = Math.max(1, Math.trunc(target.maxHp * rate));
  target.hp = Math.max(1, target.hp - requestedLoss);
  return {
    rate,
    requestedLoss,
    hpBefore,
    hpAfter: target.hp,
    hpLoss: hpBefore - target.hp,
  };
}

function applyAdventureBattleConfig(battle, adventure, config = {}) {
  const allStatMultiplier = Number(config.enemyAllStatMultiplier || 1);
  if (Number.isFinite(allStatMultiplier) && allStatMultiplier !== 1) {
    battle.ai.maxHp = Math.max(1, Math.round(battle.ai.maxHp * allStatMultiplier));
    battle.ai.hp = battle.ai.maxHp;
    battle.ai.baseAtk = roundStat(battle.ai.baseAtk * allStatMultiplier);
    battle.ai.baseDef = roundStat(battle.ai.baseDef * allStatMultiplier);
    battle.ai.baseSpd = roundStat(battle.ai.baseSpd * allStatMultiplier);
  }
  const startingHpRate = Number(config.enemyStartingHpRate);
  if (Number.isFinite(startingHpRate)) {
    battle.ai.hp = Math.max(1, Math.trunc(battle.ai.maxHp * Math.max(0, Math.min(1, startingHpRate))));
  }
  const startRecovery = Math.max(0, Math.trunc(Number(adventure.battleStartMpRecovery || 0)));
  if (startRecovery > 0) {
    const before = battle.player.mp;
    battle.restoreMp(battle.player, startRecovery, "Adventure 전투 시작 회복");
    adventure.lastBattleStartMpRecovery = { before, after: battle.player.mp, amount: battle.player.mp - before };
  } else {
    delete adventure.lastBattleStartMpRecovery;
  }
}

function activateNextBattleEffects(battle, adventure) {
  const remaining = [];
  const activated = [];
  for (const rawEffect of adventure.nextBattleEffects || []) {
    const effect = { ...rawEffect };
    if (Number(effect.battlesRemaining || 0) <= 0) continue;
    if (effect.type === "all_skill_cost") {
      battle.player.adventureAllSkillCostMultiplier *= Number(effect.multiplier || 1);
    } else if (effect.type === "damage") {
      battle.player.adventureDamageMultiplier *= Number(effect.multiplier || 1);
    } else if (effect.type === "turn_end_mp") {
      battle.player.adventureMpRecoveryBonus += Number(effect.amount || 0);
    } else if (effect.type === "skip_enemy_action") {
      battle.ai.adventureSkipNextAction = true;
      battle.ai.adventureSkipNextActionLabel = "막힌 진로";
    } else if (effect.type === "both_turn_end_fixed_damage") {
      const amount = Math.max(0, Math.trunc(Number(effect.amount || 0)));
      battle.player.adventureTurnEndFixedDamage += amount;
      battle.ai.adventureTurnEndFixedDamage += amount;
    }
    activated.push({ ...effect });
    effect.battlesRemaining = Number(effect.battlesRemaining) - 1;
    if (effect.battlesRemaining > 0) remaining.push(effect);
  }
  adventure.nextBattleEffects = remaining;
  adventure.activeNextBattleEffects = activated;
}

function settleAdventureVictory(battle, adventure) {
  if (!battle?.gameOver || battle.winner?.side !== battle.player?.side) {
    throw new Error("승리한 Adventure 전투만 정산할 수 있습니다.");
  }
  if (adventure.settled) return adventure.settlement;

  const fighter = battle.player;
  const activeConfig = { ...(adventure.activeBattleConfig || {}) };
  let victoryMaxHp = null;
  if (Number(activeConfig.victoryMaxHpMultiplier || 1) !== 1) {
    const before = fighter.maxHp;
    fighter.maxHp = Math.max(1, Math.round(fighter.maxHp * Number(activeConfig.victoryMaxHpMultiplier)));
    victoryMaxHp = { before, after: fighter.maxHp };
    battle.logs.push(`${fighter.name}의 최대 HP ${before} -> ${fighter.maxHp} (기사의 혼령)`);
  }
  const hpBefore = fighter.hp;
  const mp = fighter.mp;
  const healRate = Math.max(0, roundStat(ADVENTURE_POST_BATTLE_HEAL_RATE + Number(adventure.postBattleHealRateBonus || 0)));
  const recovery = Math.trunc(fighter.maxHp * healRate);
  battle.heal(fighter, recovery, "전투 종료 회복");
  const hpAfter = fighter.hp;
  battle.resetFighterCombatState(fighter);
  fighter.mp = mp;
  battle.logs.push(`${fighter.name}의 전투 중 상태와 고유 자원이 초기화됐다. MP ${mp} 유지.`);

  const settlement = {
    healRate,
    recovery,
    recoveredHp: hpAfter - hpBefore,
    hpBefore,
    hpAfter,
    mp,
    victoryMaxHp,
  };
  adventure.settled = true;
  adventure.settlement = settlement;
  adventure.playerCarryover = { hp: hpAfter, mp };
  adventure.previousBattleSnapshot = { hp: hpAfter, mp };
  adventure.playerSurviveDefeatCount = Number(fighter.adventureSurviveDefeatCount || 0);
  let relicSettlement = null;
  if (Number(fighter.adventureRelic?.battlesRemaining || 0) > 0) {
    const before = Number(fighter.adventureRelic.battlesRemaining);
    const after = Math.max(0, before - 1);
    relicSettlement = { kind: fighter.adventureRelic.kind, before, after, used: Boolean(fighter.adventureRelic.used) };
    adventure.playerRelic = after > 0
      ? { ...fighter.adventureRelic, battlesRemaining: after, used: false }
      : null;
  } else {
    adventure.playerRelic = null;
  }
  adventure.rewardChoicesRemaining = Math.max(1, Math.trunc(Number(activeConfig.rewardChoiceCount || 1)));
  adventure.selectedRewardIds = [];
  adventure.activeNextBattleEffects = [];
  delete adventure.activeBattleConfig;
  settlement.relic = relicSettlement;
  return settlement;
}

function completeAdventureRun(battle, adventure) {
  if (!battle?.gameOver || battle.winner?.side !== battle.player?.side || !adventure?.isFinalBattle) {
    throw new Error("최종 결전에서 승리해야 여정을 마칠 수 있습니다.");
  }
  adventure.phase = "complete";
  adventure.completed = true;
  adventure.completedStage = Number(adventure.totalStages || ADVENTURE_TOTAL_STAGES);
  adventure.stage = adventure.completedStage;
  adventure.choices = [];
  adventure.playerCarryover = { hp: battle.player.hp, mp: battle.player.mp };
  return adventure;
}

function scaleAdventureMonster(monster, stage, maxHpMultiplier = 1) {
  const copy = structuredCloneCompat(monster);
  const multiplier = adventureStageMultiplier(stage);
  for (const stat of ["hp", "atk", "def", "spd"]) {
    const scaled = Number(copy.stats[stat]) * multiplier * (stat === "hp" ? Number(maxHpMultiplier || 1) : 1);
    copy.stats[stat] = stat === "hp" ? Math.round(scaled) : roundStat(scaled);
  }
  return copy;
}

function completeAdventureStage(adventure) {
  const completedStage = normalizeAdventureStage(adventure.stage);
  adventure.completedStage = completedStage;
  adventure.stage = Math.min(Number(adventure.totalStages || ADVENTURE_TOTAL_STAGES), completedStage + 1);
  return completedStage;
}

function adventureStageMultiplier(stage) {
  return roundStat(1 + normalizeAdventureStage(stage) * 0.05);
}

function normalizeAdventureStage(stage) {
  const value = Math.trunc(Number(stage) || 1);
  return Math.max(1, Math.min(ADVENTURE_TOTAL_STAGES, value));
}

function roundStat(value) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? Math.trunc(rounded) : rounded;
}

function structuredCloneCompat(value) {
  return globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
}

module.exports = {
  ADVENTURE_AMBUSH_RATES,
  ADVENTURE_POST_BATTLE_HEAL_RATE,
  ADVENTURE_STAT_BONUS_STEP,
  ADVENTURE_TOWN_RESTORE_RATE,
  ADVENTURE_TOTAL_STAGES,
  adventureRewardChoices,
  adventureEventChoices,
  adventureRouteChoices,
  adventureStageMultiplier,
  adventureTownChoices,
  adventureTownMealChoices,
  applyAdventureReward,
  applyAdventurePreemptiveStrike,
  applyAdventureEventChoice,
  applyAdventureTownMeal,
  completeAdventureRun,
  createAdventureBattle,
  createFinalAdventureBattle,
  createNextAdventureBattle,
  enterAdventureTown,
  enterAdventureEvent,
  rerollAdventureRouteChoices,
  rollAdventureAmbush,
  scaleAdventureMonster,
  settleAdventureVictory,
};
