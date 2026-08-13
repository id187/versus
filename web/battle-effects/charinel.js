"use strict";

(function registerCharinelBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before charinel effects.");

  const CHARACTER_ID = "charinel";
  const FOCUS_STATUS_NAME = "집광";
  const FLASHING_BULLET_ACTION_NAME = "번쩍이는 흉탄";
  const BERSERK_ACTION_NAME = "광폭화";
  const LIGHT_ABSORPTION_ORB_ACTION_NAME = "흡광옥";
  const INFINITE_RADIANT_METEOR_ACTION_NAME = "무한광운성";
  const BULLET_IMPACT_DELAY_MS = 260;
  const BULLET_LIFETIME_MS = 380;
  const ORB_IMPACT_DELAY_MS = 270;
  const ORB_LIFETIME_MS = 380;
  const METEOR_IMPACT_DELAY_MS = 420;
  const METEOR_LIFETIME_MS = 640;

  function counterChange({ statusName, targetName, targetSide, before, after, makeLogEffect }) {
    if (statusName !== FOCUS_STATUS_NAME || after <= before) return undefined;
    const effect = makeLogEffect(
      "focus-gain",
      targetName,
      targetName,
      `${FOCUS_STATUS_NAME}+${after - before}`,
      targetSide,
      targetSide,
    );
    return effect ? { ...effect, valueKind: "stack-gain" } : null;
  }

  function statusDamage({ statusName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (statusName !== BERSERK_ACTION_NAME) return undefined;
    const effect = makeLogEffect(
      "berserk-sparkle-aura",
      targetName,
      actorName,
      damage,
      targetSide,
      actorSide,
    );
    return effect ? { ...effect, damageValue: damage > 0 } : null;
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (actionName === FLASHING_BULLET_ACTION_NAME) {
      const effect = makeLogEffect(
        "flashing-bullet",
        targetName,
        actorName,
        null,
        targetSide,
        actorSide,
      );
      return effect ? {
        ...effect,
        damageValue: false,
        impactDelayMs: BULLET_IMPACT_DELAY_MS,
        impactValue: damage,
        impactDamageValue: damage > 0,
      } : null;
    }
    if (actionName === LIGHT_ABSORPTION_ORB_ACTION_NAME) {
      const effect = makeLogEffect(
        "light-absorption-orb",
        targetName,
        actorName,
        null,
        targetSide,
        actorSide,
      );
      return effect ? {
        ...effect,
        damageValue: false,
        impactDelayMs: ORB_IMPACT_DELAY_MS,
        impactValue: damage,
        impactDamageValue: damage > 0,
      } : null;
    }
    if (actionName !== INFINITE_RADIANT_METEOR_ACTION_NAME) return undefined;
    const effect = makeLogEffect(
      "infinite-radiant-meteor",
      targetName,
      actorName,
      null,
      targetSide,
      actorSide,
    );
    return effect ? {
      ...effect,
      damageValue: false,
      impactDelayMs: METEOR_IMPACT_DELAY_MS,
      impactValue: damage,
      impactDamageValue: damage > 0,
    } : null;
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type === "flashing-bullet") {
      const {
        impactValue,
        impactDamageValue,
        delayMs: _delayMs,
        ...baseEffect
      } = effect;
      const sourceStage = stageForSide(effect.sourceSide);
      const targetStage = stageForSide(effect.side);

      if (arena && sourceStage && targetStage) {
        const arenaRect = arena.getBoundingClientRect();
        const sourceRect = sourceStage.getBoundingClientRect();
        const targetRect = targetStage.getBoundingClientRect();
        const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
        const sourceBodyY = registry.stagePercent(sourceStage, "--fx-body-y", 0.5);
        const sourceCenterX = sourceRect.left + sourceRect.width * 0.5 - arenaRect.left;
        const endX = targetRect.left + targetRect.width * 0.5 - arenaRect.left;
        const horizontalDirection = endX >= sourceCenterX ? 1 : -1;
        const startX = sourceCenterX;
        const startY = sourceRect.top + sourceRect.height * sourceBodyY - arenaRect.top;
        const endY = targetRect.top + targetRect.height * targetBodyY - arenaRect.top;
        const angle = Math.atan2(endY - startY, Math.abs(endX - startX)) * horizontalDirection;
        const projectile = document.createElement("span");
        projectile.className = "battle-fx-flashing-bullet-projectile";
        projectile.dataset.characterBattleEffect = CHARACTER_ID;
        projectile.dataset.sourceSide = effect.sourceSide;
        projectile.dataset.targetSide = effect.side;
        projectile.style.setProperty("--charinel-bullet-start-x", `${startX}px`);
        projectile.style.setProperty("--charinel-bullet-start-y", `${startY}px`);
        projectile.style.setProperty("--charinel-bullet-end-x", `${endX}px`);
        projectile.style.setProperty("--charinel-bullet-end-y", `${endY}px`);
        projectile.style.setProperty("--charinel-bullet-angle", `${angle}rad`);
        projectile.style.setProperty("--charinel-bullet-flip", horizontalDirection);
        const mountedProjectile = appendEffectElement(arena, projectile);
        registerTimeout(window.setTimeout(() => mountedProjectile.remove(), BULLET_LIFETIME_MS));
      }

      registerTimeout(window.setTimeout(() => playLogEffect({
        ...baseEffect,
        type: "flashing-bullet-impact",
        value: impactValue,
        damageValue: Boolean(impactDamageValue),
      }), BULLET_IMPACT_DELAY_MS));
      return true;
    }

    if (effect.type === "light-absorption-orb") {
      const {
        impactValue,
        impactDamageValue,
        delayMs: _delayMs,
        ...baseEffect
      } = effect;
      const sourceStage = stageForSide(effect.sourceSide);
      const targetStage = stageForSide(effect.side);

      if (arena && sourceStage && targetStage) {
        const arenaRect = arena.getBoundingClientRect();
        const sourceRect = sourceStage.getBoundingClientRect();
        const targetRect = targetStage.getBoundingClientRect();
        const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
        const sourceBodyY = registry.stagePercent(sourceStage, "--fx-body-y", 0.5);
        const sourceCenterX = sourceRect.left + sourceRect.width * 0.5 - arenaRect.left;
        const endX = targetRect.left + targetRect.width * 0.5 - arenaRect.left;
        const horizontalDirection = endX >= sourceCenterX ? 1 : -1;
        const startX = sourceCenterX;
        const startY = sourceRect.top + sourceRect.height * sourceBodyY - arenaRect.top;
        const endY = targetRect.top + targetRect.height * targetBodyY - arenaRect.top;
        const angle = Math.atan2(endY - startY, Math.abs(endX - startX)) * horizontalDirection;
        const projectile = document.createElement("span");
        projectile.className = "battle-fx-light-absorption-orb-projectile";
        projectile.dataset.characterBattleEffect = CHARACTER_ID;
        projectile.dataset.sourceSide = effect.sourceSide;
        projectile.dataset.targetSide = effect.side;
        projectile.style.setProperty("--charinel-orb-start-x", `${startX}px`);
        projectile.style.setProperty("--charinel-orb-start-y", `${startY}px`);
        projectile.style.setProperty("--charinel-orb-end-x", `${endX}px`);
        projectile.style.setProperty("--charinel-orb-end-y", `${endY}px`);
        projectile.style.setProperty("--charinel-orb-angle", `${angle}rad`);
        projectile.style.setProperty("--charinel-orb-flip", horizontalDirection);
        const mountedProjectile = appendEffectElement(arena, projectile);
        registerTimeout(window.setTimeout(() => mountedProjectile.remove(), ORB_LIFETIME_MS));
      }

      registerTimeout(window.setTimeout(() => playLogEffect({
        ...baseEffect,
        type: "light-absorption-vortex",
        value: impactValue,
        damageValue: Boolean(impactDamageValue),
      }), ORB_IMPACT_DELAY_MS));
      return true;
    }

    if (effect.type !== "infinite-radiant-meteor") return false;

    const {
      impactValue,
      impactDamageValue,
      delayMs: _delayMs,
      ...baseEffect
    } = effect;
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);

    if (arena && targetStage) {
      const arenaRect = arena.getBoundingClientRect();
      const targetRect = targetStage.getBoundingClientRect();
      const sourceRect = sourceStage?.getBoundingClientRect?.();
      const targetGroundY = registry.stagePercent(targetStage, "--fx-ground-y", 0.96);
      const targetCenterX = targetRect.left + targetRect.width / 2 - arenaRect.left;
      const meteorSize = Math.max(280, Math.min(390, targetRect.width * 1.65));
      const targetGroundPointY = targetRect.top + targetRect.height * targetGroundY - arenaRect.top;
      const targetCenterY = targetGroundPointY - meteorSize * 0.46;
      const sourceCenterX = sourceRect
        ? sourceRect.left + sourceRect.width / 2 - arenaRect.left
        : targetCenterX - 1;
      const horizontalDirection = targetCenterX >= sourceCenterX ? 1 : -1;
      const startOffsetX = -horizontalDirection * Math.max(54, targetRect.width * 0.38);
      const startOffsetY = -Math.max(340, Math.min(500, arenaRect.height * 0.82));
      const meteor = document.createElement("span");
      meteor.className = "battle-fx-infinite-radiant-meteor-projectile";
      meteor.dataset.characterBattleEffect = CHARACTER_ID;
      meteor.dataset.sourceSide = effect.sourceSide;
      meteor.dataset.targetSide = effect.side;
      meteor.style.setProperty("--charinel-meteor-end-x", `${targetCenterX}px`);
      meteor.style.setProperty("--charinel-meteor-end-y", `${targetCenterY}px`);
      meteor.style.setProperty("--charinel-meteor-start-x", `${startOffsetX}px`);
      meteor.style.setProperty("--charinel-meteor-start-y", `${startOffsetY}px`);
      meteor.style.setProperty("--charinel-meteor-size", `${meteorSize}px`);
      meteor.style.setProperty("--charinel-meteor-flip", horizontalDirection);
      const mountedMeteor = appendEffectElement(arena, meteor);
      registerTimeout(window.setTimeout(() => mountedMeteor.remove(), METEOR_LIFETIME_MS));
    }

    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type: "infinite-radiant-impact",
      value: impactValue,
      damageValue: Boolean(impactDamageValue),
    }), METEOR_IMPACT_DELAY_MS));
    return true;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: [FOCUS_STATUS_NAME, BERSERK_ACTION_NAME],
    effectTypes: [
      "focus-gain",
      "flashing-bullet",
      "flashing-bullet-impact",
      "berserk-sparkle-aura",
      "light-absorption-orb",
      "light-absorption-vortex",
      "infinite-radiant-meteor",
      "infinite-radiant-impact",
    ],
    sfx: {
      "focus-gain": "/assets/sfx/buff.wav",
      "flashing-bullet-impact": "/assets/sfx/hit.wav",
      "berserk-sparkle-aura": "/assets/sfx/buff.wav",
      "light-absorption-vortex": "/assets/sfx/hit.wav",
      "infinite-radiant-impact": "/assets/sfx/hit.wav",
    },
    counterChange,
    statusDamage,
    damage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
