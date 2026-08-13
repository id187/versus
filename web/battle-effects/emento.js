"use strict";

(function registerEmentoBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before emento effects.");

  const CHARACTER_ID = "emento";
  const FORGET_STATUS_NAME = "망각";
  const DAYDREAM_ACTION_NAME = "백일몽";
  const PROPHETIC_DREAM_ACTION_NAME = "예지몽";
  const BUTTERFLY_DREAM_ACTION_NAME = "호접몽";
  const DREAM_WITHIN_DREAM_ACTION_NAME = "몽중몽설";
  const DAYDREAM_IMPACT_DELAY_MS = 280;
  const DAYDREAM_PROJECTILE_LIFETIME_MS = 360;
  const BUTTERFLY_IMPACT_DELAY_MS = 390;
  const BUTTERFLY_LIFETIME_MS = 560;

  function statusApplied({
    statusName,
    actorName,
    actorSide,
    targetName,
    targetSide,
    makeLogEffect,
  }) {
    if (statusName !== FORGET_STATUS_NAME) return undefined;
    return makeLogEffect(
      "forget-smoke",
      targetName,
      actorName,
      null,
      targetSide,
      actorSide,
    );
  }

  function log({ actionName, line, actorName, actorSide, makeLogEffect }) {
    if (
      actionName !== PROPHETIC_DREAM_ACTION_NAME
      || !line.includes("턴 동안 예지몽을 꾼다.")
    ) return undefined;
    return makeLogEffect(
      "prophetic-rune-ring",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (![DAYDREAM_ACTION_NAME, BUTTERFLY_DREAM_ACTION_NAME, DREAM_WITHIN_DREAM_ACTION_NAME].includes(actionName)) {
      return undefined;
    }
    if (!(damage > 0)) return null;

    if (actionName === DREAM_WITHIN_DREAM_ACTION_NAME) {
      const effect = makeLogEffect(
        "dream-rune-burst",
        targetName,
        actorName,
        damage,
        targetSide,
        actorSide,
      );
      return effect ? { ...effect, damageValue: true } : null;
    }

    const isDaydream = actionName === DAYDREAM_ACTION_NAME;
    const effect = makeLogEffect(
      isDaydream ? "daydream-orb-flight" : "butterfly-dream-flight",
      targetName,
      actorName,
      null,
      targetSide,
      actorSide,
    );
    return effect ? {
      ...effect,
      damageValue: false,
      impactDelayMs: isDaydream ? DAYDREAM_IMPACT_DELAY_MS : BUTTERFLY_IMPACT_DELAY_MS,
      impactValue: damage,
      impactDamageValue: true,
    } : null;
  }

  function flightGeometry(registryApi, arena, sourceStage, targetStage) {
    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const sourceCenterX = sourceRect.left + sourceRect.width * 0.5 - arenaRect.left;
    const targetCenterX = targetRect.left + targetRect.width * 0.5 - arenaRect.left;
    const direction = targetCenterX >= sourceCenterX ? 1 : -1;
    const sourceBodyY = registryApi.stagePercent(sourceStage, "--fx-body-y", 0.5);
    const targetBodyY = registryApi.stagePercent(targetStage, "--fx-body-y", 0.5);
    return {
      direction,
      startX: sourceCenterX,
      startY: sourceRect.top + sourceRect.height * sourceBodyY - arenaRect.top,
      endX: targetCenterX,
      endY: targetRect.top + targetRect.height * targetBodyY - arenaRect.top,
    };
  }

  function playDaydream(effect, helpers) {
    const {
      arena,
      stageForSide,
      appendEffectElement,
      registerTimeout,
      playLogEffect,
    } = helpers;
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);

    if (arena && sourceStage && targetStage) {
      const geometry = flightGeometry(registry, arena, sourceStage, targetStage);
      const angle = Math.atan2(
        geometry.endY - geometry.startY,
        Math.abs(geometry.endX - geometry.startX),
      ) * geometry.direction;
      const projectile = document.createElement("span");
      projectile.className = "battle-fx-daydream-orb-projectile";
      projectile.dataset.characterBattleEffect = CHARACTER_ID;
      projectile.dataset.sourceSide = effect.sourceSide;
      projectile.dataset.targetSide = effect.side;
      projectile.style.setProperty("--emento-daydream-start-x", `${geometry.startX}px`);
      projectile.style.setProperty("--emento-daydream-start-y", `${geometry.startY}px`);
      projectile.style.setProperty("--emento-daydream-end-x", `${geometry.endX}px`);
      projectile.style.setProperty("--emento-daydream-end-y", `${geometry.endY}px`);
      projectile.style.setProperty("--emento-daydream-angle", `${angle}rad`);
      projectile.style.setProperty("--emento-daydream-flip", geometry.direction);
      const mountedProjectile = appendEffectElement(arena, projectile);
      registerTimeout(window.setTimeout(() => mountedProjectile.remove(), DAYDREAM_PROJECTILE_LIFETIME_MS));
    }

    const { impactValue, impactDamageValue, ...baseEffect } = effect;
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type: "daydream-impact",
      value: impactValue,
      damageValue: Boolean(impactDamageValue),
    }), DAYDREAM_IMPACT_DELAY_MS));
    return true;
  }

  function playButterflies(effect, helpers) {
    const {
      arena,
      stageForSide,
      appendEffectElement,
      registerTimeout,
      playLogEffect,
    } = helpers;
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);

    if (arena && sourceStage && targetStage) {
      const geometry = flightGeometry(registry, arena, sourceStage, targetStage);
      const variants = [
        { scale: 1, delay: 0, duration: 370, start: [0, 0], end: [0, -12], tilt: [-8, 8] },
        { scale: 0.74, delay: 35, duration: 350, start: [-8, -30], end: [-18, -42], tilt: [10, -7] },
        { scale: 0.58, delay: 70, duration: 330, start: [12, 26], end: [20, 36], tilt: [-12, 5] },
        { scale: 0.86, delay: 95, duration: 360, start: [6, 46], end: [12, 54], tilt: [6, -10] },
        { scale: 0.48, delay: 130, duration: 300, start: [-14, -55], end: [-26, -66], tilt: [-6, 12] },
        { scale: 0.64, delay: 155, duration: 315, start: [18, -18], end: [30, -24], tilt: [12, -5] },
      ];

      for (const variant of variants) {
        const butterfly = document.createElement("span");
        butterfly.className = "battle-fx-butterfly-dream-projectile";
        butterfly.dataset.characterBattleEffect = CHARACTER_ID;
        butterfly.dataset.sourceSide = effect.sourceSide;
        butterfly.dataset.targetSide = effect.side;
        butterfly.style.setProperty("--emento-butterfly-start-x", `${geometry.startX + variant.start[0]}px`);
        butterfly.style.setProperty("--emento-butterfly-start-y", `${geometry.startY + variant.start[1]}px`);
        butterfly.style.setProperty("--emento-butterfly-end-x", `${geometry.endX + variant.end[0]}px`);
        butterfly.style.setProperty("--emento-butterfly-end-y", `${geometry.endY + variant.end[1]}px`);
        butterfly.style.setProperty("--emento-butterfly-scale", variant.scale);
        butterfly.style.setProperty("--emento-butterfly-start-scale", variant.scale * 0.72);
        butterfly.style.setProperty("--emento-butterfly-delay", `${variant.delay}ms`);
        butterfly.style.setProperty("--emento-butterfly-duration", `${variant.duration}ms`);
        butterfly.style.setProperty("--emento-butterfly-flip", geometry.direction);
        butterfly.style.setProperty("--emento-butterfly-tilt-start", `${variant.tilt[0]}deg`);
        butterfly.style.setProperty("--emento-butterfly-tilt-end", `${variant.tilt[1]}deg`);
        const mountedButterfly = appendEffectElement(arena, butterfly);
        registerTimeout(window.setTimeout(() => mountedButterfly.remove(), BUTTERFLY_LIFETIME_MS));
      }
    }

    const { impactValue, impactDamageValue, ...baseEffect } = effect;
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type: "butterfly-dream-impact",
      value: impactValue,
      damageValue: Boolean(impactDamageValue),
    }), BUTTERFLY_IMPACT_DELAY_MS));
    return true;
  }

  function playEffect(effect, helpers) {
    if (effect.type === "daydream-orb-flight") return playDaydream(effect, helpers);
    if (effect.type === "butterfly-dream-flight") return playButterflies(effect, helpers);
    return false;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: [FORGET_STATUS_NAME],
    effectTypes: [
      "forget-smoke",
      "daydream-orb-flight",
      "daydream-impact",
      "prophetic-rune-ring",
      "butterfly-dream-flight",
      "butterfly-dream-impact",
      "dream-rune-burst",
    ],
    sfx: {
      "forget-smoke": "/assets/sfx/debuff.wav",
      "daydream-impact": "/assets/sfx/hit.wav",
      "prophetic-rune-ring": "/assets/sfx/buff.wav",
      "butterfly-dream-impact": "/assets/sfx/hit.wav",
      "dream-rune-burst": "/assets/sfx/hit.wav",
    },
    statusApplied,
    log,
    damage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
