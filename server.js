#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const {
  AI_PERSONALITIES,
  Battle,
  Mulberry32,
  actionStatesForFighter,
  fighterState,
  fighterSummary,
  normalizeInscriptions,
  randomInscriptionId,
  resolveCharacterIndex,
  resolveInscriptionId,
  resolvePersonality,
  stateForBattle,
} = require("./web/battle-engine/engine");
const {
  adventureRewardChoices,
  applyAdventureEventChoice,
  applyAdventurePreemptiveStrike,
  applyAdventureReward,
  applyAdventureTownMeal,
  completeAdventureRun,
  createAdventureBattle,
  createFinalAdventureBattle,
  createNextAdventureBattle,
  enterAdventureEvent,
  enterAdventureTown,
  rerollAdventureRouteChoices,
  rollAdventureAmbush,
  settleAdventureVictory,
} = require("./web/battle-engine/adventure");

const ROOT = __dirname;
const DATASET = path.join(ROOT, "dataset");
const WEB_ROOT = path.join(ROOT, "web");
const APP_ID = "VERSUS";
const ADVENTURE_SMOKE_MODE = process.argv.includes("--adventure-smoke");
const PVP_DEFAULT_PERSONALITY_ID = "R";
const PVP_MAX_TURNS = 200;
const FIREBASE_ROOMS_PATH = "versusRoomsJs";

class FirebaseClient {
  constructor(config) {
    this.databaseUrl = String(config.databaseURL || "").replace(/\/+$/, "");
    if (!this.databaseUrl) throw new Error("Firebase databaseURL is missing.");
  }

  async get(route) {
    return this.request("GET", route);
  }

  async put(route, value) {
    return this.request("PUT", route, value);
  }

  async patch(route, value) {
    return this.request("PATCH", route, value);
  }

  async delete(route) {
    return this.request("DELETE", route);
  }

  async request(method, route, value = undefined) {
    const url = `${this.databaseUrl}/${route}.json`;
    const response = await fetch(url, {
      method,
      headers: value === undefined ? undefined : { "content-type": "application/json; charset=utf-8" },
      body: value === undefined ? undefined : JSON.stringify(value),
    });
    if (!response.ok) {
      throw new Error(`Firebase ${method} ${route} failed: ${response.status}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
}

class GameStore {
  constructor() {
    this.characters = readJson(path.join(DATASET, "characters.json"));
    this.adventureMonsters = readJson(path.join(DATASET, "adventure-monsters.json"));
    this.adventureEvents = readJson(path.join(DATASET, "adventure-events.json"));
    this.adventureDialogue = readJson(path.join(DATASET, "adventure-dialogue.json"));
    this.inscriptions = normalizeInscriptions(readJson(path.join(DATASET, "inscriptions.json")));
    this.aiData = { personalities: AI_PERSONALITIES };
    this.battle = null;
    this.adventureState = null;
    this.pendingAiAction = null;
    this.pvpRooms = new Map();
    this.firebaseHostRooms = new Map();
    this.firebase = loadFirebaseClient();
  }

  options() {
    return {
      ok: true,
      characters: this.characters.map((character, index) => ({ ...character, index })),
      personalities: AI_PERSONALITIES,
      ai: this.aiData,
      inscriptions: this.inscriptions,
      defaultInscriptionId: "gray",
      randomInscriptionId: "random",
    };
  }

  newBattle(payload) {
    this.adventureState = null;
    const rng = new Mulberry32(payload.seed ?? null);
    const playerIndex = resolveCharacterIndex(this.characters, payload.playerIndex, rng);
    const aiIndex = resolveCharacterIndex(this.characters, payload.aiIndex, rng);
    const personalityId = resolvePersonality(payload.personalityId, rng);
    const playerInscriptionId = resolveInscriptionId(this.inscriptions, payload.playerInscriptionId, rng);
    const aiInscriptionId = randomInscriptionId(this.inscriptions, rng);
    this.battle = new Battle({
      characters: this.characters,
      inscriptions: this.inscriptions,
      playerIndex,
      aiIndex,
      personalityId,
      rng,
      playerInscriptionId,
      aiInscriptionId,
      hidePersonalityUntilGameOver: isRandomPersonalityRequest(payload.personalityId),
      maxTurns: payload.maxTurns || 200,
    });
    this.battle.startTurn();
    this.lockAiAction();
    const state = stateForBattle(this.battle);
    state.ok = true;
    state.aiChoiceLocked = Boolean(this.pendingAiAction && !this.battle.gameOver);
    state.log = [
      `전투 시작: ${this.battle.player.name} vs ${this.battle.ai.name}`,
      `${this.battle.player.name} 각인: ${this.battle.player.inscriptionName}`,
      `${this.battle.ai.name} 각인: ${this.battle.ai.inscriptionName}`,
      `AI 성향: ${this.battle.visiblePersonality().name}`,
    ];
    return state;
  }

  newAdventure(payload) {
    const encounter = createAdventureBattle({
      characters: this.characters,
      monsters: this.adventureMonsters,
      events: this.adventureEvents,
      inscriptions: this.inscriptions,
      payload,
      stage: 1,
    });
    this.battle = encounter.battle;
    this.adventureState = encounter.adventure;
    if (ADVENTURE_SMOKE_MODE) {
      this.battle.ai.maxHp = 1;
      this.battle.ai.hp = 1;
    }
    const prologue = this.adventureDialogue?.prologue || {};
    this.adventureState.phase = "prologue";
    this.adventureState.scene = {
      id: "prologue",
      title: "PROLOGUE",
      illustration: String(prologue.illustration || ""),
    };
    this.adventureState.choices = [{
      id: "start_adventure",
      type: "destination",
      symbol: "▶",
      title: "여정을 시작한다.",
      description: "",
    }];
    this.pendingAiAction = null;
    const state = stateForBattle(this.battle);
    state.ok = true;
    state.started = false;
    state.actions = [];
    state.adventure = { ...this.adventureState };
    state.aiChoiceLocked = false;
    const playerCharacter = this.characters.find((character) => character.id === this.battle.player.characterId);
    state.log = adventurePrologueLines(prologue, playerCharacter, this.battle.player.name);
    return state;
  }

  chooseAction(payload) {
    const battle = this.requireBattle();
    if (this.adventureState && this.adventureState.phase !== "battle") {
      throw new Error("지금은 전투 행동을 선택할 수 없습니다.");
    }
    if (battle.gameOver) throw new Error("Battle already ended.");
    const action = battle.findActionByInput(battle.player, payload.action);
    if (!action) throw new Error("Unknown action.");
    if (!battle.isLegalChoice(battle.player, action)) throw new Error("That action is not currently available.");
    const aiAction = this.consumeAiAction();
    battle.logs = [];
    battle.resolveTurn(battle.makeChoice(battle.player, action), battle.makeChoice(battle.ai, aiAction));
    if (!battle.gameOver) {
      battle.turn += 1;
      battle.startTurn();
      this.lockAiAction();
    } else {
      this.pendingAiAction = null;
      if (this.adventureState) {
        const playerWon = battle.winner?.side === battle.player.side;
        if (playerWon) {
          settleAdventureVictory(battle, this.adventureState);
          if (this.adventureState.isFinalBattle) {
            battle.logs.push("흑백의 마왕 모노크렘이 쓰러졌다.");
            const dialogue = adventureFinalBattleDialogue(
              this.adventureDialogue,
              battle,
              "post_battle",
            );
            if (dialogue) {
              this.adventureState.phase = "final_battle_ending";
              this.adventureState.dialogue = dialogue;
              this.adventureState.choices = [];
            } else {
              completeAdventureRun(battle, this.adventureState);
              battle.logs.push("여정을 마쳤다.");
            }
          } else {
            const dialogue = adventurePostBattleDialogue(
              this.adventureDialogue,
              battle,
              this.adventureState,
            );
            if (dialogue) {
              this.adventureState.phase = "post_battle_dialogue";
              this.adventureState.dialogue = dialogue;
              this.adventureState.choices = [];
            } else {
              this.adventureState.phase = "reward";
              this.adventureState.choices = adventureRewardChoices([], this.adventureState);
            }
          }
        } else {
          this.adventureState.phase = "defeat";
          this.adventureState.choices = [];
        }
      }
    }
    const state = stateForBattle(battle);
    state.ok = true;
    if (this.adventureState) state.adventure = { ...this.adventureState };
    state.aiChoiceLocked = Boolean(this.pendingAiAction && !battle.gameOver);
    state.log = battle.logs.slice();
    return state;
  }

  adventureChoice(payload) {
    let battle = this.requireBattle();
    if (!this.adventureState) throw new Error("진행 중인 Adventure가 없습니다.");
    const choiceId = String(payload.choiceId || "");
    const completesPostBattleDialogue = this.adventureState.phase === "post_battle_dialogue"
      && choiceId === "complete_post_battle_dialogue";
    const completesFinalBattleDialogue = this.adventureState.phase === "final_battle_dialogue"
      && choiceId === "complete_final_battle_dialogue";
    const completesFinalBattleEnding = this.adventureState.phase === "final_battle_ending"
      && choiceId === "complete_final_battle_ending";
    const isRouteReroll = this.adventureState.phase === "route"
      && choiceId === "route_reroll"
      && Number(this.adventureState.routeRerollCount || 0) > 0;
    const requestedChoice = this.adventureState.choices?.find((choice) => choice.id === choiceId);
    if (
      !requestedChoice
      && !isRouteReroll
      && !completesPostBattleDialogue
      && !completesFinalBattleDialogue
      && !completesFinalBattleEnding
    ) {
      throw new Error("현재 표시된 Adventure 선택지가 아닙니다.");
    }
    if (requestedChoice?.disabled) throw new Error(requestedChoice.disabledReason || "현재 선택할 수 없는 선택지입니다.");
    battle.logs = [];
    let log;
    if (this.adventureState.phase === "post_battle_dialogue") {
      this.adventureState.phase = "reward";
      this.adventureState.choices = adventureRewardChoices([], this.adventureState);
      delete this.adventureState.dialogue;
      log = [];
    } else if (this.adventureState.phase === "final_battle_dialogue") {
      this.adventureState.phase = "battle";
      this.adventureState.choices = [];
      delete this.adventureState.dialogue;
      battle.startTurn();
      this.lockAiAction();
      log = [
        `STAGE ${this.adventureState.stage} 최종 결전: ${battle.player.name} vs ${battle.ai.label}`,
        `${battle.ai.name}에게 마왕의 위엄(${this.adventureState.blessingMultiplier}배)이 적용됐다.`,
        ...adventureBattleStartEffectLines(this.adventureState),
      ];
    } else if (this.adventureState.phase === "final_battle_ending") {
      completeAdventureRun(battle, this.adventureState);
      delete this.adventureState.dialogue;
      log = [];
    } else if (this.adventureState.phase === "prologue") {
      if (choiceId !== "start_adventure") throw new Error("프롤로그를 마쳐야 여정을 시작할 수 있습니다.");
      this.adventureState.phase = "battle";
      this.adventureState.choices = [];
      delete this.adventureState.scene;
      battle.startTurn();
      this.lockAiAction();
      log = [
        `STAGE ${this.adventureState.stage} 전투 시작: ${battle.player.name} vs ${battle.ai.label}`,
        `${battle.ai.name}에게 마왕의 가호(${this.adventureState.blessingMultiplier}배)가 적용됐다.`,
        `${battle.player.name} 각인: ${battle.player.inscriptionName}`,
      ];
    } else if (this.adventureState.phase === "reward") {
      const reward = applyAdventureReward(battle, this.adventureState, payload.choiceId);
      log = [
        `${reward.label} 보상을 선택했다.`,
        `[@PLAYER]${battle.player.name}의 ${reward.label} +${Math.round(Number(reward.rewardStep || 0.1) * 100)}% (현재 ${reward.afterMultiplier}배)`,
        reward.remainingRewards > 0 ? "전투 보상을 하나 더 선택한다." : "다음 행선지가 나타났다.",
      ];
    } else if (this.adventureState.phase === "route" && isRouteReroll) {
      rerollAdventureRouteChoices(battle, this.adventureState);
      log = ["모래시계의 힘으로 행선지를 다시 살폈다.", "새로운 행선지가 나타났다."];
    } else if (this.adventureState.phase === "route") {
      const destinationId = String(payload.choiceId || "");
      const event = this.adventureEvents.find((item) => item.id === destinationId);
      const isCombatEvent = Boolean(event?.combat);
      const isNonCombatDestination = destinationId === "town" || Boolean(event && !isCombatEvent);
      const ambush = isNonCombatDestination
        ? rollAdventureAmbush(battle, this.adventureState, destinationId)
        : { chance: 0, roll: null, triggered: false };
      if (destinationId === "final_battle") {
        const encounter = createFinalAdventureBattle({
          characters: this.characters,
          monsters: this.adventureMonsters,
          inscriptions: this.inscriptions,
          previousBattle: battle,
          adventure: this.adventureState,
        });
        battle = encounter.battle;
        this.battle = battle;
        if (ADVENTURE_SMOKE_MODE) {
          battle.ai.maxHp = 1;
          battle.ai.hp = 1;
        }
        const dialogue = adventureFinalBattleDialogue(
          this.adventureDialogue,
          battle,
          "pre_battle",
        );
        if (dialogue) {
          this.adventureState.phase = "final_battle_dialogue";
          this.adventureState.dialogue = dialogue;
          this.adventureState.choices = [];
          this.pendingAiAction = null;
          log = ["최종 결전을 향한다."];
        } else {
          battle.startTurn();
          this.lockAiAction();
          log = [
            "최종 결전을 향한다.",
            `STAGE ${this.adventureState.stage} 최종 결전: ${battle.player.name} vs ${battle.ai.label}`,
            `${battle.ai.name}에게 마왕의 위엄(${this.adventureState.blessingMultiplier}배)이 적용됐다.`,
            ...adventureBattleStartEffectLines(this.adventureState),
          ];
        }
      } else if (isCombatEvent) {
        const encounter = createNextAdventureBattle({
          characters: this.characters,
          monsters: this.adventureMonsters,
          inscriptions: this.inscriptions,
          previousBattle: battle,
          adventure: this.adventureState,
        });
        battle = encounter.battle;
        this.battle = battle;
        const strike = applyAdventurePreemptiveStrike(battle, event.combat.enemyHpLossRate);
        if (ADVENTURE_SMOKE_MODE) {
          battle.ai.maxHp = 1;
          battle.ai.hp = 1;
        }
        battle.startTurn();
        this.lockAiAction();
        log = [
          "선제 공격.",
          `[@AI]${battle.ai.name}의 HP가 ${Math.round(strike.rate * 100)}% 감소했다. HP ${strike.hpBefore} -> ${strike.hpAfter}`,
          `STAGE ${this.adventureState.stage} 전투 시작: ${battle.player.name} vs ${battle.ai.label}`,
          `${battle.ai.name}에게 마왕의 가호(${this.adventureState.blessingMultiplier}배)가 적용됐다.`,
          ...adventureBattleStartEffectLines(this.adventureState),
        ];
      } else if (ambush.triggered) {
        const destinationName = requestedChoice.title || event?.name || "행선지";
        const encounter = createNextAdventureBattle({
          characters: this.characters,
          monsters: this.adventureMonsters,
          inscriptions: this.inscriptions,
          previousBattle: battle,
          adventure: this.adventureState,
        });
        battle = encounter.battle;
        this.battle = battle;
        if (ADVENTURE_SMOKE_MODE) {
          battle.ai.maxHp = 1;
          battle.ai.hp = 1;
        }
        battle.startTurn();
        this.lockAiAction();
        log = [
          "마왕군의 기습.",
          `${destinationName}에 가던 길이 막혔다.`,
          `기습 확률 ${ambush.chance}% / 판정값 ${ambush.roll}`,
          `STAGE ${this.adventureState.stage} 전투 시작: ${battle.player.name} vs ${battle.ai.label}`,
          `${battle.ai.name}에게 마왕의 가호(${this.adventureState.blessingMultiplier}배)가 적용됐다.`,
          ...adventureBattleStartEffectLines(this.adventureState),
        ];
      } else if (destinationId === "town") {
        const townEvent = this.adventureEvents.find((item) => item.id === "town");
        enterAdventureTown(this.adventureState, destinationId, townEvent);
        log = ["마을로 향합니다.", "따뜻한 스튜 세 가지가 준비되어 있다."];
      } else if (event) {
        enterAdventureEvent(battle, this.adventureState, event);
        log = [`${event.name}에 도착했다.`, event.description];
      } else if (destinationId === "battle") {
        const encounter = createNextAdventureBattle({
          characters: this.characters,
          monsters: this.adventureMonsters,
          inscriptions: this.inscriptions,
          previousBattle: battle,
          adventure: this.adventureState,
        });
        battle = encounter.battle;
        this.battle = battle;
        if (ADVENTURE_SMOKE_MODE) {
          battle.ai.maxHp = 1;
          battle.ai.hp = 1;
        }
        battle.startTurn();
        this.lockAiAction();
        log = [
          `STAGE ${this.adventureState.stage} 전투 시작: ${battle.player.name} vs ${battle.ai.label}`,
          `${battle.ai.name}에게 마왕의 가호(${this.adventureState.blessingMultiplier}배)가 적용됐다.`,
          ...adventureBattleStartEffectLines(this.adventureState),
        ];
      } else {
        throw new Error("알 수 없는 Adventure 행선지입니다.");
      }
    } else if (this.adventureState.phase === "town") {
      const meal = applyAdventureTownMeal(battle, this.adventureState, payload.choiceId);
      log = [`${meal.label}를 먹었다.`, ...battle.logs];
      if (meal.stat) {
        log.push("매콤 스튜 효과가 발동했다.");
        log.push(`[@PLAYER]${battle.player.name}의 ${meal.stat.label} +10% (현재 ${meal.stat.afterMultiplier}배)`);
      }
      log.push("마을에서 식사를 마쳤다.");
      log.push("다음 행선지가 나타났다.");
    } else if (this.adventureState.phase === "event") {
      const result = applyAdventureEventChoice(battle, this.adventureState, payload.choiceId);
      const selectionLog = {
        calm: "진정을 선택했다.",
        absorb: "흡수를 선택했다.",
        ignore: "방치를 선택했다.",
        potato_heal: "감자를 주웠다.",
        potato_buy: "감자를 샀다.",
        potato_bake: "감자를 굽기 시작했다.",
        spring_drink: "샘물을 마셨다.",
        spring_wash: "상처를 씻었다.",
        spring_bottle: "샘물을 담았다.",
        blood_altar: `"${result.label}" 선택지를 골랐다.`,
      }[result.type] || `"${result.label}" 선택지를 골랐다.`;
      log = [selectionLog, ...battle.logs];
      if (result.eventId === "magic_stone_mine") {
        if (result.type === "calm") {
          log.push(`[@PLAYER]${battle.player.name}의 기본 MP 회복량 +2 (현재 +${result.afterBonus})`);
          log.push("폭주하던 마석이 잦아들었다.");
        } else if (result.type === "absorb") {
          const outcome = result.success ? "성공" : "실패";
          const direction = result.success ? "감소" : "증가";
          log.push(`흡수 판정 75% / 판정값 ${result.roll} - ${outcome}`);
          log.push(`[@PLAYER]${battle.player.name}의 ${result.skillName} MP 소모량이 30% ${direction}했다. (현재 ${result.afterMultiplier}배)`);
        } else if (result.type === "ignore") {
          log.push(`[@PLAYER]${battle.player.name}에게 ${result.hpLoss}의 피해. HP ${result.hpBefore} -> ${result.hpAfter} (폭주한 마석)`);
        }
        log.push("마석 광산을 벗어났다.");
      } else if (result.eventId === "potato_farm") {
        if (result.type === "potato_bake") {
          log.push(`감자 굽기 판정 70% / 판정값 ${result.roll} - ${result.success ? "성공" : "실패"}`);
          if (!result.success) log.push("감자를 태워 아무 효과도 얻지 못했다.");
        }
        if (result.addedRecovery > 0) {
          log.push(`[@PLAYER]${battle.player.name}의 매 턴 종료 HP 회복량 +${result.addedRecovery} (현재 +${result.afterRecovery})`);
        }
        log.push("감자 농장을 떠났다.");
      } else if (result.eventId === "spring_of_life") {
        if (result.type === "spring_wash") {
          log.push(`[@PLAYER]${battle.player.name}에게 ${result.hpSpent}의 피해. HP ${result.hpBefore} -> ${result.hpAfter} (상처를 씻는다)`);
          log.push(`[@PLAYER]${battle.player.name}의 최대 HP +15% (${result.maxHpBefore} -> ${result.maxHpAfter})`);
        } else if (result.type === "spring_bottle") {
          log.push(`[@PLAYER]${battle.player.name}의 전투 종료 HP 회복량 ${Math.round(result.totalRate * 100)}%`);
        }
        log.push("생명의 샘을 떠났다.");
      } else if (result.eventId === "blood_altar") {
        log.push(`[@PLAYER]${battle.player.name}에게 ${result.hpSpent}의 피해. HP ${result.hpBefore} -> ${result.hpAfter} (피의 제단)`);
        log.push(`[@PLAYER]${battle.player.name}의 ${result.stat.label} +30% (현재 ${result.stat.afterMultiplier}배)`);
        log.push("피의 제단을 떠났다.");
      } else {
        log.push(...adventureEffectResultLines(battle.player, result));
      }
      if (result.startsBattle) {
        const encounter = createNextAdventureBattle({
          characters: this.characters,
          monsters: this.adventureMonsters,
          inscriptions: this.inscriptions,
          previousBattle: battle,
          adventure: this.adventureState,
          battleConfig: result.battleConfig,
        });
        battle = encounter.battle;
        this.battle = battle;
        if (ADVENTURE_SMOKE_MODE) {
          battle.ai.maxHp = 1;
          battle.ai.hp = 1;
        }
        battle.startTurn();
        this.lockAiAction();
        log.push(`STAGE ${this.adventureState.stage} 전투 시작: ${battle.player.name} vs ${battle.ai.label}`);
        log.push(`${battle.ai.name}에게 마왕의 가호(${this.adventureState.blessingMultiplier}배)가 적용됐다.`);
        log.push(...adventureBattleStartEffectLines(this.adventureState));
      } else if (this.adventureState.phase === "defeat") {
        log.push(`[@PLAYER]${battle.player.name}의 HP가 0이 되었다.`);
        log.push("여정이 끝났다.");
      } else {
        log.push("다음 행선지가 나타났다.");
      }
    } else {
      throw new Error("지금은 선택지를 고를 수 없습니다.");
    }

    const state = stateForBattle(battle);
    state.ok = true;
    state.adventure = { ...this.adventureState };
    state.aiChoiceLocked = Boolean(this.pendingAiAction && !battle.gameOver);
    state.log = log;
    return state;
  }

  state() {
    if (!this.battle) return { started: false };
    const state = stateForBattle(this.battle);
    if (this.adventureState) state.adventure = { ...this.adventureState };
    state.aiChoiceLocked = Boolean(this.pendingAiAction && !this.battle.gameOver);
    return state;
  }

  lockAiAction() {
    const battle = this.requireBattle();
    this.pendingAiAction = battle.gameOver ? null : battle.selectAiAction(battle.ai, battle.player, battle.personality);
  }

  consumeAiAction() {
    const battle = this.requireBattle();
    if (!this.pendingAiAction || !battle.isLegalChoice(battle.ai, this.pendingAiAction)) {
      this.lockAiAction();
    }
    const action = this.pendingAiAction;
    this.pendingAiAction = null;
    if (!action) throw new Error("AI action is not available.");
    return action;
  }

  requireBattle() {
    if (!this.battle) throw new Error("Battle has not started.");
    return this.battle;
  }

  async pvpJoin(payload) {
    if (this.firebase) return this.firebasePvpJoin(payload);
    return this.localPvpJoin(payload);
  }

  async pvpState(payload) {
    if (this.firebase) return this.firebasePvpState(payload);
    return this.localPvpState(payload);
  }

  async pvpChooseAction(payload) {
    if (this.firebase) return this.firebasePvpChooseAction(payload);
    return this.localPvpChooseAction(payload);
  }

  async pvpLeave(payload) {
    if (this.firebase) return this.firebasePvpLeave(payload);
    return this.localPvpLeave(payload);
  }

  localPvpJoin(payload) {
    const code = this.localFindOrCreateRoomCode(payload.roomCode);
    const room = this.pvpRooms.get(code);
    let token = String(payload.token || "");
    let slot = slotForToken(room, token);
    const isNewPlayer = slot == null;
    if (slot == null) {
      slot = firstEmptySlot(room);
      if (slot == null) throw new Error("이미 두 명이 들어온 방입니다.");
      token = crypto.randomBytes(18).toString("base64url");
    }
    const rng = new Mulberry32();
    room.players[slot] = {
      token,
      characterIndex: resolveCharacterIndex(this.characters, payload.playerIndex, rng),
      inscriptionId: resolveInscriptionId(this.inscriptions, payload.playerInscriptionId, rng),
    };
    if (room.status === "waiting" && room.players[0] && room.players[1]) this.startPvpBattle(room);
    const state = this.localPvpState({ roomCode: code, token, sinceLogSerial: payload.sinceLogSerial || 0 });
    state.ok = true;
    state.token = token;
    state.noticeLog = [`PvP 방 ${code}에 입장했습니다.`, state.started ? (isNewPlayer ? "상대와 연결되었습니다." : "PvP 방에 재접속했습니다.") : "상대 입장을 기다리는 중입니다."];
    return state;
  }

  localPvpState(payload) {
    const room = this.requireLocalPvpRoom(payload.roomCode);
    const slot = requireSlot(room, payload.token);
    return { ok: true, token: room.players[slot].token, ...this.pvpStateForSlot(room, slot, payload.sinceLogSerial || 0) };
  }

  localPvpChooseAction(payload) {
    const room = this.requireLocalPvpRoom(payload.roomCode);
    const slot = requireSlot(room, payload.token);
    if (room.status !== "active" || !room.battle) throw new Error("아직 전투가 시작되지 않았습니다.");
    const fighter = slot === 0 ? room.battle.player : room.battle.ai;
    const action = room.battle.findActionByInput(fighter, payload.action);
    if (!action || !room.battle.isLegalChoice(fighter, action)) throw new Error("PvP 행동 정보가 올바르지 않습니다.");
    room.pendingActions[slot] = action;
    let noticeLog = ["행동을 선택했습니다. 상대 선택을 기다리는 중입니다."];
    if (room.pendingActions[0] && room.pendingActions[1]) {
      this.resolvePvpTurn(room);
      noticeLog = [];
    }
    return { ok: true, token: room.players[slot].token, noticeLog, ...this.pvpStateForSlot(room, slot, payload.sinceLogSerial || 0) };
  }

  localPvpLeave(payload) {
    const room = this.pvpRooms.get(normalizeRoomCode(payload.roomCode));
    if (room) {
      room.status = "closed";
      room.logSerial += 1;
      room.log = ["상대가 방을 나갔습니다."];
    }
    return { ok: true };
  }

  localFindOrCreateRoomCode(value) {
    const raw = String(value || "").trim();
    if (raw) {
      const code = normalizeRoomCode(raw);
      if (!this.pvpRooms.has(code)) this.pvpRooms.set(code, createPvpRoom(code, false));
      return code;
    }
    for (const room of this.pvpRooms.values()) {
      if (room.autoMatch && room.status === "waiting" && room.players[0] && !room.players[1]) return room.code;
    }
    const code = `MATCH-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    this.pvpRooms.set(code, createPvpRoom(code, true));
    return code;
  }

  requireLocalPvpRoom(value) {
    const code = normalizeRoomCode(value);
    const room = this.pvpRooms.get(code);
    if (!room) throw new Error("존재하지 않는 PvP 방입니다.");
    return room;
  }

  startPvpBattle(room) {
    room.battle = new Battle({
      characters: this.characters,
      inscriptions: this.inscriptions,
      playerIndex: room.players[0].characterIndex,
      aiIndex: room.players[1].characterIndex,
      personalityId: PVP_DEFAULT_PERSONALITY_ID,
      rng: new Mulberry32(`${room.code}:${Date.now()}`),
      playerInscriptionId: room.players[0].inscriptionId,
      aiInscriptionId: room.players[1].inscriptionId,
      maxTurns: PVP_MAX_TURNS,
    });
    room.battle.startTurn();
    room.status = "active";
    room.logSerial += 1;
    room.logTurn = 0;
    room.log = [
      `PvP 전투 시작: ${room.battle.player.name} vs ${room.battle.ai.name}`,
      `${room.battle.player.name} 각인: ${room.battle.player.inscriptionName}`,
      `${room.battle.ai.name} 각인: ${room.battle.ai.inscriptionName}`,
    ];
  }

  resolvePvpTurn(room) {
    const battle = room.battle;
    battle.logs = [];
    battle.resolveTurn(battle.makeChoice(battle.player, room.pendingActions[0]), battle.makeChoice(battle.ai, room.pendingActions[1]));
    room.pendingActions = {};
    room.logSerial += 1;
    room.logTurn = battle.turn;
    room.log = battle.logs.slice();
    if (!battle.gameOver) {
      battle.turn += 1;
      battle.startTurn();
    } else {
      room.status = "finished";
    }
  }

  pvpStateForSlot(room, slot, sinceLogSerial = 0) {
    if (room.status === "closed") return { closed: true, forceHome: true, noticeLog: room.log || [] };
    if (!room.battle) {
      return {
        roomCode: room.code,
        started: false,
        waiting: true,
        turn: 0,
        player: previewState(this.characters[room.players[slot]?.characterIndex], "player"),
        ai: previewState(this.characters[room.players[1 - slot]?.characterIndex], "ai"),
        actions: [],
        selectionLocked: true,
        opponentReady: false,
        log: Number(sinceLogSerial) < room.logSerial ? room.log : [],
        logSerial: room.logSerial,
        logTurn: room.logTurn,
      };
    }
    const battle = room.battle;
    const own = slot === 0 ? battle.player : battle.ai;
    const other = slot === 0 ? battle.ai : battle.player;
    const selected = Boolean(room.pendingActions[slot]);
    const opponentReady = Boolean(room.pendingActions[1 - slot]);
    const state = stateForBattle(battle, own, selected || battle.gameOver);
    state.roomCode = room.code;
    state.player = fighterState(battle, own, "player");
    state.ai = fighterState(battle, other, "ai");
    state.actions = actionStatesForFighter(battle, own, selected || battle.gameOver);
    state.selectionLocked = selected;
    state.opponentReady = opponentReady;
    state.log = Number(sinceLogSerial) < room.logSerial ? room.log : [];
    state.logSerial = room.logSerial;
    state.logTurn = room.logTurn;
    state.winner = pvpSummary(room, slot, battle.winner);
    state.loser = pvpSummary(room, slot, battle.loser);
    state.result = state.gameOver && state.winner ? `${state.winner.label} 승리` : state.result;
    return state;
  }

  async firebasePvpJoin(payload) {
    const code = await this.firebaseFindOrCreateRoomCode(payload.roomCode);
    let room = (await this.firebaseGetRoom(code)) || createFirebaseRoom(code, code.startsWith("MATCH-"));
    let token = String(payload.token || "");
    let slot = slotForToken(room, token);
    const isNewPlayer = slot == null;
    if (slot == null) {
      slot = firstEmptySlot(room);
      if (slot == null) throw new Error("이미 두 명이 들어온 방입니다.");
      token = crypto.randomBytes(18).toString("base64url");
    }
    const rng = new Mulberry32();
    room.players = indexed(room.players);
    room.players[slot] = {
      token,
      characterIndex: resolveCharacterIndex(this.characters, payload.playerIndex, rng),
      inscriptionId: resolveInscriptionId(this.inscriptions, payload.playerInscriptionId, rng),
      updatedAt: Date.now(),
    };
    room.hostToken = room.hostToken || token;
    room.updatedAt = Date.now();
    await this.firebasePutRoom(code, room);
    if (room.hostToken === token) await this.firebaseSyncHostRoom(code);
    room = (await this.firebaseGetRoom(code)) || room;
    const state = this.firebaseStateFromRoom(room, slot, payload.sinceLogSerial || 0);
    state.ok = true;
    state.token = token;
    state.noticeLog = [`PvP 방 ${code}에 입장했습니다.`, state.started ? (isNewPlayer ? "상대와 연결되었습니다." : "PvP 방에 재접속했습니다.") : "상대 입장을 기다리는 중입니다."];
    return state;
  }

  async firebasePvpState(payload) {
    const code = normalizeRoomCode(payload.roomCode);
    let room = await this.firebaseGetRoom(code);
    if (!room) throw new Error("존재하지 않는 PvP 방입니다.");
    const slot = requireSlot(room, payload.token);
    if (room.hostToken === payload.token) {
      await this.firebaseSyncHostRoom(code);
      room = (await this.firebaseGetRoom(code)) || room;
    }
    const state = this.firebaseStateFromRoom(room, slot, payload.sinceLogSerial || 0);
    state.ok = true;
    state.token = room.players[slot].token;
    return state;
  }

  async firebasePvpChooseAction(payload) {
    const code = normalizeRoomCode(payload.roomCode);
    let room = await this.firebaseGetRoom(code);
    if (!room) throw new Error("존재하지 않는 PvP 방입니다.");
    const slot = requireSlot(room, payload.token);
    if (room.status !== "active") throw new Error("아직 전투가 시작되지 않았습니다.");
    const actions = indexed(room.actions);
    actions[slot] = { turn: Number(room.turn || 1), action: String(payload.action || ""), updatedAt: Date.now() };
    await this.firebasePatchRoom(code, { actions, updatedAt: Date.now() });
    let noticeLog = ["행동을 선택했습니다. 상대 선택을 기다리는 중입니다."];
    if (room.hostToken === payload.token) {
      await this.firebaseSyncHostRoom(code);
      room = (await this.firebaseGetRoom(code)) || room;
      if (!room.actions || !Object.keys(indexed(room.actions)).length) noticeLog = [];
    } else {
      room = (await this.firebaseGetRoom(code)) || room;
    }
    const state = this.firebaseStateFromRoom(room, slot, payload.sinceLogSerial || 0);
    state.ok = true;
    state.token = room.players[slot].token;
    state.noticeLog = noticeLog;
    return state;
  }

  async firebasePvpLeave(payload) {
    const code = normalizeRoomCode(payload.roomCode);
    const room = await this.firebaseGetRoom(code);
    if (!room) return { ok: true };
    await this.firebasePatchRoom(code, {
      status: "closed",
      logSerial: Number(room.logSerial || 0) + 1,
      logTurn: Number(room.turn || 0),
      log: ["상대가 방을 나갔습니다."],
      updatedAt: Date.now(),
    });
    this.firebaseHostRooms.delete(code);
    return { ok: true };
  }

  async firebaseFindOrCreateRoomCode(value) {
    const raw = String(value || "").trim();
    if (raw) {
      const code = normalizeRoomCode(raw);
      if (!(await this.firebaseGetRoom(code))) await this.firebasePutRoom(code, createFirebaseRoom(code, false));
      return code;
    }
    const rooms = (await this.firebase.get(FIREBASE_ROOMS_PATH)) || {};
    for (const [code, room] of Object.entries(rooms)) {
      const players = indexed(room.players);
      if (room.autoMatch && room.status === "waiting" && players[0] && !players[1]) return code;
    }
    const code = `MATCH-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    await this.firebasePutRoom(code, createFirebaseRoom(code, true));
    return code;
  }

  async firebaseGetRoom(code) {
    const room = await this.firebase.get(`${FIREBASE_ROOMS_PATH}/${code}`);
    if (room && typeof room === "object") {
      room.players = indexed(room.players);
      room.actions = indexed(room.actions);
      return room;
    }
    return null;
  }

  async firebasePutRoom(code, room) {
    await this.firebase.put(`${FIREBASE_ROOMS_PATH}/${code}`, room);
  }

  async firebasePatchRoom(code, patch) {
    await this.firebase.patch(`${FIREBASE_ROOMS_PATH}/${code}`, patch);
  }

  async firebaseSyncHostRoom(code) {
    const roomData = await this.firebaseGetRoom(code);
    if (!roomData || roomData.status === "closed") return;
    let room = this.firebaseHostRooms.get(code);
    if (!room) {
      room = createPvpRoom(code, Boolean(roomData.autoMatch));
      this.firebaseHostRooms.set(code, room);
    }
    room.players = indexed(roomData.players);
    if (roomData.status === "waiting" && room.players[0] && room.players[1]) {
      this.startPvpBattle(room);
      await this.firebasePublishHostRoom(room, "active");
      return;
    }
    if (!room.battle || roomData.status !== "active") return;
    const actions = indexed(roomData.actions);
    const turn = Number(room.battle.turn || 1);
    if (!(actions[0] && actions[1] && Number(actions[0].turn) === turn && Number(actions[1].turn) === turn)) return;
    for (const slot of [0, 1]) {
      const fighter = slot === 0 ? room.battle.player : room.battle.ai;
      const action = room.battle.findActionByInput(fighter, actions[slot].action);
      if (!action || !room.battle.isLegalChoice(fighter, action)) throw new Error("Firebase PvP 행동 정보가 올바르지 않습니다.");
      room.pendingActions[slot] = action;
    }
    this.resolvePvpTurn(room);
    await this.firebasePublishHostRoom(room, room.battle.gameOver ? "finished" : "active");
  }

  async firebasePublishHostRoom(room, status) {
    const states = {
      0: this.pvpStateForSlot(room, 0, -1),
      1: this.pvpStateForSlot(room, 1, -1),
    };
    await this.firebasePatchRoom(room.code, {
      status,
      turn: room.battle?.turn || 0,
      actions: {},
      states,
      logSerial: room.logSerial,
      logTurn: room.logTurn,
      log: room.log,
      updatedAt: Date.now(),
    });
  }

  firebaseStateFromRoom(room, slot, sinceLogSerial = 0) {
    if (room.status === "closed") return { closed: true, forceHome: true, noticeLog: room.log || [] };
    const states = indexed(room.states);
    if (states[slot]) {
      const state = { ...states[slot] };
      state.log = Number(sinceLogSerial) < Number(room.logSerial || 0) ? room.log || [] : [];
      state.logSerial = Number(room.logSerial || 0);
      state.logTurn = Number(room.logTurn || 0);
      state.roomCode = room.code;
      return state;
    }
    return {
      roomCode: room.code,
      started: false,
      waiting: true,
      turn: 0,
      player: previewState(this.characters[room.players?.[slot]?.characterIndex], "player"),
      ai: previewState(this.characters[room.players?.[1 - slot]?.characterIndex], "ai"),
      actions: [],
      selectionLocked: true,
      opponentReady: false,
      log: Number(sinceLogSerial) < Number(room.logSerial || 0) ? room.log || [] : [],
      logSerial: Number(room.logSerial || 0),
      logTurn: Number(room.logTurn || 0),
    };
  }
}

const store = new GameStore();

const server = http.createServer(async (request, response) => {
  try {
    const parsed = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    if (request.method === "GET") {
      if (parsed.pathname === "/api/health") return sendJson(response, { ok: true, app: APP_ID, root: ROOT });
      if (parsed.pathname === "/api/options") return sendJson(response, store.options());
      if (parsed.pathname === "/api/state") return sendJson(response, store.state());
      if (parsed.pathname.startsWith("/dataset/")) return serveDataset(response, parsed.pathname);
      return serveStatic(response, parsed.pathname);
    }
    if (request.method === "POST") {
      const payload = await readJsonBody(request);
      if (parsed.pathname === "/api/new") return sendJson(response, store.newBattle(payload));
      if (parsed.pathname === "/api/adventure/new") return sendJson(response, store.newAdventure(payload));
      if (parsed.pathname === "/api/adventure/choice") return sendJson(response, store.adventureChoice(payload));
      if (parsed.pathname === "/api/action") return sendJson(response, store.chooseAction(payload));
      if (parsed.pathname === "/api/pvp/join") return sendJson(response, await store.pvpJoin(payload));
      if (parsed.pathname === "/api/pvp/state") return sendJson(response, await store.pvpState(payload));
      if (parsed.pathname === "/api/pvp/action") return sendJson(response, await store.pvpChooseAction(payload));
      if (parsed.pathname === "/api/pvp/leave") return sendJson(response, await store.pvpLeave(payload));
      if (parsed.pathname === "/api/exit") {
        sendJson(response, { ok: true });
        setTimeout(() => server.close(() => process.exit(0)), 50);
        return;
      }
    }
    sendJson(response, { ok: false, error: "Unknown API.", message: "Unknown API." }, 404);
  } catch (error) {
    sendJson(response, { ok: false, error: error.message, message: error.message }, 500);
  }
});

const port = Number(parseArg("--port") || process.env.PORT || 8765);
if (require.main === module) {
  server.listen(port, "127.0.0.1", () => {
    console.log(`VERSUS JS server listening on http://127.0.0.1:${port}`);
  });
}

function adventurePrologueLines(prologue, character, playerName) {
  const common = Array.isArray(prologue?.common) ? prologue.common : [];
  const backgroundLines = splitAdventureBackground(character?.background);
  const characterLines = Array.isArray(prologue?.characters?.[character?.id])
    ? prologue.characters[character.id]
    : [];
  return [...common, ...backgroundLines, ...characterLines]
    .map((line) => formatAdventureDialogueLine(line, { player: playerName }))
    .filter(Boolean);
}

function adventurePostBattleDialogue(dialogueData, battle, adventure) {
  const monsterId = String(adventure?.monsterId || battle?.ai?.characterId || "");
  const playerId = String(battle?.player?.characterId || "");
  const entries = dialogueData?.post_battle?.[monsterId]?.[playerId];
  if (!Array.isArray(entries) || entries.length === 0) return null;

  const monsterName = String(battle.ai.name || adventure?.monsterName || "상대");
  const playerName = String(battle.player.name || "플레이어");
  return {
    id: `${monsterId}:${playerId}`,
    title: `전투 후 · ${monsterName}`,
    monsterId,
    playerId,
    monsterName,
    playerName,
    lines: entries
      .map((line) => formatAdventureDialogueLine(line, {
        monster: monsterName,
        player: playerName,
      }))
      .filter(Boolean),
  };
}

function adventureFinalBattleDialogue(dialogueData, battle, section) {
  const playerId = String(battle?.player?.characterId || "");
  const finalBattle = dialogueData?.final_battle;
  const entries = section === "pre_battle"
    ? [
        ...(Array.isArray(finalBattle?.pre_battle?.common) ? finalBattle.pre_battle.common : []),
        ...(Array.isArray(finalBattle?.pre_battle?.characters?.[playerId])
          ? finalBattle.pre_battle.characters[playerId]
          : []),
      ]
    : finalBattle?.post_battle?.[playerId];
  if (!Array.isArray(entries) || entries.length === 0) return null;

  const monsterName = String(battle?.ai?.name || "모노크렘");
  const playerName = String(battle?.player?.name || "플레이어");
  return {
    id: `final_battle:${section}:${playerId}`,
    title: section === "pre_battle" ? `전투 전 · ${monsterName}` : `전투 후 · ${monsterName}`,
    monsterId: String(battle?.ai?.characterId || "demon_king_monochrem"),
    playerId,
    monsterName,
    playerName,
    lines: entries
      .map((line) => formatAdventureDialogueLine(line, {
        monster: monsterName,
        player: playerName,
      }))
      .filter(Boolean),
  };
}

function splitAdventureBackground(background) {
  const text = String(background || "").trim();
  if (!text) return [];
  return (text.match(/[^.!?]+(?:[.!?]+|$)/g) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function formatAdventureDialogueLine(line, speakers = {}) {
  if (typeof line === "string") return line.trim();
  const text = String(line?.text || "").trim();
  if (!text) return "";
  const speaker = String(line?.speaker || "").trim();
  if (!speaker || speaker === "narrator") return text;
  const speakerName = speakers[speaker] || speaker;
  return `${speakerName}: “${text}”`;
}

function adventureBattleStartEffectLines(adventure) {
  const lines = [];
  const recovery = adventure.lastBattleStartMpRecovery;
  if (recovery?.amount > 0) lines.push(`전투 시작 효과로 MP를 ${recovery.amount} 회복했다. MP ${recovery.before} -> ${recovery.after}`);
  for (const effect of adventure.activeNextBattleEffects || []) {
    if (effect.type === "all_skill_cost") lines.push(`이번 전투 동안 모든 액티브 스킬의 MP 소모량이 ${effect.multiplier}배가 된다.`);
    if (effect.type === "damage") lines.push(`이번 전투 동안 공격으로 주는 피해가 ${effect.multiplier}배가 된다.`);
    if (effect.type === "turn_end_mp") lines.push(`이번 전투 동안 매 턴 종료 시 MP를 ${effect.amount} 추가로 회복한다.`);
    if (effect.type === "skip_enemy_action") lines.push("상대의 첫 행동이 봉쇄됐다.");
    if (effect.type === "both_turn_end_fixed_damage") lines.push(`이번 전투 동안 양측 모두 매 턴 종료 시 ${effect.amount}의 고정 피해를 입는다.`);
  }
  return lines;
}

function adventureEffectResultLines(fighter, result) {
  const lines = [];
  if (typeof result.success === "boolean") {
    lines.push(`판정값 ${result.roll} - ${result.success ? "성공" : "실패"}`);
  }
  if (result.hp?.amount > 0) {
    lines.push(`[@PLAYER]${fighter.name}에게 ${result.hp.amount}의 피해. HP ${result.hp.before} -> ${result.hp.after}`);
  }
  for (const stat of result.stats || []) {
    const percent = Math.round(Math.abs(Number(stat.delta || 0)) * 100);
    const direction = Number(stat.delta || 0) >= 0 ? "+" : "-";
    lines.push(`[@PLAYER]${fighter.name}의 ${stat.label} ${direction}${percent}% (현재 ${stat.afterMultiplier}배)`);
  }
  for (const skill of [result.skill, result.costSkill, result.powerSkill, result.accuracySkill, result.prioritySkill].filter(Boolean)) {
    const labels = { cost: "MP 소모량 배율", power: "위력 배율", accuracy: "명중률 보정", priority: "우선도 보정" };
    lines.push(`[@PLAYER]${skill.skillName}의 ${labels[skill.kind] || "효과"} ${skill.before} -> ${skill.after}`);
  }
  if (result.commonAction) {
    const action = result.commonAction;
    if (action.unit === "power") {
      lines.push(`[@PLAYER]${action.name}의 위력 ${action.before} -> ${action.after}`);
    } else if (action.unit === "defense") {
      lines.push(`[@PLAYER]${action.name}의 추가 피해 경감률 ${Math.round(action.before * 100)}%p -> ${Math.round(action.after * 100)}%p`);
    } else if (action.unit === "meditation") {
      lines.push(`[@PLAYER]${action.name}의 추가 MP 회복량 ${action.before} -> ${action.after}`);
    }
  }
  if (result.rhythm) {
    const rhythmNames = { rush: "빠른 박자", wall: "무거운 박자", late: "느린 박자" };
    lines.push(`${rhythmNames[result.rhythm.kind] || "전투의 박자"}가 이후 전투에 적용된다.`);
  }
  if (result.rewardSpecialization) {
    const stat = String(result.rewardSpecialization.preferredStat || "").toUpperCase();
    lines.push(`다음 ${result.rewardSpecialization.battlesRemaining}번의 전투 보상이 ${stat} 중심으로 변경된다.`);
  }
  if (result.relic) {
    const relicNames = { red_amber: "붉은 호박", blue_amber: "푸른 호박", glass_eye: "유리 눈" };
    lines.push(`${relicNames[result.relic.kind] || "유물"}이 다음 ${result.relic.battlesRemaining}번의 전투에 반응한다.`);
  }
  if (result.maxHp) lines.push(`[@PLAYER]${fighter.name}의 최대 HP ${result.maxHp.before} -> ${result.maxHp.after}`);
  if (result.maxMp) lines.push(`[@PLAYER]${fighter.name}의 최대 MP ${result.maxMp.before} -> ${result.maxMp.after}`);
  if (Array.isArray(result.removedPenalties)) {
    lines.push(result.removedPenalties.length > 0
      ? `영구 약화 효과 ${result.removedPenalties.length}개가 제거됐다.`
      : "제거할 영구 약화 효과가 없었다.");
  }
  if (result.postBattleHeal) {
    lines.push(`전투 종료 HP 회복 보정이 ${Math.round(result.postBattleHeal.after * 100)}%가 됐다.`);
  }
  if (result.battleStartMpRecovery != null) lines.push(`이후 전투 시작 시 MP를 ${result.battleStartMpRecovery} 회복한다.`);
  if (result.nextAmbushChance != null) lines.push(`다음 행선지의 기습 확률이 ${result.nextAmbushChance}%가 됐다.`);
  if (result.routeRerollCount != null) lines.push(`행선지를 다시 뽑을 기회 ${result.routeRerollCount}회를 얻었다.`);
  if (result.forceTownNextRoute) lines.push("다음 행선지에 마을이 나타난다.");
  if (result.advanceStage) lines.push(`스테이지를 ${result.advanceStage}개 건너뛴다.`);
  if (result.surviveDefeatCount) lines.push(`수호 부적 ${result.surviveDefeatCount}회를 보유한다.`);
  if (result.futureEnemyMaxHpMultiplier) lines.push(`이후 마왕군 최대 HP 배율이 ${result.futureEnemyMaxHpMultiplier}배가 됐다.`);
  if (result.restored === false) lines.push("되돌릴 전투 기록이 없어 변화가 없었다.");
  if (result.battleCount) lines.push(`효과가 다음 ${result.battleCount}번의 전투에 적용된다.`);
  if (result.skipEnemyFirstTurn) lines.push("다음 전투에서 상대의 첫 행동을 막는다.");
  return lines;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadFirebaseClient() {
  if (process.env.VERSUS_DISABLE_FIREBASE === "1") return null;
  const file = path.join(DATASET, "firebase.json");
  if (!fs.existsSync(file)) return null;
  try {
    return new FirebaseClient(readJson(file));
  } catch {
    return null;
  }
}

function sendJson(response, payload, status = 200) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": body.length,
    "cache-control": "no-store",
  });
  response.end(body);
}

function serveStatic(response, pathname) {
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const file = path.resolve(WEB_ROOT, relative);
  if (!file.startsWith(path.resolve(WEB_ROOT))) {
    sendJson(response, { ok: false, error: "Forbidden." }, 403);
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      sendJson(response, { ok: false, error: "Not found." }, 404);
      return;
    }
    response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" });
    response.end(data);
  });
}

function serveDataset(response, pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/dataset\/+/, "");
  const file = path.resolve(DATASET, relative);
  const datasetRoot = path.resolve(DATASET);
  if (!file.startsWith(`${datasetRoot}${path.sep}`)) {
    sendJson(response, { ok: false, error: "Forbidden." }, 403);
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      sendJson(response, { ok: false, error: "Not found." }, 404);
      return;
    }
    response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" });
    response.end(data);
  });
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".png": "image/png",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
  }[ext] || "application/octet-stream";
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function createPvpRoom(code, autoMatch) {
  return {
    code,
    autoMatch,
    status: "waiting",
    players: {},
    pendingActions: {},
    battle: null,
    logSerial: 0,
    logTurn: 0,
    log: [],
  };
}

function createFirebaseRoom(code, autoMatch) {
  return {
    code,
    autoMatch,
    status: "waiting",
    players: {},
    actions: {},
    states: {},
    hostToken: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    logSerial: 0,
    logTurn: 0,
    log: [],
  };
}

function slotForToken(room, token) {
  if (!token) return null;
  const players = indexed(room.players);
  for (const [slot, player] of Object.entries(players)) {
    if (player?.token === token) return Number(slot);
  }
  return null;
}

function firstEmptySlot(room) {
  const players = indexed(room.players);
  if (!players[0]) return 0;
  if (!players[1]) return 1;
  return null;
}

function requireSlot(room, token) {
  const slot = slotForToken(room, String(token || ""));
  if (slot == null) throw new Error("PvP 방 인증 정보가 올바르지 않습니다.");
  return slot;
}

function normalizeRoomCode(value) {
  const code = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!code) throw new Error("방 코드가 비어 있습니다.");
  return code.slice(0, 24);
}

function indexed(value) {
  if (!value) return {};
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((item, index) => [index, item]).filter(([, item]) => item != null));
  }
  if (typeof value === "object") return value;
  return {};
}

function previewState(character, side) {
  if (!character) {
    return {
      side,
      id: null,
      name: "-",
      title: "캐릭터 선택",
      label: "- - 캐릭터 선택",
      hp: 0,
      max_hp: 0,
      maxHp: 0,
      mp: 0,
      max_mp: 100,
      maxMp: 100,
      atk: "-",
      defense: "-",
      spd: "-",
      stats: { atk: "-", def: "-", spd: "-" },
      baseStats: { hp: 0, atk: "-", def: "-", spd: "-" },
      status_text: "없음",
      stateText: "없음",
      defenseText: "0%",
      battleLog: [],
      passive: null,
      uniqueStatuses: [],
    };
  }
  const stats = character.stats || {};
  return {
    side,
    id: character.id,
    name: character.name || "-",
    title: character.title || "",
    label: `${character.name || "-"} - ${character.title || ""}`,
    hp: Number(stats.hp || 0),
    max_hp: Number(stats.hp || 0),
    maxHp: Number(stats.hp || 0),
    mp: 0,
    max_mp: 100,
    maxMp: 100,
    atk: stats.atk ?? "-",
    defense: stats.def ?? "-",
    spd: stats.spd ?? "-",
    stats: { atk: stats.atk ?? "-", def: stats.def ?? "-", spd: stats.spd ?? "-" },
    baseStats: stats,
    status_text: "없음",
    stateText: "없음",
    defenseText: "0%",
    battleLog: [],
    passive: character.passive,
    uniqueStatuses: character.unique_statuses || [],
  };
}

function pvpSummary(room, perspectiveSlot, fighter) {
  const summary = fighterSummary(fighter);
  if (!summary || !room.battle) return summary;
  const own = perspectiveSlot === 0 ? room.battle.player : room.battle.ai;
  summary.side = fighter === own ? "player" : "ai";
  return summary;
}

function isRandomPersonalityRequest(value) {
  if (value == null) return true;
  return ["", "0", "random"].includes(String(value).trim().toLowerCase());
}

function parseArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

module.exports = {
  GameStore,
  server,
  store,
};
