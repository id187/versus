"use strict";

(function registerToxicheBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before toxiche effects.");

  const CHARACTER_ID = "toxiche";
  const NEUROTOXIN_LIGHTNING_ACTION_NAME = "신경독뢰";
  const NERVE_SHEDDING_ACTION_NAME = "신려탈피";
  const VENOM_FANG_ACTION_NAME = "신사지교";
  const SWIFT_THUNDER_ACTION_NAME = "신속만뢰";

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    const effectType = actionName === NEUROTOXIN_LIGHTNING_ACTION_NAME
      ? "neurotoxin-lightning"
      : actionName === VENOM_FANG_ACTION_NAME
        ? "venom-fang-bite"
        : actionName === SWIFT_THUNDER_ACTION_NAME
          ? "swift-thunder-combo"
        : null;
    if (!effectType) return undefined;
    const effect = makeLogEffect(
      effectType,
      targetName,
      actorName,
      damage,
      targetSide,
      actorSide,
    );
    return effect ? {
      ...effect,
      damageValue: damage > 0,
      ...(actionName === SWIFT_THUNDER_ACTION_NAME ? {
        impactDelayMs: 250,
        spriteState: "attack",
        spriteSide: actorSide,
        spriteHoldMs: 1000,
      } : {}),
    } : null;
  }

  function statEffect({ actionName, actorName, actorSide, targetName, targetSide, stat, makeLogEffect }) {
    if (actionName !== NERVE_SHEDDING_ACTION_NAME || stat !== "atk") return undefined;
    return makeLogEffect(
      "nerve-shedding-husk",
      targetName || actorName,
      actorName,
      null,
      targetSide || actorSide,
      actorSide,
    );
  }

  function statusFailure({ statusName, targetName, targetSide, makeLogEffect }) {
    if (statusName !== "마비") return undefined;
    return makeLogEffect(
      "paralysis-crackle",
      targetName,
      targetName,
      null,
      targetSide,
      targetSide,
    );
  }

  function playEffect(effect, { stageForSide, registerTimeout, playLogEffect }) {
    if (effect.type !== "swift-thunder-combo") return false;
    const actorStage = stageForSide(effect.sourceSide);
    if (!actorStage) return true;

    const dashClass = "is-fx-swift-thunder-dash";
    actorStage.classList.remove(dashClass);
    void actorStage.offsetWidth;
    actorStage.classList.add(dashClass);
    registerTimeout(window.setTimeout(() => actorStage.classList.remove(dashClass), 920));

    const {
      spriteState: _spriteState,
      spriteSide: _spriteSide,
      spriteHoldMs: _spriteHoldMs,
      ...impactEffect
    } = effect;
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...impactEffect,
      type: "swift-thunder-daggers",
    }), 250));
    return true;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: ["마비"],
    effectTypes: [
      "neurotoxin-lightning",
      "nerve-shedding-husk",
      "venom-fang-bite",
      "swift-thunder-combo",
      "swift-thunder-daggers",
      "paralysis-crackle",
    ],
    sfx: {
      "neurotoxin-lightning": "/assets/sfx/hit.wav",
      "nerve-shedding-husk": "/assets/sfx/buff.wav",
      "venom-fang-bite": "/assets/sfx/hit.wav",
      "swift-thunder-daggers": "/assets/sfx/hit.wav",
      "paralysis-crackle": "/assets/sfx/debuff.wav",
    },
    damage,
    statEffect,
    statusFailure,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
