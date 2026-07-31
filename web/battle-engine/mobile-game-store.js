"use strict";

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
} = require("./engine");

const FIREBASE_ROOMS_PATH = "versusRoomsJs";
const PVP_DEFAULT_PERSONALITY_ID = "R";
const PVP_MAX_TURNS = 200;

class FirebaseClient {
  constructor(config) {
    this.databaseUrl = String(config?.databaseURL || "").replace(/\/+$/, "");
    if (!this.databaseUrl) throw new Error("Firebase databaseURL is missing.");
  }

  get(route) {
    return this.request("GET", route);
  }

  put(route, value) {
    return this.request("PUT", route, value);
  }

  patch(route, value) {
    return this.request("PATCH", route, value);
  }

  delete(route) {
    return this.request("DELETE", route);
  }

  async request(method, route, value = undefined) {
    const response = await fetch(`${this.databaseUrl}/${route}.json`, {
      method,
      headers: value === undefined ? undefined : { "content-type": "application/json; charset=utf-8" },
      body: value === undefined ? undefined : JSON.stringify(value),
    });
    if (!response.ok) throw new Error(`Firebase ${method} ${route} failed: ${response.status}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
}

class MobileGameStore {
  constructor({ characters, inscriptions, firebaseConfig = null }) {
    this.characters = characters;
    this.inscriptions = normalizeInscriptions(inscriptions);
    this.aiData = { personalities: AI_PERSONALITIES };
    this.battle = null;
    this.pendingAiAction = null;
    this.firebaseHostRooms = new Map();
    this.firebase = firebaseConfig?.databaseURL ? new FirebaseClient(firebaseConfig) : null;
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

  chooseAction(payload) {
    const battle = this.requireBattle();
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
    }
    const state = stateForBattle(battle);
    state.ok = true;
    state.aiChoiceLocked = Boolean(this.pendingAiAction && !battle.gameOver);
    state.log = battle.logs.slice();
    return state;
  }

  state() {
    if (!this.battle) return { started: false };
    const state = stateForBattle(this.battle);
    state.aiChoiceLocked = Boolean(this.pendingAiAction && !this.battle.gameOver);
    return state;
  }

  lockAiAction() {
    const battle = this.requireBattle();
    this.pendingAiAction = battle.gameOver ? null : battle.selectAiAction(battle.ai, battle.player, battle.personality);
  }

  consumeAiAction() {
    const battle = this.requireBattle();
    if (!this.pendingAiAction || !battle.isLegalChoice(battle.ai, this.pendingAiAction)) this.lockAiAction();
    const action = this.pendingAiAction;
    this.pendingAiAction = null;
    if (!action) throw new Error("AI action is not available.");
    return action;
  }

  requireBattle() {
    if (!this.battle) throw new Error("Battle has not started.");
    return this.battle;
  }

  requireFirebase() {
    if (!this.firebase) throw new Error("모바일 PvP Firebase 설정이 없습니다.");
    return this.firebase;
  }

  async pvpJoin(payload) {
    this.requireFirebase();
    const code = await this.firebaseFindOrCreateRoomCode(payload.roomCode);
    let room = (await this.firebaseGetRoom(code)) || createFirebaseRoom(code, code.startsWith("MATCH-"));
    let token = String(payload.token || "");
    let slot = slotForToken(room, token);
    const isNewPlayer = slot == null;
    if (slot == null) {
      slot = firstEmptySlot(room);
      if (slot == null) throw new Error("이미 두 명이 들어온 방입니다.");
      token = randomToken(18);
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
    state.noticeLog = [
      `PvP 방 ${code}에 입장했습니다.`,
      state.started ? (isNewPlayer ? "상대와 연결되었습니다." : "PvP 방에 재접속했습니다.") : "상대 입장을 기다리는 중입니다.",
    ];
    return state;
  }

  async pvpState(payload) {
    this.requireFirebase();
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

  async pvpChooseAction(payload) {
    this.requireFirebase();
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

  async pvpLeave(payload) {
    this.requireFirebase();
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
    const code = `MATCH-${randomHex(3)}`;
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

  firebasePutRoom(code, room) {
    return this.firebase.put(`${FIREBASE_ROOMS_PATH}/${code}`, room);
  }

  firebasePatchRoom(code, patch) {
    return this.firebase.patch(`${FIREBASE_ROOMS_PATH}/${code}`, patch);
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

  async firebasePublishHostRoom(room, status) {
    const states = { 0: this.pvpStateForSlot(room, 0, -1), 1: this.pvpStateForSlot(room, 1, -1) };
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

function createPvpRoom(code, autoMatch) {
  return { code, autoMatch, status: "waiting", players: {}, pendingActions: {}, battle: null, logSerial: 0, logTurn: 0, log: [] };
}

function createFirebaseRoom(code, autoMatch) {
  return { code, autoMatch, status: "waiting", players: {}, actions: {}, states: {}, hostToken: "", createdAt: Date.now(), updatedAt: Date.now(), logSerial: 0, logTurn: 0, log: [] };
}

function slotForToken(room, token) {
  if (!token) return null;
  for (const [slot, player] of Object.entries(indexed(room.players))) {
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
  if (Array.isArray(value)) return Object.fromEntries(value.map((item, index) => [index, item]).filter(([, item]) => item != null));
  return typeof value === "object" ? value : {};
}

function previewState(character, side) {
  if (!character) {
    return { side, id: null, name: "-", title: "캐릭터 선택", label: "- - 캐릭터 선택", hp: 0, max_hp: 0, maxHp: 0, mp: 0, max_mp: 100, maxMp: 100, atk: "-", defense: "-", spd: "-", stats: { atk: "-", def: "-", spd: "-" }, baseStats: { hp: 0, atk: "-", def: "-", spd: "-" }, status_text: "없음", stateText: "없음", defenseText: "0%", battleLog: [], passive: null, uniqueStatuses: [] };
  }
  const stats = character.stats || {};
  return { side, id: character.id, name: character.name || "-", title: character.title || "", label: `${character.name || "-"} - ${character.title || ""}`, hp: Number(stats.hp || 0), max_hp: Number(stats.hp || 0), maxHp: Number(stats.hp || 0), mp: 0, max_mp: 100, maxMp: 100, atk: stats.atk ?? "-", defense: stats.def ?? "-", spd: stats.spd ?? "-", stats: { atk: stats.atk ?? "-", def: stats.def ?? "-", spd: stats.spd ?? "-" }, baseStats: stats, status_text: "없음", stateText: "없음", defenseText: "0%", battleLog: [], passive: character.passive, uniqueStatuses: character.unique_statuses || [] };
}

function pvpSummary(room, slot, fighter) {
  const summary = fighterSummary(fighter);
  if (!summary || !room.battle) return summary;
  const own = slot === 0 ? room.battle.player : room.battle.ai;
  summary.side = fighter === own ? "player" : "ai";
  return summary;
}

function isRandomPersonalityRequest(value) {
  if (value == null) return true;
  return ["", "0", "random"].includes(String(value).trim().toLowerCase());
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(bytes);
  for (let index = 0; index < length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return bytes;
}

function randomHex(length) {
  return [...randomBytes(length)].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function randomToken(length) {
  let binary = "";
  for (const value of randomBytes(length)) binary += String.fromCharCode(value);
  const encoded = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return encoded.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

module.exports = { FirebaseClient, MobileGameStore };
