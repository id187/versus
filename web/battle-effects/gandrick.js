"use strict";

(function registerGandrickBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before gandrick effects.");

  const CHARACTER_ID = "gandrick";
  const PRECISE_SHOT_ACTION_NAME = "정밀 사격";
  const RELOAD_ACTION_NAME = "재장전";
  const MAGIC_MARKSMAN_ACTION_NAME = "마탄의 사수";
  const GRAND_FINALE_ACTION_NAME = "화려한 마무리";
  const PRECISE_SHOT_IMPACT_DELAY_MS = 340;
  const MAGIC_MARKSMAN_IMPACT_DELAY_MS = 105;
  const MAGIC_MARKSMAN_FLIGHT_MS = 200;
  const GRAND_FINALE_BURST_MS = 620;

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (actionName === GRAND_FINALE_ACTION_NAME) {
      const effect = makeLogEffect(
        "grand-finale-impact",
        targetName,
        actorName,
        damage,
        targetSide,
        actorSide,
      );
      return effect ? { ...effect, damageValue: damage > 0 } : null;
    }
    if (![PRECISE_SHOT_ACTION_NAME, MAGIC_MARKSMAN_ACTION_NAME].includes(actionName)) return undefined;
    const isMagicMarksman = actionName === MAGIC_MARKSMAN_ACTION_NAME;
    const effect = makeLogEffect(
      isMagicMarksman ? "magic-marksman-shot" : "precise-shot",
      targetName,
      actorName,
      null,
      targetSide,
      actorSide,
    );
    return effect ? {
      ...effect,
      damageValue: false,
      impactDelayMs: isMagicMarksman ? MAGIC_MARKSMAN_IMPACT_DELAY_MS : PRECISE_SHOT_IMPACT_DELAY_MS,
      impactValue: damage,
      impactDamageValue: damage > 0,
    } : null;
  }

  function counterChange({ statusName, actionName, targetName, targetSide, before, after, makeLogEffect }) {
    if (statusName !== "탄환") return undefined;
    if (after < before) {
      const effect = makeLogEffect(
        "bullet-spend-cylinder",
        targetName,
        targetName,
        `탄환-${before - after}`,
        targetSide,
        targetSide,
      );
      return effect ? { ...effect, valueKind: "stack-spend" } : null;
    }
    if (actionName !== RELOAD_ACTION_NAME) return undefined;
    const effect = makeLogEffect(
      "reload-cylinder",
      targetName,
      targetName,
      after > before ? `탄환+${after - before}` : null,
      targetSide,
      targetSide,
    );
    return effect ? { ...effect, valueKind: "stack-gain" } : null;
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type === "grand-finale-impact") {
      const targetStage = stageForSide(effect.side);
      if (!targetStage) return false;
      const horizontalDirection = effect.sourceSide === "ai" ? -1 : 1;
      const originalX = randomBetween(33, 67);
      const originalRotation = randomBetween(-32, 32);
      const burst = document.createElement("span");
      burst.className = "battle-fx-grand-finale-burst";
      burst.dataset.characterBattleEffect = CHARACTER_ID;
      burst.style.setProperty(
        "--grand-finale-x",
        `${(horizontalDirection > 0 ? originalX : 100 - originalX).toFixed(2)}%`,
      );
      burst.style.setProperty("--grand-finale-y", `${randomBetween(28, 66).toFixed(2)}%`);
      burst.style.setProperty("--grand-finale-size", `${randomBetween(44, 60).toFixed(2)}%`);
      burst.style.setProperty(
        "--grand-finale-rotation",
        `${(originalRotation * horizontalDirection).toFixed(2)}deg`,
      );
      burst.style.setProperty("--grand-finale-flip", horizontalDirection);
      const mountedBurst = appendEffectElement(targetStage, burst);
      registerTimeout(window.setTimeout(() => mountedBurst.remove(), GRAND_FINALE_BURST_MS));
      return false;
    }

    const isPreciseShot = effect.type === "precise-shot";
    const isMagicMarksman = effect.type === "magic-marksman-shot";
    if (!isPreciseShot && !isMagicMarksman) return false;
    const {
      impactValue,
      impactDamageValue,
      delayMs: _delayMs,
      ...baseEffect
    } = effect;

    if (isMagicMarksman) {
      const sourceStage = stageForSide(effect.sourceSide);
      const targetStage = stageForSide(effect.side);
      if (arena && sourceStage && targetStage) {
        const arenaRect = arena.getBoundingClientRect();
        const sourceRect = sourceStage.getBoundingClientRect();
        const targetRect = targetStage.getBoundingClientRect();
        const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
        const sourceBodyY = registry.stagePercent(sourceStage, "--fx-body-y", 0.5);
        const sourceCenterX = sourceRect.left + sourceRect.width / 2 - arenaRect.left;
        const targetCenterX = targetRect.left + targetRect.width / 2 - arenaRect.left;
        const horizontalDirection = targetCenterX >= sourceCenterX ? 1 : -1;
        const startX = sourceCenterX;
        const startY = sourceRect.top + sourceRect.height * sourceBodyY - arenaRect.top;
        const targetX = targetCenterX;
        const targetY = targetRect.top + targetRect.height * targetBodyY - arenaRect.top;
        const overshoot = Math.max(30, targetRect.width * 0.28);
        const endX = targetX + horizontalDirection * overshoot;
        const endY = targetY + (targetY - startY) * (overshoot / Math.max(1, Math.abs(targetX - startX)));
        const pathLength = Math.hypot(endX - startX, endY - startY);
        const angle = Math.atan2(endY - startY, Math.abs(endX - startX)) * horizontalDirection;

        const tracer = document.createElement("span");
        tracer.className = "battle-fx-magic-marksman-tracer";
        tracer.dataset.characterBattleEffect = CHARACTER_ID;
        tracer.dataset.sourceSide = effect.sourceSide;
        tracer.dataset.targetSide = effect.side;
        tracer.style.setProperty("--magic-marksman-center-x", `${(startX + endX) / 2}px`);
        tracer.style.setProperty("--magic-marksman-center-y", `${(startY + endY) / 2}px`);
        tracer.style.setProperty("--magic-marksman-path-length", `${pathLength}px`);
        tracer.style.setProperty("--magic-marksman-angle", `${angle}rad`);
        tracer.style.setProperty("--magic-marksman-flip", horizontalDirection);
        const mountedTracer = appendEffectElement(arena, tracer);
        registerTimeout(window.setTimeout(() => mountedTracer.remove(), MAGIC_MARKSMAN_FLIGHT_MS));
      }

      registerTimeout(window.setTimeout(() => playLogEffect({
        ...baseEffect,
        type: "magic-marksman-impact",
        value: impactValue,
        damageValue: Boolean(impactDamageValue),
      }), MAGIC_MARKSMAN_IMPACT_DELAY_MS));
      return true;
    }

    playLogEffect({
      ...baseEffect,
      type: "precise-shot-reticle",
      value: null,
      damageValue: false,
    });
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type: "precise-shot-burst",
      value: impactValue,
      damageValue: Boolean(impactDamageValue),
    }), PRECISE_SHOT_IMPACT_DELAY_MS));
    return true;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: ["탄환"],
    effectTypes: [
      "precise-shot",
      "precise-shot-reticle",
      "precise-shot-burst",
      "bullet-spend-cylinder",
      "reload-cylinder",
      "magic-marksman-shot",
      "magic-marksman-impact",
      "grand-finale-impact",
    ],
    sfx: {
      "precise-shot-burst": "/assets/sfx/hit.wav",
      "bullet-spend-cylinder": "/assets/sfx/stack-spend.wav",
      "reload-cylinder": "/assets/sfx/buff.wav",
      "magic-marksman-impact": "/assets/sfx/hit.wav",
      "grand-finale-impact": "/assets/sfx/hit.wav",
    },
    damage,
    counterChange,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
