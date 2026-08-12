(function adventureAchievementsModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.VersusAdventureAchievements = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createAdventureAchievementsApi() {
  "use strict";

  const STORAGE_KEY = "versus.adventure-achievements.v1";
  const VERSION = 1;

  function emptyState() {
    return {
      version: VERSION,
      unlocked: {},
      clearedCharacterIds: [],
      mirrorClear: false,
      adventureClear: false,
      lowHpClear: false,
      reliclessClear: false,
      bestSingleAttackDamage: 0,
      bestSingleFixedDamage: 0,
      bestFinalHpPercent: 0,
      mostRelicsAtClear: 0,
    };
  }

  function normalizeState(value) {
    const source = value && typeof value === "object" ? value : {};
    const uniqueIds = [...new Set(
      Array.isArray(source.clearedCharacterIds)
        ? source.clearedCharacterIds.filter((id) => typeof id === "string" && id)
        : [],
    )];
    const unlocked = {};
    if (source.unlocked && typeof source.unlocked === "object") {
      for (const [id, timestamp] of Object.entries(source.unlocked)) {
        if (typeof id === "string" && id) unlocked[id] = String(timestamp || "");
      }
    }
    return {
      ...emptyState(),
      unlocked,
      clearedCharacterIds: uniqueIds,
      mirrorClear: Boolean(source.mirrorClear),
      adventureClear: Boolean(source.adventureClear),
      lowHpClear: Boolean(source.lowHpClear),
      reliclessClear: Boolean(source.reliclessClear),
      bestSingleAttackDamage: Math.max(0, Math.trunc(Number(source.bestSingleAttackDamage || 0))),
      bestSingleFixedDamage: Math.max(0, Math.trunc(Number(source.bestSingleFixedDamage || 0))),
      bestFinalHpPercent: Math.max(0, Math.min(100, Number(source.bestFinalHpPercent || 0))),
      mostRelicsAtClear: Math.max(0, Math.trunc(Number(source.mostRelicsAtClear || 0))),
    };
  }

  function load(storage) {
    if (!storage?.getItem) return emptyState();
    try {
      const raw = storage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : emptyState();
    } catch (_error) {
      return emptyState();
    }
  }

  function save(storage, state) {
    const normalized = normalizeState(state);
    try {
      storage?.setItem?.(STORAGE_KEY, JSON.stringify(normalized));
    } catch (_error) {
      // The current session still keeps its achievement state if storage is unavailable.
    }
    return normalized;
  }

  function metricValue(definition, state) {
    if (definition.metric === "mirror_clear") return state.mirrorClear ? 1 : 0;
    if (definition.metric === "adventure_clear") return state.adventureClear ? 1 : 0;
    if (definition.metric === "low_hp_clear") return state.lowHpClear ? 1 : 0;
    if (definition.metric === "relicless_clear") return state.reliclessClear ? 1 : 0;
    if (definition.metric === "best_single_attack_damage") return state.bestSingleAttackDamage;
    if (definition.metric === "best_single_fixed_damage") return state.bestSingleFixedDamage;
    if (definition.metric === "best_final_hp_percent") return state.bestFinalHpPercent;
    if (definition.metric === "most_relics_at_clear") return state.mostRelicsAtClear;
    if (definition.metric === "character_clear") {
      return state.clearedCharacterIds.includes(definition.characterId) ? 1 : 0;
    }
    return 0;
  }

  function syncUnlocks(definitions, state, now = new Date().toISOString()) {
    const normalized = normalizeState(state);
    for (const definition of definitions || []) {
      const target = Math.max(1, Math.trunc(Number(definition.target || 1)));
      if (metricValue(definition, normalized) >= target && !normalized.unlocked[definition.id]) {
        normalized.unlocked[definition.id] = now;
      }
    }
    return normalized;
  }

  function recordBattleState(storage, definitions, battleState) {
    let state = load(storage);
    const adventure = battleState?.adventure;
    if (!adventure) return state;

    const stats = adventure.achievementStats || {};
    state.bestSingleAttackDamage = Math.max(
      state.bestSingleAttackDamage,
      Math.max(0, Math.trunc(Number(stats.bestSingleAttackDamage || 0))),
    );
    state.bestSingleFixedDamage = Math.max(
      state.bestSingleFixedDamage,
      Math.max(0, Math.trunc(Number(stats.bestSingleFixedDamage || 0))),
    );

    const playerWon = Boolean(
      (battleState.gameOver || battleState.is_over)
      && battleState.winner?.side === battleState.player?.side,
    );
    if (playerWon && adventure.isMirrorBattle) state.mirrorClear = true;
    if (playerWon && adventure.isFinalBattle) {
      state.adventureClear = true;
      if (battleState.player?.id && !state.clearedCharacterIds.includes(battleState.player.id)) {
        state.clearedCharacterIds.push(battleState.player.id);
      }
      const hpAtVictory = Number(adventure.settlement?.hpBefore ?? battleState.player?.hp);
      if (hpAtVictory <= 10) state.lowHpClear = true;
      const maxHpAtVictory = Number(battleState.player?.max_hp ?? battleState.player?.maxHp);
      if (Number.isFinite(maxHpAtVictory) && maxHpAtVictory > 0) {
        const hpPercent = Math.floor((Math.max(0, hpAtVictory) / maxHpAtVictory) * 10000) / 100;
        state.bestFinalHpPercent = Math.max(state.bestFinalHpPercent, hpPercent);
      }
      const heldRelicCount = Array.isArray(adventure.playerRelics)
        ? adventure.playerRelics.filter((relic) => !relic?.destroyed).length
        : 0;
      state.mostRelicsAtClear = Math.max(state.mostRelicsAtClear, heldRelicCount);
      const relicsAcquired = Math.max(
        0,
        Math.trunc(Number(
          stats.relicsAcquired
          ?? (Array.isArray(adventure.playerRelics) ? adventure.playerRelics.length : 0),
        )),
      );
      if (relicsAcquired === 0) state.reliclessClear = true;
    }

    state = syncUnlocks(definitions, state);
    return save(storage, state);
  }

  function view(definitions, state) {
    const normalized = syncUnlocks(definitions, state);
    return (definitions || []).map((definition) => {
      const target = Math.max(1, Math.trunc(Number(definition.target || 1)));
      const current = metricValue(definition, normalized);
      return {
        ...definition,
        current,
        progress: Math.min(target, current),
        target,
        unlocked: Boolean(normalized.unlocked[definition.id]),
        unlockedAt: normalized.unlocked[definition.id] || null,
      };
    });
  }

  return {
    STORAGE_KEY,
    VERSION,
    emptyState,
    normalizeState,
    load,
    save,
    syncUnlocks,
    recordBattleState,
    view,
  };
}));
