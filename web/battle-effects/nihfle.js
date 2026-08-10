"use strict";

(function registerNihfleBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before nihfle effects.");

  const CHARACTER_ID = "nihfle";
  const FROST_STAB_ACTION_NAME = "냉기 찌르기";
  const REFREEZE_ACTION_NAME = "재동결";
  const GLACIER_BREAKER_ACTION_NAME = "빙하 파괴자";
  const ABSOLUTE_ZERO_ACTION_NAME = "절대영도";
  const ATTACK_EFFECT_TYPES = Object.freeze({
    [FROST_STAB_ACTION_NAME]: "frost-stab",
    [REFREEZE_ACTION_NAME]: "refreeze-star",
    [GLACIER_BREAKER_ACTION_NAME]: "glacier-breaker",
  });

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== ABSOLUTE_ZERO_ACTION_NAME) return undefined;
    return makeLogEffect("absolute-zero", actorName, actorName, null, actorSide, actorSide);
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    const type = ATTACK_EFFECT_TYPES[actionName];
    if (!type) return undefined;
    const effect = makeLogEffect(type, targetName, actorName, damage, targetSide, actorSide);
    return effect ? { ...effect, damageValue: damage > 0 } : null;
  }

  function statusFailure({ statusName, targetName, targetSide, makeLogEffect }) {
    if (statusName !== "빙결") return undefined;
    return makeLogEffect("freeze-failure", targetName, targetName, null, targetSide, targetSide);
  }

  registry.register(CHARACTER_ID, {
    statusEffects: ["빙결"],
    effectTypes: [
      "freeze-failure",
      "frost-stab",
      "refreeze-star",
      "glacier-breaker",
      "absolute-zero",
    ],
    sfx: {
      "freeze-failure": "/assets/sfx/debuff.wav",
      "frost-stab": "/assets/sfx/hit.wav",
      "refreeze-star": "/assets/sfx/hit.wav",
      "glacier-breaker": "/assets/sfx/hit.wav",
      "absolute-zero": "/assets/sfx/defense.wav",
    },
    success,
    damage,
    statusFailure,
  });
})(window.VersusCharacterBattleEffects);
