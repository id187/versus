"use strict";

(function installAdventureSave(root) {
  const STORAGE_KEY = "versus.adventure.save.v5";
  const LEGACY_STORAGE_KEYS = Object.freeze(["versus.adventure.save.v1", "versus.adventure.save.v2", "versus.adventure.save.v3", "versus.adventure.save.v4"]);
  const SAVE_VERSION = 5;
  const MAX_COMMANDS = 5000;

  function normalizeAdventureSave(value) {
    if (!value || typeof value !== "object") throw new Error("저장된 Adventure 데이터가 올바르지 않습니다.");
    if (Number(value.version) !== SAVE_VERSION) throw new Error("지원하지 않는 Adventure 저장 버전입니다.");
    const start = normalizeStart(value.start);
    const sourceCommands = Array.isArray(value.commands) ? value.commands : [];
    if (sourceCommands.length > MAX_COMMANDS) throw new Error("Adventure 저장 기록이 너무 깁니다.");
    return {
      version: SAVE_VERSION,
      start,
      commands: sourceCommands.map(normalizeCommand),
      savedAt: finiteTimestamp(value.savedAt),
    };
  }

  function createAdventureSave(start, savedAt = Date.now()) {
    return {
      version: SAVE_VERSION,
      start: normalizeStart(start),
      commands: [],
      savedAt: finiteTimestamp(savedAt),
    };
  }

  function appendAdventureCommand(save, type, payload, savedAt = Date.now()) {
    const normalized = normalizeAdventureSave(save);
    if (normalized.commands.length >= MAX_COMMANDS) throw new Error("Adventure 저장 기록이 너무 깁니다.");
    normalized.commands.push(normalizeCommand({ type, ...(payload || {}) }));
    normalized.savedAt = finiteTimestamp(savedAt);
    return normalized;
  }

  function loadAdventureSave(storage) {
    if (!storage) return null;
    try {
      for (const key of LEGACY_STORAGE_KEYS) storage.removeItem(key);
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalizeAdventureSave(JSON.parse(raw));
    } catch {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        // A broken or unavailable storage must not prevent the game from opening.
      }
      return null;
    }
  }

  function storeAdventureSave(storage, save) {
    if (!storage) return false;
    try {
      for (const key of LEGACY_STORAGE_KEYS) storage.removeItem(key);
      storage.setItem(STORAGE_KEY, JSON.stringify(normalizeAdventureSave(save)));
      return true;
    } catch {
      return false;
    }
  }

  function clearAdventureSave(storage) {
    if (!storage) return false;
    try {
      storage.removeItem(STORAGE_KEY);
      for (const key of LEGACY_STORAGE_KEYS) storage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  function isAdventureTerminal(adventure) {
    return ["defeat", "complete"].includes(String(adventure?.phase || ""));
  }

  function normalizeStart(value) {
    if (!value || typeof value !== "object") throw new Error("Adventure 시작 정보가 없습니다.");
    const seed = String(value.seed || "").trim();
    if (!seed || seed.length > 200) throw new Error("Adventure 저장 seed가 올바르지 않습니다.");
    return {
      playerIndex: normalizeSelection(value.playerIndex, "random"),
      playerInscriptionId: normalizeSelection(value.playerInscriptionId, "gray"),
      seed,
    };
  }

  function normalizeCommand(value) {
    if (!value || typeof value !== "object") throw new Error("Adventure 저장 명령이 올바르지 않습니다.");
    const type = String(value.type || "");
    if (type === "action") {
      const action = typeof value.action === "number" ? value.action : String(value.action || "");
      if (action === "") throw new Error("Adventure 행동 기록이 비어 있습니다.");
      return { type, action };
    }
    if (type === "choice") {
      const choiceId = String(value.choiceId || "").trim();
      if (!choiceId || choiceId.length > 200) throw new Error("Adventure 선택 기록이 올바르지 않습니다.");
      return { type, choiceId };
    }
    throw new Error("알 수 없는 Adventure 저장 명령입니다.");
  }

  function normalizeSelection(value, fallback) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const text = String(value ?? fallback).trim();
    return text || fallback;
  }

  function finiteTimestamp(value) {
    const timestamp = Number(value);
    return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : Date.now();
  }

  const api = {
    STORAGE_KEY,
    SAVE_VERSION,
    appendAdventureCommand,
    clearAdventureSave,
    createAdventureSave,
    isAdventureTerminal,
    loadAdventureSave,
    normalizeAdventureSave,
    storeAdventureSave,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.VersusAdventureSave = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
