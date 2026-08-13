"use strict";

(function registerJitromBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before jitrom effects.");

  const CHARACTER_ID = "jitrom";
  const SHARD_STATUS_NAME = "암편";
  const ROCK_SMASH_ACTION_NAME = "암석 부수기";
  const EARTH_SHELL_ACTION_NAME = "대지의 껍질";
  const ROCK_PALM_ACTION_NAME = "암장 짓누르기";
  const GIANT_POWER_ACTION_NAME = "거인의 힘";

  function counterChange({ targetName, targetSide, before, after, makeLogEffect }) {
    if (after <= before) return undefined;
    const effect = makeLogEffect(
      "jitrom-shard-convergence",
      targetName,
      targetName,
      `${SHARD_STATUS_NAME}+${after - before}`,
      targetSide,
      targetSide,
    );
    return effect ? { ...effect, valueKind: "stack-gain" } : null;
  }

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== EARTH_SHELL_ACTION_NAME) return undefined;
    return makeLogEffect(
      "jitrom-earth-shell",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  function statEffect({ actionName, actorName, actorSide, stat, makeLogEffect }) {
    if (actionName !== GIANT_POWER_ACTION_NAME || stat !== "atk") return undefined;
    return makeLogEffect(
      "jitrom-giant-power",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage: rawDamage, makeLogEffect }) {
    if (![ROCK_SMASH_ACTION_NAME, ROCK_PALM_ACTION_NAME].includes(actionName)) return undefined;
    const damageValue = Number(rawDamage);
    if (!(damageValue > 0)) return null;
    const type = actionName === ROCK_SMASH_ACTION_NAME
      ? "jitrom-rock-smash"
      : "jitrom-rock-palm";
    const effect = makeLogEffect(type, targetName, actorName, damageValue, targetSide, actorSide);
    return effect ? { ...effect, damageValue: true } : null;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: [SHARD_STATUS_NAME],
    effectTypes: [
      "jitrom-shard-convergence",
      "jitrom-rock-smash",
      "jitrom-earth-shell",
      "jitrom-rock-palm",
      "jitrom-giant-power",
    ],
    sfx: {
      "jitrom-shard-convergence": "/assets/sfx/buff.wav",
      "jitrom-rock-smash": "/assets/sfx/hit.wav",
      "jitrom-earth-shell": "/assets/sfx/defense.wav",
      "jitrom-rock-palm": "/assets/sfx/hit.wav",
      "jitrom-giant-power": "/assets/sfx/buff.wav",
    },
    counterChange,
    success,
    statEffect,
    damage,
  });
})(window.VersusCharacterBattleEffects);
