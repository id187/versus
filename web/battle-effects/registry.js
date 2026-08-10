"use strict";

(function registerCharacterBattleEffectRegistry(global) {
  const profiles = new Map();

  const registry = {
    register(characterId, profile) {
      const id = String(characterId || "").trim();
      if (!id) throw new Error("Character battle effect id is required.");
      if (!profile || typeof profile !== "object") throw new Error(`Invalid battle effect profile: ${id}`);
      profiles.set(id, Object.freeze({ ...profile }));
    },

    effectTypes() {
      const types = new Set();
      for (const profile of profiles.values()) {
        for (const type of profile.effectTypes || []) types.add(type);
      }
      return [...types];
    },

    sfxEntries() {
      const entries = {};
      for (const profile of profiles.values()) Object.assign(entries, profile.sfx || {});
      return entries;
    },

    resolve(characterId, phase, payload) {
      const profile = profiles.get(characterId);
      const resolver = profile?.[phase];
      if (typeof resolver !== "function") return undefined;
      const effect = resolver(payload);
      if (!effect || typeof effect !== "object") return effect;
      return { ...effect, characterEffectId: characterId };
    },

    resolveStatus(statusName, phase, payload) {
      for (const [characterId, profile] of profiles.entries()) {
        if (!(profile.statusEffects || []).includes(statusName)) continue;
        const resolver = profile?.[phase];
        if (typeof resolver !== "function") continue;
        const effect = resolver({ ...payload, statusName });
        if (effect === undefined) continue;
        if (!effect || typeof effect !== "object") return effect;
        return { ...effect, characterEffectId: characterId };
      }
      return undefined;
    },

    play(effect, helpers) {
      const profile = profiles.get(effect?.characterEffectId);
      return Boolean(profile?.playEffect?.(effect, helpers));
    },
  };

  global.VersusCharacterBattleEffects = Object.freeze(registry);
})(window);
