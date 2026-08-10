"use strict";

(function registerDemonScoutKainBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before Kain effects.");

  const CHARACTER_ID = "demon_scout_kain";
  const ATTACK_ACTION_NAME = "무영의 암습";
  const UTILITY_ACTION_NAME = "칠흑의 잠행";

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (actionName !== ATTACK_ACTION_NAME) return undefined;
    if (!(damage > 0)) return null;
    const effect = makeLogEffect("kain-shadow-ambush", targetName, actorName, damage, targetSide, actorSide);
    return effect ? { ...effect, damageValue: true } : null;
  }

  function log({ actionName, actorName, actorSide, line, makeLogEffect }) {
    if (actionName !== UTILITY_ACTION_NAME || !line.includes("회피율") || !line.includes("증가")) return undefined;
    return makeLogEffect("kain-shadow-stealth", actorName, actorName, null, actorSide, actorSide);
  }

  registry.register(CHARACTER_ID, {
    effectTypes: ["kain-shadow-ambush", "kain-shadow-stealth"],
    sfx: {
      "kain-shadow-ambush": "/assets/sfx/hit.wav",
      "kain-shadow-stealth": "/assets/sfx/buff.wav",
    },
    damage,
    log,
  });
})(window.VersusCharacterBattleEffects);
