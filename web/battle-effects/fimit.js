"use strict";

(function registerFimitBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before fimit effects.");

  const CHARACTER_ID = "fimit";
  const FATE_THROW_ACTION_NAME = "운명 투척";
  const COUNTERFEIT_WARD_ACTION_NAME = "위작 보호";
  const SIMPLE_TRICK_ACTION_NAME = "간단한 속임수";
  const TRUE_COPY_ACTION_NAME = "진짜보다 진짜같이";
  const IMITATION_STATUS_NAME = "모조";
  const FATE_IMPACT_DELAY_MS = 620;
  const FATE_CAST_LIFETIME_MS = 700;
  const FATE_BURST_LIFETIME_MS = 560;
  const TRUE_COPY_LIFETIME_MS = 920;

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage: rawDamage, makeLogEffect }) {
    const damageValue = Number(rawDamage);
    if (![FATE_THROW_ACTION_NAME, SIMPLE_TRICK_ACTION_NAME].includes(actionName)) return undefined;
    if (!(damageValue > 0)) return null;

    if (actionName === FATE_THROW_ACTION_NAME) {
      const effect = makeLogEffect(
        "fimit-fate-cards-cast",
        targetName,
        actorName,
        null,
        targetSide,
        actorSide,
      );
      return effect ? {
        ...effect,
        damageValue: false,
        impactDelayMs: FATE_IMPACT_DELAY_MS,
        impactValue: damageValue,
        impactDamageValue: true,
      } : null;
    }

    const effect = makeLogEffect(
      "fimit-simple-trick-uppercut",
      targetName,
      actorName,
      damageValue,
      targetSide,
      actorSide,
    );
    return effect ? { ...effect, damageValue: true } : null;
  }

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== COUNTERFEIT_WARD_ACTION_NAME) return undefined;
    return makeLogEffect(
      "fimit-counterfeit-ward",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  function counterChange({ statusName, targetName, targetSide, before, after, makeLogEffect }) {
    if (statusName !== IMITATION_STATUS_NAME || !(after > before)) return undefined;
    return makeLogEffect(
      "fimit-imitation-mask",
      targetName,
      targetName,
      null,
      targetSide,
      targetSide,
    );
  }

  function log({ line, actionName, actorName, actorSide, makeLogEffect, oppositeSide }) {
    if (actionName !== TRUE_COPY_ACTION_NAME || !String(line || "").endsWith("처럼 움직인다.")) return undefined;
    const effect = makeLogEffect(
      "fimit-true-copy",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
    return effect ? { ...effect, copySourceSide: oppositeSide(actorSide) } : null;
  }

  function mountFateCards(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);
    if (!arena || !sourceStage || !targetStage) return;
    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const sourceBodyY = registry.stagePercent(sourceStage, "--fx-body-y", 0.5);
    const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
    const startX = sourceRect.left + sourceRect.width * 0.52 - arenaRect.left;
    const startY = sourceRect.top + sourceRect.height * sourceBodyY - arenaRect.top;
    const endX = targetRect.left + targetRect.width * 0.5 - arenaRect.left;
    const endY = targetRect.top + targetRect.height * targetBodyY - arenaRect.top;
    const direction = endX >= startX ? 1 : -1;

    const cards = document.createElement("span");
    cards.className = "battle-fx-fimit-fate-cards";
    cards.dataset.characterBattleEffect = CHARACTER_ID;
    cards.dataset.sourceSide = effect.sourceSide;
    cards.dataset.targetSide = effect.side;
    cards.style.setProperty("--fimit-fate-start-x", `${startX}px`);
    cards.style.setProperty("--fimit-fate-start-y", `${startY}px`);
    cards.style.setProperty("--fimit-fate-end-x", `${endX}px`);
    cards.style.setProperty("--fimit-fate-end-y", `${endY}px`);
    cards.style.setProperty("--fimit-fate-direction", direction);
    const mountedCards = appendEffectElement(arena, cards);
    registerTimeout(window.setTimeout(() => mountedCards.remove(), FATE_CAST_LIFETIME_MS));
  }

  function mountFateBurst(effect, stageForSide, appendEffectElement, registerTimeout, lane) {
    const targetStage = stageForSide(effect.side);
    if (!targetStage) return;
    const burst = document.createElement("span");
    burst.className = "battle-fx-fimit-fate-card-burst";
    burst.dataset.characterBattleEffect = CHARACTER_ID;
    burst.dataset.targetSide = effect.side;
    burst.style.setProperty("--fimit-fate-burst-x", `${lane.x}%`);
    burst.style.setProperty("--fimit-fate-burst-y", `${lane.y}%`);
    burst.style.setProperty("--fimit-fate-burst-scale", lane.scale);
    burst.style.setProperty("--fimit-fate-burst-scale-pop", (lane.scale * 1.08).toFixed(3));
    burst.style.setProperty("--fimit-fate-burst-scale-end", (lane.scale * 1.18).toFixed(3));
    burst.style.setProperty("--fimit-fate-burst-angle", `${lane.angle}deg`);
    const mountedBurst = appendEffectElement(targetStage, burst);
    registerTimeout(window.setTimeout(() => mountedBurst.remove(), FATE_BURST_LIFETIME_MS));
  }

  function scheduleFateImpacts(effect, helpers) {
    const { registerTimeout, playLogEffect, stageForSide, appendEffectElement } = helpers;
    const {
      impactDelayMs: _impactDelayMs,
      impactValue,
      impactDamageValue,
      delayMs: _delayMs,
      ...baseEffect
    } = effect;

    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type: "fimit-fate-card-impact",
      value: impactValue,
      damageValue: Boolean(impactDamageValue),
    }), 500));
    registerTimeout(window.setTimeout(() => mountFateBurst(
      effect,
      stageForSide,
      appendEffectElement,
      registerTimeout,
      { x: 45, y: 64, scale: 0.82, angle: -12 },
    ), 555));
    registerTimeout(window.setTimeout(() => mountFateBurst(
      effect,
      stageForSide,
      appendEffectElement,
      registerTimeout,
      { x: 47, y: 34, scale: 0.74, angle: 11 },
    ), 610));
  }

  function mountTrueCopy(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const sourceStage = stageForSide(effect.copySourceSide);
    const targetStage = stageForSide(effect.side);
    const sourceSprite = sourceStage?.querySelector(".battle-sprite-side");
    if (!arena || !sourceStage || !targetStage || !sourceSprite) return;
    const imageUrl = sourceSprite.currentSrc || sourceSprite.src;
    if (!imageUrl) return;

    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const sourceLeft = sourceRect.left - arenaRect.left;
    const sourceTop = sourceRect.top - arenaRect.top;
    const deltaX = targetRect.left - sourceRect.left;
    const deltaY = targetRect.top - sourceRect.top;

    const silhouette = document.createElement("span");
    silhouette.className = "battle-fx-fimit-true-copy-silhouette";
    silhouette.dataset.characterBattleEffect = CHARACTER_ID;
    silhouette.dataset.sourceSide = effect.copySourceSide;
    silhouette.dataset.targetSide = effect.side;
    silhouette.style.left = `${sourceLeft}px`;
    silhouette.style.top = `${sourceTop}px`;
    silhouette.style.width = `${sourceRect.width}px`;
    silhouette.style.height = `${sourceRect.height}px`;
    silhouette.style.setProperty("--fimit-copy-dx", `${deltaX}px`);
    silhouette.style.setProperty("--fimit-copy-dy", `${deltaY}px`);
    silhouette.style.setProperty("--fimit-copy-flip", effect.copySourceSide === "ai" ? -1 : 1);
    silhouette.style.webkitMaskImage = `url("${imageUrl}")`;
    silhouette.style.maskImage = `url("${imageUrl}")`;
    const mountedSilhouette = appendEffectElement(arena, silhouette);
    registerTimeout(window.setTimeout(() => mountedSilhouette.remove(), TRUE_COPY_LIFETIME_MS));

    registerTimeout(window.setTimeout(() => {
      const flash = document.createElement("span");
      flash.className = "battle-fx-fimit-true-copy-absorb";
      flash.dataset.characterBattleEffect = CHARACTER_ID;
      const mountedFlash = appendEffectElement(targetStage, flash);
      registerTimeout(window.setTimeout(() => mountedFlash.remove(), 420));
    }, 610));
  }

  function playEffect(effect, helpers) {
    const {
      arena,
      stageForSide,
      appendEffectElement = (parent, element) => { parent.append(element); return element; },
      registerTimeout,
    } = helpers;
    if (effect.type === "fimit-fate-cards-cast") {
      mountFateCards(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      scheduleFateImpacts(effect, helpers);
      return true;
    }
    if (effect.type === "fimit-true-copy") {
      mountTrueCopy(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      return true;
    }
    return false;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: [IMITATION_STATUS_NAME],
    effectTypes: [
      "fimit-imitation-mask",
      "fimit-fate-cards-cast",
      "fimit-fate-card-impact",
      "fimit-counterfeit-ward",
      "fimit-simple-trick-uppercut",
      "fimit-true-copy",
    ],
    sfx: {
      "fimit-imitation-mask": "/assets/sfx/buff.wav",
      "fimit-fate-card-impact": "/assets/sfx/hit.wav",
      "fimit-counterfeit-ward": "/assets/sfx/buff.wav",
      "fimit-simple-trick-uppercut": "/assets/sfx/hit.wav",
      "fimit-true-copy": "/assets/sfx/buff.wav",
    },
    damage,
    success,
    counterChange,
    log,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
