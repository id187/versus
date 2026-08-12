"use strict";

const {
  Battle,
  Mulberry32,
  resolveCharacterIndex,
  resolveInscriptionId,
} = require("./engine");
const { applyExtendedAdventureEventChoice } = require("./adventure-event-logic");
const {
  adventureRelicById,
  adventureRelicEffectSum,
  adventureRelicsForPool,
  grantAdventureRelic,
  normalizeAdventureRelics,
  syncAdventureRelicsFromFighter,
} = require("./adventure-relics");

const ADVENTURE_TOTAL_STAGES = 20;
const ADVENTURE_MIRROR_STAGE = 12;
const ADVENTURE_MONSTER_INSCRIPTION_ID = "gray";
const ADVENTURE_MONSTER_PERSONALITY_ID = "R";
const ADVENTURE_POST_BATTLE_HEAL_RATE = 0.2;
const ADVENTURE_TOWN_RESTORE_RATE = 0.3;
const ADVENTURE_STAT_BONUS_STEP = 0.1;
const ADVENTURE_STARTING_GOLD = 20;
const ADVENTURE_REGULAR_BATTLE_GOLD = 10;
const ADVENTURE_LATE_BATTLE_GOLD = 15;
const ADVENTURE_RELIC_SHOP_ID = "relic_shop";
const ADVENTURE_RELIC_SHOP_GUARANTEED_STAGES = Object.freeze([11, 19]);
const ADVENTURE_AMBUSH_RATES = Object.freeze([0, 20, 60, 100]);
const ADVENTURE_OFFICER_ID_ALIASES = Object.freeze({
  opawn: "demon_pawn_opawn",
  chartrang: "demon_rook_chatrang",
  kaighton: "demon_knight_kaighton",
  eveque: "demon_bishop_eveque",
});
const ADVENTURE_REWARD_STATS = Object.freeze({
  atk: { label: "ATK", field: "baseAtk" },
  def: { label: "DEF", field: "baseDef" },
  spd: { label: "SPD", field: "baseSpd" },
});
const ADVENTURE_MIRROR_LEGACY_CHOICE_ID = "mirror_battle";
const ADVENTURE_MIRROR_VARIANTS = Object.freeze({
  mirror_break: Object.freeze({
    id: "mirror_break",
    symbol: "ATK",
    title: "거울을 파괴한다.",
    description: "ATK가 1.2배, DEF가 0.8배인 마경과 싸운다.",
    selectionLog: "거울을 파괴했다.",
    battleLog: "파괴의 충동을 비춘 마경의 ATK가 1.2배, DEF가 0.8배가 되었다.",
    hpMultiplier: 1,
    atkMultiplier: 1.2,
    defMultiplier: 0.8,
  }),
  mirror_face: Object.freeze({
    id: "mirror_face",
    symbol: "=",
    title: "거울을 마주한다.",
    description: "자신과 완전히 같은 마경과 싸운다.",
    selectionLog: "거울을 마주했다.",
    battleLog: "마경이 모습과 영구 강화를 그대로 비춘다.",
    hpMultiplier: 1,
    atkMultiplier: 1,
    defMultiplier: 1,
  }),
  mirror_accept: Object.freeze({
    id: "mirror_accept",
    symbol: "HP",
    title: "거울을 받아들인다.",
    description: "최대 HP가 1.2배, ATK가 0.8배인 마경과 싸운다.",
    selectionLog: "거울을 받아들였다.",
    battleLog: "자신을 받아들인 의지를 비춘 마경의 최대 HP가 1.2배, ATK가 0.8배가 되었다.",
    hpMultiplier: 1.2,
    atkMultiplier: 0.8,
    defMultiplier: 1,
  }),
});

function createAdventureBattle({ characters, monsters, events = [], relics = [], inscriptions, payload = {}, stage = 1 }) {
  const normalMonsters = Array.isArray(monsters) ? monsters.filter((monster) => !monster?.boss && !monster?.officer) : [];
  const officerMonsters = Array.isArray(monsters) ? monsters.filter((monster) => monster?.officer) : [];
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

  const adventure = {
      stage: currentStage,
      totalStages: ADVENTURE_TOTAL_STAGES,
      phase: "battle",
      gold: ADVENTURE_STARTING_GOLD,
      monsterId: monster.id,
      monsterName: monster.name,
      monsterTitle: monster.title,
      blessingMultiplier: adventureStageMultiplier(currentStage),
      monster,
      isFinalBattle: false,
      isMirrorBattle: false,
      isOfficerBattle: false,
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
      achievementStats: {
        bestSingleAttackDamage: 0,
        bestSingleFixedDamage: 0,
        relicsAcquired: 0,
      },
      playerBattleRhythm: null,
      relicCatalog: normalizeAdventureRelics(relics),
      playerRelics: [],
      hasRelicLedger: false,
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
          relicShop: Boolean(event.relicShop),
          minStage: Math.max(1, Math.trunc(Number(event.minStage || 1))),
          maxStage: Math.max(1, Math.trunc(Number(event.maxStage || ADVENTURE_TOTAL_STAGES))),
        })),
      eventVisitCounts: {},
      justCompletedBattle: true,
      ambushChanceIndex: 0,
      ambushChance: ADVENTURE_AMBUSH_RATES[0],
      deferredDestinationId: null,
      encounteredMonsterIds: [monster.id],
      remainingMonsterCount: Math.max(0, normalMonsters.length - 1),
      encounteredOfficerIds: [],
      remainingOfficerCount: officerMonsters.length,
      choices: [],
    };
  battle.adventureState = adventure;
  return {
    battle,
    adventure,
  };
}

function createNextAdventureBattle({ characters, monsters, inscriptions, previousBattle, adventure, battleConfig = {} }) {
  if (!previousBattle?.player || !adventure) throw new Error("이어갈 Adventure 전투 정보가 없습니다.");
  const encounteredIds = new Set(adventure.encounteredMonsterIds || []);
  const availableMonsters = monsters.filter((monster) => !monster?.boss && !monster?.officer && !encounteredIds.has(monster.id));
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
  adventure.isMirrorBattle = false;
  adventure.isOfficerBattle = false;
  adventure.ambushChanceIndex = 0;
  adventure.ambushChance = ADVENTURE_AMBUSH_RATES[0];
  adventure.encounteredMonsterIds = [...encounteredIds];
  adventure.remainingMonsterCount = Math.max(0, availableMonsters.length - 1);
  adventure.playerCarryover = { hp: battle.player.hp, mp: battle.player.mp };
  adventure.choices = [];
  adventure.settled = false;
  adventure.activeBattleConfig = { ...battleConfig };
  delete adventure.settlement;
  battle.adventureState = adventure;
  return { battle, adventure };
}

function createOfficerAdventureBattle({ characters, monsters, inscriptions, previousBattle, adventure }) {
  if (!previousBattle?.player || !adventure) throw new Error("이어갈 Adventure 전투 정보가 없습니다.");
  const encounteredIds = new Set(
    (adventure.encounteredOfficerIds || []).map((id) => ADVENTURE_OFFICER_ID_ALIASES[id] || id),
  );
  const availableOfficers = monsters.filter((monster) => monster?.officer && !encounteredIds.has(monster.id));
  if (!availableOfficers.length) throw new Error("아직 만나지 않은 마왕군 간부가 없습니다.");

  const rng = previousBattle.rng;
  const playerIndex = characters.findIndex((character) => character.id === previousBattle.player.characterId);
  if (playerIndex < 0) throw new Error("Adventure 플레이어 캐릭터를 찾을 수 없습니다.");
  const officer = scaleAdventureMonster(
    rng.choice(availableOfficers),
    adventure.stage,
    Number(adventure.futureEnemyMaxHpMultiplier || 1),
  );
  const combatants = [...characters, officer];
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
  encounteredIds.add(officer.id);
  adventure.phase = "battle";
  adventure.monsterId = officer.id;
  adventure.monsterName = officer.name;
  adventure.monsterTitle = officer.title;
  adventure.blessingMultiplier = adventureStageMultiplier(adventure.stage);
  adventure.monster = officer;
  adventure.isFinalBattle = false;
  adventure.isMirrorBattle = false;
  adventure.isOfficerBattle = true;
  adventure.ambushChanceIndex = 0;
  adventure.ambushChance = ADVENTURE_AMBUSH_RATES[0];
  adventure.encounteredOfficerIds = [...encounteredIds];
  adventure.remainingOfficerCount = Math.max(0, availableOfficers.length - 1);
  adventure.playerCarryover = { hp: battle.player.hp, mp: battle.player.mp };
  adventure.choices = [];
  adventure.settled = false;
  adventure.activeBattleConfig = {};
  delete adventure.settlement;
  battle.adventureState = adventure;
  return { battle, adventure };
}

function createMirrorAdventureBattle({ characters, inscriptions, previousBattle, adventure, variantId = "mirror_face" }) {
  if (!previousBattle?.player || !adventure) throw new Error("이어갈 Adventure 전투 정보가 없습니다.");

  const rng = previousBattle.rng;
  const playerIndex = characters.findIndex((character) => character.id === previousBattle.player.characterId);
  if (playerIndex < 0) throw new Error("Adventure 플레이어 캐릭터를 찾을 수 없습니다.");

  const mirror = structuredCloneCompat(characters[playerIndex]);
  mirror.title = "마왕의 마경";
  mirror.stats = {
    hp: Number(previousBattle.player.maxHp),
    atk: Number(previousBattle.player.baseAtk),
    def: Number(previousBattle.player.baseDef),
    spd: Number(previousBattle.player.baseSpd),
  };

  const combatants = [...characters, mirror];
  const battle = new Battle({
    characters: combatants,
    inscriptions,
    playerIndex,
    aiIndex: combatants.length - 1,
    personalityId: ADVENTURE_MONSTER_PERSONALITY_ID,
    rng,
    playerInscriptionId: previousBattle.player.inscriptionId,
    aiInscriptionId: previousBattle.player.inscriptionId,
    maxTurns: previousBattle.maxTurns || 200,
  });

  carryAdventurePlayerState(battle.player, previousBattle.player, adventure);
  copyAdventureBuildToMirror(battle.ai, previousBattle.player, adventure);
  const mirrorVariant = adventureMirrorVariant(variantId);
  applyAdventureMirrorVariant(battle.ai, mirrorVariant);
  applyAdventureBattleConfig(battle, adventure);
  activateNextBattleEffects(battle, adventure);

  adventure.stage = ADVENTURE_MIRROR_STAGE;
  adventure.phase = "battle";
  adventure.isFinalBattle = false;
  adventure.isMirrorBattle = true;
  adventure.isOfficerBattle = false;
  adventure.mirrorVariantId = mirrorVariant.id;
  adventure.mirrorVariant = structuredCloneCompat(mirrorVariant);
  adventure.mirrorSourceCharacterId = previousBattle.player.characterId;
  adventure.monsterId = mirror.id;
  adventure.monsterName = mirror.name;
  adventure.monsterTitle = mirror.title;
  adventure.blessingMultiplier = 1;
  adventure.monster = mirror;
  adventure.remainingMonsterCount = 0;
  adventure.ambushChanceIndex = 0;
  adventure.ambushChance = 0;
  adventure.playerCarryover = { hp: battle.player.hp, mp: battle.player.mp };
  adventure.choices = [];
  adventure.settled = false;
  adventure.activeBattleConfig = {};
  delete adventure.settlement;
  battle.adventureState = adventure;
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
  adventure.isMirrorBattle = false;
  adventure.isOfficerBattle = false;
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
  battle.adventureState = adventure;
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
  nextPlayer.adventureRelics = structuredCloneCompat(adventure.playerRelics || []);
  nextPlayer.adventureSurviveDefeatCount = Number(adventure.playerSurviveDefeatCount || 0);
}

function copyAdventureBuildToMirror(mirror, source, adventure) {
  mirror.maxHp = Number(source.maxHp);
  mirror.hp = mirror.maxHp;
  mirror.maxMp = Number(source.maxMp);
  mirror.mp = Math.max(0, Math.min(mirror.maxMp, mirror.mp));
  mirror.baseAtk = Number(source.baseAtk);
  mirror.baseDef = Number(source.baseDef);
  mirror.baseSpd = Number(source.baseSpd);
  mirror.adventureMpRecoveryBonus = Number(adventure.playerMpRecoveryBonus || 0);
  mirror.adventureTurnEndHpRecovery = Number(adventure.playerTurnEndHpRecovery || 0);
  mirror.adventureSkillCostMultipliers = { ...(adventure.playerSkillCostMultipliers || {}) };
  mirror.adventureSkillPowerMultipliers = { ...(adventure.playerSkillPowerMultipliers || {}) };
  mirror.adventureSkillAccuracyModifiers = { ...(adventure.playerSkillAccuracyModifiers || {}) };
  mirror.adventureSkillPriorityModifiers = { ...(adventure.playerSkillPriorityModifiers || {}) };
  mirror.adventureCommonAttackPowerBonus = Number(adventure.playerCommonAttackPowerBonus || 0);
  mirror.adventureCommonDefenseReductionBonus = Number(adventure.playerCommonDefenseReductionBonus || 0);
  mirror.adventureMeditationRecoveryBonus = Number(adventure.playerMeditationRecoveryBonus || 0);
  mirror.adventureBattleRhythm = adventure.playerBattleRhythm
    ? structuredCloneCompat(adventure.playerBattleRhythm)
    : null;
}

function adventureMirrorVariant(variantId) {
  const normalizedId = String(variantId || "mirror_face");
  if (normalizedId === ADVENTURE_MIRROR_LEGACY_CHOICE_ID) return ADVENTURE_MIRROR_VARIANTS.mirror_face;
  const variant = ADVENTURE_MIRROR_VARIANTS[normalizedId];
  if (!variant) throw new Error("알 수 없는 마왕의 마경 선택지입니다.");
  return variant;
}

function isAdventureMirrorChoice(choiceId) {
  const normalizedId = String(choiceId || "");
  return normalizedId === ADVENTURE_MIRROR_LEGACY_CHOICE_ID
    || Object.hasOwn(ADVENTURE_MIRROR_VARIANTS, normalizedId);
}

function applyAdventureMirrorVariant(mirror, variant) {
  mirror.maxHp = Math.max(1, Math.round(mirror.maxHp * Number(variant.hpMultiplier || 1)));
  mirror.hp = mirror.maxHp;
  mirror.baseAtk = roundStat(mirror.baseAtk * Number(variant.atkMultiplier || 1));
  mirror.baseDef = roundStat(mirror.baseDef * Number(variant.defMultiplier || 1));
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

function adventureRouteChoices(adventure, { rng = null } = {}) {
  const stage = Number(adventure.stage || 1);
  if (stage === ADVENTURE_MIRROR_STAGE) {
    adventure.routePrompt = "불온한 기운을 내뿜는 거울이 앞에 서 있다.";
    return Object.values(ADVENTURE_MIRROR_VARIANTS).map((variant) => ({
      id: variant.id,
      type: "mirror_choice",
      symbol: variant.symbol,
      title: variant.title,
      description: variant.description,
    }));
  }
  delete adventure.routePrompt;
  if (stage >= Number(adventure.totalStages || ADVENTURE_TOTAL_STAGES)) {
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
  for (const event of adventure.eventDestinations || []) {
    if (!event?.id) continue;
    if (stage < Number(event.minStage || 1) || stage > Number(event.maxStage || ADVENTURE_TOTAL_STAGES)) continue;
    if (!event.repeatable && Number(visitCounts[event.id] || 0) >= 1) continue;
    if (event.repeatable && event.id === adventure.lastCompletedEventId && !ADVENTURE_RELIC_SHOP_GUARANTEED_STAGES.includes(stage)) continue;
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

  if (ADVENTURE_RELIC_SHOP_GUARANTEED_STAGES.includes(stage)) {
    const shop = destinations.find((destination) => destination.id === ADVENTURE_RELIC_SHOP_ID)
      || destinationFromAdventureState(adventure, ADVENTURE_RELIC_SHOP_ID);
    if (shop) {
      const deferred = destinations.find((destination) => destination.id === deferredDestinationId);
      const sides = deferred
        ? [
            deferred,
            ...selectAdventureDestinations(
              destinations.filter((destination) => ![ADVENTURE_RELIC_SHOP_ID, deferredDestinationId].includes(destination.id)),
              1,
              rng,
            ),
          ]
        : selectAdventureDestinations(
            destinations.filter((destination) => destination.id !== ADVENTURE_RELIC_SHOP_ID),
            2,
            rng,
          );
      const insertAt = rng ? rng.range(sides.length + 1) : 0;
      sides.splice(insertAt, 0, shop);
      return sides;
    }
  }

  const deferredDestination = destinations.find((destination) => destination.id === deferredDestinationId);
  if (!deferredDestination) {
    return selectAdventureDestinations(destinations, 3, rng);
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

function destinationFromAdventureState(adventure, destinationId) {
  const event = (adventure.eventDestinations || []).find((item) => item?.id === destinationId);
  if (!event) return null;
  return {
    id: event.id,
    type: "destination",
    symbol: event.symbol || "◆",
    title: event.title || event.id,
    description: "",
  };
}

function rollAdventureAmbush(battle, adventure, destinationId) {
  const chanceIndex = Math.max(
    0,
    Math.min(ADVENTURE_AMBUSH_RATES.length - 1, Math.trunc(Number(adventure.ambushChanceIndex) || 0)),
  );
  const stage = Number(adventure.stage || 1);
  const beforeMirror = stage >= 3 && stage <= 10;
  const afterMirror = stage >= 14 && stage <= 18;
  const remainingEnemies = afterMirror
    ? Number(adventure.remainingOfficerCount || 0)
    : Number(adventure.remainingMonsterCount || 0);
  const canBeAmbushed = (beforeMirror || afterMirror) && remainingEnemies > 0;
  if (!canBeAmbushed) {
    adventure.lastAmbushChance = 0;
    adventure.lastAmbushRoll = null;
    adventure.lastAmbushTriggered = false;
    adventure.ambushChance = 0;
    return { chance: 0, roll: null, triggered: false };
  }
  const override = Number(adventure.nextAmbushChanceOverride);
  const hasOverride = Number.isFinite(override);
  const baseChance = canBeAmbushed
    ? hasOverride ? Math.max(0, Math.min(100, override)) : ADVENTURE_AMBUSH_RATES[chanceIndex]
    : 0;
  const relicReduction = adventureRelicEffectSum(
    { adventureRelics: adventure.playerRelics || [] },
    "ambush_chance_reduction",
  );
  const chance = Math.max(0, baseChance - relicReduction);
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
    const goldCost = Math.max(0, Math.trunc(Number(choice.effect?.goldCost || 0)));
    const requiresFullHpCost = Boolean(choice.effect?.requiresFullHpCost);
    const lacksMp = Boolean(requiresFullMpCost && battle?.player && battle.player.mp < mpCost);
    const lacksHp = Boolean(requiresFullHpCost && battle?.player && battle.player.hp < hpCost);
    const lacksGold = Boolean(goldCost > 0 && adventure && Number(adventure.gold || 0) < goldCost);
    const startsBattle = ["nest_bonus_battle", "graveyard_elite_battle"].includes(String(choice.effect?.type || ""));
    const lacksMonster = Boolean(startsBattle && Number(battle?.adventureRemainingMonsterCount ?? 1) <= 0);
    const relicId = String(choice.effect?.relicId || "");
    const alreadyOwnsRelic = Boolean(
      relicId && (adventure?.playerRelics || []).some((relic) => relic?.id === relicId && !relic.destroyed),
    );
    const disabled = lacksMp || lacksHp || lacksGold || lacksMonster || alreadyOwnsRelic;
    return {
      id: choice.id,
      type: "event_choice",
      symbol: choice.symbol || "◆",
      title: choice.title,
      description: choice.description || "",
      disabled,
      disabledReason: lacksMp
          ? `MP ${mpCost} 필요`
          : lacksHp
            ? `HP ${hpCost} 필요`
            : lacksGold
              ? `G ${goldCost} 필요`
              : lacksMonster
                ? "남은 마왕군 없음"
                : alreadyOwnsRelic
                  ? "이미 보유한 유물"
                : "",
    };
  });
}

function enterAdventureEvent(battle, adventure, event) {
  if (!event?.id) throw new Error("Adventure 이벤트 데이터가 없습니다.");
  const visitCounts = { ...(adventure.eventVisitCounts || {}) };
  if (!event.repeatable && Number(visitCounts[event.id] || 0) >= 1) {
    throw new Error("이미 방문한 Adventure 이벤트입니다.");
  }
  visitCounts[event.id] = Number(visitCounts[event.id] || 0) + 1;
  adventure.eventVisitCounts = visitCounts;
  adventure.phase = "event";
  adventure.currentEvent = structuredCloneCompat(event);
  if (event.relicShop) {
    adventure.choices = adventureRelicShopChoices(adventure, battle.rng);
    return;
  }
  battle.adventureRemainingMonsterCount = Number(adventure.remainingMonsterCount || 0);
  adventure.choices = adventureEventChoices(event, battle, adventure);
  delete battle.adventureRemainingMonsterCount;
}

function adventureRelicShopChoices(adventure, rng, excludedRelicIds = []) {
  const ownedIds = new Set((adventure.playerRelics || []).filter((relic) => !relic?.destroyed).map((relic) => relic.id));
  const excluded = new Set(excludedRelicIds || []);
  let pool = adventureRelicsForPool(adventure.relicCatalog, "shop")
    .filter((relic) => !ownedIds.has(relic.id) && !excluded.has(relic.id));
  if (pool.length < 2) {
    pool = adventureRelicsForPool(adventure.relicCatalog, "shop").filter((relic) => !ownedIds.has(relic.id));
  }
  const offers = selectAdventureDestinations(pool, 2, rng);
  adventure.currentRelicShopOfferIds = offers.map((relic) => relic.id);
  const discount = adventureRelicEffectSum(
    { adventureRelics: adventure.playerRelics || [] },
    "shop_discount",
  );
  const choices = offers.map((relic) => {
    const price = Math.max(0, Number(relic.price || 0) - discount);
    return {
      id: `buy_relic:${relic.id}`,
      type: "event_choice",
      symbol: `${price}G`,
      title: relic.name,
      description: relic.description,
      disabled: Number(adventure.gold || 0) < price,
      disabledReason: Number(adventure.gold || 0) < price ? `G ${price} 필요` : "",
      relicId: relic.id,
      price,
    };
  });
  if (adventure.hasRelicLedger) {
    choices.push({
      id: "show_relic_ledger",
      type: "event_choice",
      symbol: "REROLL",
      title: "장부를 보여준다",
      description: "장부를 소모해 진열된 두 유물을 새로운 유물로 교체한다.",
      disabled: false,
      disabledReason: "",
    });
  } else {
    choices.push({
      id: "take_free_potion",
      type: "event_choice",
      symbol: "FREE",
      title: "무료 물약을 받는다",
      description: "HP와 MP를 10 회복하고 상점을 나간다.",
      disabled: false,
      disabledReason: "",
    });
  }
  return choices;
}

function applyAdventureRelicShopChoice(battle, adventure, choiceId) {
  const id = String(choiceId || "");
  const fighter = battle.player;
  if (id === "show_relic_ledger") {
    if (!adventure.hasRelicLedger) throw new Error("보여줄 유물상 장부가 없습니다.");
    const previousOfferIds = [...(adventure.currentRelicShopOfferIds || [])];
    adventure.hasRelicLedger = false;
    adventure.choices = adventureRelicShopChoices(adventure, battle.rng, previousOfferIds);
    return { id, type: "relic_shop_reroll", label: "장부를 보여준다", stayInEvent: true, previousOfferIds, offerIds: [...adventure.currentRelicShopOfferIds] };
  }

  if (id === "take_free_potion") {
    const hpBefore = fighter.hp;
    const mpBefore = fighter.mp;
    battle.heal(fighter, 10, "유물 상점 무료 물약");
    battle.restoreMp(fighter, 10, "유물 상점 무료 물약");
    const result = {
      id,
      type: "relic_shop_potion",
      label: "무료 물약을 받는다",
      potion: { hpBefore, hpAfter: fighter.hp, mpBefore, mpAfter: fighter.mp },
    };
    adventure.playerCarryover = { hp: fighter.hp, mp: fighter.mp };
    return finishAdventureEventChoice(battle, adventure, result);
  }

  if (!id.startsWith("buy_relic:")) throw new Error("알 수 없는 유물 상점 선택지입니다.");
  const relicId = id.slice("buy_relic:".length);
  if (!(adventure.currentRelicShopOfferIds || []).includes(relicId)) throw new Error("현재 진열된 유물이 아닙니다.");
  const relic = adventureRelicById(adventure.relicCatalog, relicId);
  if (!relic || relic.pool !== "shop") throw new Error("구매할 유물을 찾을 수 없습니다.");
  const discount = adventureRelicEffectSum({ adventureRelics: adventure.playerRelics || [] }, "shop_discount");
  const price = Math.max(0, Number(relic.price || 0) - discount);
  const goldBefore = Math.max(0, Math.trunc(Number(adventure.gold || 0)));
  if (goldBefore < price) throw new Error(`G가 ${price} 이상이어야 구매할 수 있습니다.`);
  adventure.gold = goldBefore - price;
  const owned = grantAdventureRelic(adventure, fighter, relic);
  const result = {
    id,
    type: "relic_shop_purchase",
    label: relic.name,
    relic: owned,
    goldBefore,
    goldAfter: adventure.gold,
    goldSpent: price,
  };
  return finishAdventureEventChoice(battle, adventure, result);
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
    : adventureRouteChoices(adventure, { rng: battle.rng });
  return { ...reward, ...result, id: rewardId, rewardStep, rewardSpecialization };
}

function enterAdventureTown(adventure, choiceId, townEvent = null) {
  if (String(choiceId || "") !== "town") throw new Error("알 수 없는 행선지입니다.");
  const visitCounts = { ...(adventure.eventVisitCounts || {}) };
  if (Number(adventure.stage || 0) !== 2 || Number(visitCounts.town || 0) >= 1) {
    throw new Error("마을은 STAGE 2에서 한 번만 방문할 수 있습니다.");
  }
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
  if (event?.relicShop) return applyAdventureRelicShopChoice(battle, adventure, choiceId);
  const choice = event?.choices?.find((item) => item.id === String(choiceId || ""));
  if (!choice) throw new Error("알 수 없는 Adventure 이벤트 선택지입니다.");
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
  const goldCost = Math.max(0, Math.trunc(Number(effect.goldCost || 0)));
  if (goldCost > Number(adventure.gold || 0)) {
    throw new Error(`G가 ${goldCost} 이상이어야 선택할 수 있습니다.`);
  }
  let result;

  if (effect.type === "grant_relic") {
    const relic = adventureRelicById(adventure.relicCatalog, effect.relicId);
    if (!relic || relic.pool !== "event") throw new Error("이벤트 전용 유물을 찾을 수 없습니다.");
    const costs = payAdventureEventResourceCosts(battle, fighter, hpCost, mpCost, event.name);
    result = {
      id: choice.id,
      type: effect.type,
      relic: grantAdventureRelic(adventure, fighter, relic),
      ...costs,
    };
  } else if (effect.type === "grant_relic_ledger") {
    adventure.hasRelicLedger = true;
    result = { id: choice.id, type: effect.type, relicLedger: true };
  } else if (effect.type === "event_restore") {
    const costs = payAdventureEventResourceCosts(battle, fighter, hpCost, mpCost, event.name);
    const hpBefore = fighter.hp;
    const mpBefore = fighter.mp;
    const restoreHp = Math.max(0, Math.trunc(Number(effect.restoreHp || 0) + fighter.maxHp * Number(effect.restoreHpRate || 0)));
    const restoreMp = Math.max(0, Math.trunc(Number(effect.restoreMp || 0) + fighter.maxMp * Number(effect.restoreMpRate || 0)));
    if (restoreHp > 0) battle.heal(fighter, restoreHp, event.name);
    if (restoreMp > 0) battle.restoreMp(fighter, restoreMp, event.name);
    result = { id: choice.id, type: effect.type, ...costs, restore: { hpBefore, hpAfter: fighter.hp, mpBefore, mpAfter: fighter.mp } };
  } else if (effect.type === "event_stat") {
    const costs = payAdventureEventResourceCosts(battle, fighter, hpCost, mpCost, event.name);
    result = {
      id: choice.id,
      type: effect.type,
      ...costs,
      stat: increaseAdventureStat(battle, adventure, String(effect.statId || "atk"), Number(effect.statBonus || 0.1)),
    };
  } else if (effect.type === "event_all_stats") {
    const costs = payAdventureEventResourceCosts(battle, fighter, hpCost, mpCost, event.name);
    result = {
      id: choice.id,
      type: effect.type,
      ...costs,
      stats: ["atk", "def", "spd"].map((statId) => ({
        ...increaseAdventureStat(battle, adventure, statId, Number(effect.statBonus || 0.1)),
        delta: Number(effect.statBonus || 0.1),
      })),
    };
  } else if (effect.type === "event_route") {
    const costs = payAdventureEventResourceCosts(battle, fighter, hpCost, mpCost, event.name);
    const routeRerollGain = Math.max(0, Math.trunc(Number(effect.routeRerollCount || 0)));
    if (routeRerollGain > 0) adventure.routeRerollCount = Number(adventure.routeRerollCount || 0) + routeRerollGain;
    if (effect.nextAmbushChance != null) adventure.nextAmbushChanceOverride = Number(effect.nextAmbushChance);
    const advanceStage = Math.max(0, Math.trunc(Number(effect.advanceStage || 0)));
    if (advanceStage > 0) adventure.pendingStageAdvance = Number(adventure.pendingStageAdvance || 0) + advanceStage;
    result = {
      id: choice.id,
      type: effect.type,
      ...costs,
      routeRerollCount: routeRerollGain > 0 ? adventure.routeRerollCount : null,
      nextAmbushChance: effect.nextAmbushChance,
      advanceStage,
    };
  } else if (["event_gold", "leave"].includes(effect.type)) {
    result = { id: choice.id, type: effect.type, ...payAdventureEventResourceCosts(battle, fighter, hpCost, mpCost, event.name) };
  } else if (event.id === "magic_stone_mine" && effect.type === "calm") {
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
    const requestedLoss = Math.max(0, Math.trunc(Number(effect.hpLoss ?? 0)));
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
    result = {
      ...applyAdventureTurnEndHpRecovery(fighter, adventure, Number(effect.turnEndHpRecovery || 2), choice.id, effect.type),
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

  const goldBefore = Math.max(0, Math.trunc(Number(adventure.gold || 0)));
  const goldReward = Math.max(0, Math.trunc(Number(effect.goldReward || 0)));
  adventure.gold = Math.max(0, goldBefore - goldCost + goldReward);
  if (goldCost > 0 || goldReward > 0) {
    result = {
      ...result,
      goldBefore,
      goldAfter: adventure.gold,
      goldSpent: goldCost,
      goldGained: goldReward,
    };
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

function payAdventureEventResourceCosts(battle, fighter, hpCost, mpCost, label) {
  const result = {};
  if (hpCost > 0) {
    const before = fighter.hp;
    fighter.hp = Math.max(0, fighter.hp - hpCost);
    result.hp = { before, after: fighter.hp, amount: before - fighter.hp };
  }
  if (mpCost > 0) {
    const before = fighter.mp;
    battle.reduceMp(fighter, mpCost, label || "Adventure 이벤트");
    result.mp = { before, after: fighter.mp, amount: before - fighter.mp };
  }
  return result;
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
    adventure.lastCompletedEventId = String(adventure.currentEvent?.id || "");
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
  const relicStartRecovery = adventureRelicEffectSum(battle.player, "battle_start_mp_recovery");
  const startRecovery = Math.max(0, Math.trunc(Number(adventure.battleStartMpRecovery || 0) + relicStartRecovery));
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
  const goldBefore = Math.max(0, Math.trunc(Number(adventure.gold || 0)));
  const baseGoldReward = adventure.isFinalBattle
    ? 0
    : Number(adventure.stage || 1) >= 12 || adventure.isMirrorBattle
      ? ADVENTURE_LATE_BATTLE_GOLD
      : ADVENTURE_REGULAR_BATTLE_GOLD;
  const goldReward = baseGoldReward + (adventure.isFinalBattle ? 0 : adventureRelicEffectSum(fighter, "victory_gold_bonus"));
  adventure.gold = goldBefore + goldReward;
  if (goldReward > 0) battle.logs.push(`${fighter.name} G +${goldReward}. G ${goldBefore} -> ${adventure.gold}`);
  let victoryMaxHp = null;
  if (Number(activeConfig.victoryMaxHpMultiplier || 1) !== 1) {
    const before = fighter.maxHp;
    fighter.maxHp = Math.max(1, Math.round(fighter.maxHp * Number(activeConfig.victoryMaxHpMultiplier)));
    victoryMaxHp = { before, after: fighter.maxHp };
    battle.logs.push(`${fighter.name}의 최대 HP ${before} -> ${fighter.maxHp} (기사의 혼령)`);
  }
  const hpBefore = fighter.hp;
  const mp = fighter.mp;
  const healRate = Math.max(0, roundStat(
    ADVENTURE_POST_BATTLE_HEAL_RATE
    + Number(adventure.postBattleHealRateBonus || 0)
    + adventureRelicEffectSum(fighter, "post_battle_heal_bonus"),
  ));
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
    goldBefore,
    goldAfter: adventure.gold,
    goldReward,
    victoryMaxHp,
  };
  adventure.settled = true;
  adventure.settlement = settlement;
  adventure.playerCarryover = { hp: hpAfter, mp };
  adventure.previousBattleSnapshot = { hp: hpAfter, mp };
  adventure.playerSurviveDefeatCount = Number(fighter.adventureSurviveDefeatCount || 0);
  syncAdventureRelicsFromFighter(adventure, fighter);
  adventure.rewardChoicesRemaining = Math.max(1, Math.trunc(Number(activeConfig.rewardChoiceCount || 1)));
  adventure.selectedRewardIds = [];
  adventure.activeNextBattleEffects = [];
  delete adventure.activeBattleConfig;
  settlement.relics = structuredCloneCompat(adventure.playerRelics || []);
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
  ADVENTURE_LATE_BATTLE_GOLD,
  ADVENTURE_MIRROR_LEGACY_CHOICE_ID,
  ADVENTURE_MIRROR_STAGE,
  ADVENTURE_MIRROR_VARIANTS,
  ADVENTURE_POST_BATTLE_HEAL_RATE,
  ADVENTURE_REGULAR_BATTLE_GOLD,
  ADVENTURE_STARTING_GOLD,
  ADVENTURE_STAT_BONUS_STEP,
  ADVENTURE_TOWN_RESTORE_RATE,
  ADVENTURE_TOTAL_STAGES,
  adventureRewardChoices,
  adventureEventChoices,
  adventureRelicShopChoices,
  adventureMirrorVariant,
  adventureRouteChoices,
  adventureStageMultiplier,
  adventureTownChoices,
  adventureTownMealChoices,
  applyAdventureReward,
  applyAdventurePreemptiveStrike,
  applyAdventureEventChoice,
  applyAdventureRelicShopChoice,
  applyAdventureTownMeal,
  completeAdventureRun,
  createAdventureBattle,
  createFinalAdventureBattle,
  createMirrorAdventureBattle,
  createNextAdventureBattle,
  createOfficerAdventureBattle,
  enterAdventureTown,
  enterAdventureEvent,
  isAdventureMirrorChoice,
  rerollAdventureRouteChoices,
  rollAdventureAmbush,
  scaleAdventureMonster,
  settleAdventureVictory,
};
