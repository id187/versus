"use strict";

(function registerMelagueBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before melague effects.");

  const CHARACTER_ID = "melague";
  const PLAGUE_STATUS_NAME = "역병";
  const PATHOGEN_SCATTER_ACTION_NAME = "병원체 살포";
  const ANTIBODY_ACTIVATION_ACTION_NAME = "항체 활성";
  const PLAGUE_BLOOD_ACTION_NAME = "병혈 전파";
  const SEWER_RATS_ACTION_NAME = "시궁의 쥐떼";
  const ANTIBODY_IMPACT_DELAY_MS = 760;
  const RAT_IMPACT_DELAY_MS = 520;
  const RAT_SWARM_LIFETIME_MS = 650;
  const BUBBLE_PARTICLES = Object.freeze([
    { size: 19, x: 41, y: -3, rise: 38, delay: 0, duration: 570 },
    { size: 27, x: 55, y: 1, rise: 54, delay: 110, duration: 610 },
    { size: 15, x: 48, y: -6, rise: 46, delay: 220, duration: 540 },
    { size: 22, x: 62, y: -2, rise: 63, delay: 330, duration: 590 },
    { size: 13, x: 36, y: -7, rise: 49, delay: 440, duration: 520 },
  ]);
  const ANTIBODY_PARTICLES = Object.freeze([
    { size: 31, startX: -0.08, startY: -0.14, endX: 0.02, endY: -0.05, curve: -0.15, delay: 0, duration: 620 },
    { size: 22, startX: 0.13, startY: -0.03, endX: -0.05, endY: 0.04, curve: 0.12, delay: 60, duration: 580 },
    { size: 38, startX: -0.02, startY: 0.12, endX: 0.04, endY: -0.02, curve: -0.09, delay: 105, duration: 640 },
    { size: 18, startX: -0.16, startY: 0.02, endX: -0.08, endY: 0.07, curve: 0.15, delay: 125, duration: 560 },
    { size: 27, startX: 0.08, startY: 0.17, endX: 0.07, endY: -0.08, curve: -0.13, delay: 165, duration: 585 },
    { size: 15, startX: 0.18, startY: -0.17, endX: 0, endY: 0.03, curve: 0.08, delay: 200, duration: 540 },
  ]);

  function statusDamage({ statusName, targetName, targetSide, damage: rawDamage, makeLogEffect }) {
    if (statusName !== PLAGUE_STATUS_NAME) return undefined;
    const damage = Number(rawDamage);
    if (!(damage > 0)) return null;
    const effect = makeLogEffect(
      "melague-plague-bubbles",
      targetName,
      targetName,
      damage,
      targetSide,
      targetSide,
    );
    return effect ? { ...effect, damageValue: true } : null;
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage: rawDamage, makeLogEffect }) {
    const damageValue = Number(rawDamage);
    if (![PATHOGEN_SCATTER_ACTION_NAME, SEWER_RATS_ACTION_NAME].includes(actionName)) return undefined;
    if (!(damageValue > 0)) return null;

    if (actionName === PATHOGEN_SCATTER_ACTION_NAME) {
      const effect = makeLogEffect(
        "melague-pathogen-smoke",
        targetName,
        actorName,
        damageValue,
        targetSide,
        actorSide,
      );
      return effect ? { ...effect, damageValue: true } : null;
    }

    const effect = makeLogEffect(
      "melague-sewer-rats-cast",
      targetName,
      actorName,
      null,
      targetSide,
      actorSide,
    );
    return effect ? {
      ...effect,
      damageValue: false,
      impactDelayMs: RAT_IMPACT_DELAY_MS,
      impactValue: damageValue,
      impactDamageValue: true,
    } : null;
  }

  function heal({ actionName, reason, actorName, actorSide, targetName, targetSide, amount, battle, makeLogEffect, oppositeSide }) {
    if (actionName !== ANTIBODY_ACTIVATION_ACTION_NAME || reason !== ANTIBODY_ACTIVATION_ACTION_NAME) {
      return undefined;
    }
    const resolvedTargetSide = targetSide || actorSide;
    const drainedSide = oppositeSide(resolvedTargetSide);
    const drainedName = battle?.[drainedSide]?.name || actorName;
    const effect = makeLogEffect(
      "melague-antibody-absorption-cast",
      targetName || actorName,
      drainedName,
      null,
      resolvedTargetSide,
      drainedSide,
    );
    return effect ? {
      ...effect,
      impactDelayMs: ANTIBODY_IMPACT_DELAY_MS,
      impactValue: Math.max(0, Number(amount) || 0),
      impactValueKind: "hp-gain",
    } : null;
  }

  function statEffect({ actionName, actorName, actorSide, targetName, targetSide, stat, multiplier, makeLogEffect }) {
    if (
      actionName !== PLAGUE_BLOOD_ACTION_NAME
      || targetName !== actorName
      || stat !== "def"
      || Number(multiplier) !== 0.8
    ) {
      return undefined;
    }
    return makeLogEffect(
      "melague-plague-blood-cross",
      actorName,
      actorName,
      null,
      targetSide || actorSide,
      actorSide,
    );
  }

  function scheduleImpact(effect, type, delayMs, registerTimeout, playLogEffect) {
    const {
      impactDelayMs: _impactDelayMs,
      impactValue,
      impactValueKind,
      impactDamageValue,
      delayMs: _delayMs,
      ...baseEffect
    } = effect;
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type,
      value: impactValue,
      valueKind: impactValueKind,
      damageValue: Boolean(impactDamageValue),
    }), delayMs));
  }

  function mountPlagueBubbles(effect, stageForSide, appendEffectElement, registerTimeout) {
    const targetStage = stageForSide(effect.side);
    if (!targetStage) return;
    for (const particle of BUBBLE_PARTICLES) {
      const bubble = document.createElement("span");
      bubble.className = "battle-fx-melague-plague-bubble-particle";
      bubble.dataset.characterBattleEffect = CHARACTER_ID;
      bubble.dataset.targetSide = effect.side;
      bubble.style.setProperty("--melague-bubble-size", `${particle.size}px`);
      bubble.style.setProperty("--melague-bubble-x", `${particle.x}%`);
      bubble.style.setProperty("--melague-bubble-y", `${particle.y}%`);
      bubble.style.setProperty("--melague-bubble-rise", `${particle.rise}px`);
      bubble.style.setProperty("--melague-bubble-delay", `${particle.delay}ms`);
      bubble.style.setProperty("--melague-bubble-duration", `${particle.duration}ms`);
      const mountedBubble = appendEffectElement(targetStage, bubble);
      registerTimeout(window.setTimeout(() => mountedBubble.remove(), particle.delay + particle.duration + 80));
    }
  }

  function mountAntibodyEnergy(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const drainedStage = stageForSide(effect.sourceSide);
    const melagueStage = stageForSide(effect.side);
    if (!arena || !drainedStage || !melagueStage) return;
    const arenaRect = arena.getBoundingClientRect();
    const drainedRect = drainedStage.getBoundingClientRect();
    const melagueRect = melagueStage.getBoundingClientRect();
    const drainedBodyY = registry.stagePercent(drainedStage, "--fx-body-y", 0.5);
    const melagueBodyY = registry.stagePercent(melagueStage, "--fx-body-y", 0.5);
    const baseStartX = drainedRect.left + drainedRect.width * 0.5 - arenaRect.left;
    const baseStartY = drainedRect.top + drainedRect.height * drainedBodyY - arenaRect.top;
    const baseEndX = melagueRect.left + melagueRect.width * 0.5 - arenaRect.left;
    const baseEndY = melagueRect.top + melagueRect.height * melagueBodyY - arenaRect.top;

    for (const particle of ANTIBODY_PARTICLES) {
      const startX = baseStartX + drainedRect.width * particle.startX;
      const startY = baseStartY + drainedRect.height * particle.startY;
      const endX = baseEndX + melagueRect.width * particle.endX;
      const endY = baseEndY + melagueRect.height * particle.endY;
      const energy = document.createElement("span");
      energy.className = "battle-fx-melague-antibody-energy";
      energy.dataset.characterBattleEffect = CHARACTER_ID;
      energy.dataset.sourceSide = effect.sourceSide;
      energy.dataset.targetSide = effect.side;
      energy.style.setProperty("--melague-energy-size", `${particle.size}px`);
      energy.style.setProperty("--melague-energy-start-x", `${startX}px`);
      energy.style.setProperty("--melague-energy-start-y", `${startY}px`);
      energy.style.setProperty("--melague-energy-mid-x", `${(startX + endX) * 0.5}px`);
      energy.style.setProperty("--melague-energy-mid-y", `${(startY + endY) * 0.5 + arenaRect.height * particle.curve}px`);
      energy.style.setProperty("--melague-energy-end-x", `${endX}px`);
      energy.style.setProperty("--melague-energy-end-y", `${endY}px`);
      energy.style.setProperty("--melague-energy-delay", `${particle.delay}ms`);
      energy.style.setProperty("--melague-energy-duration", `${particle.duration}ms`);
      const mountedEnergy = appendEffectElement(arena, energy);
      registerTimeout(window.setTimeout(() => mountedEnergy.remove(), particle.delay + particle.duration + 80));
    }
  }

  function mountSewerRats(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);
    if (!arena || !sourceStage || !targetStage) return;
    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const sourceGroundY = registry.stagePercent(sourceStage, "--fx-ground-y", 0.96);
    const targetGroundY = registry.stagePercent(targetStage, "--fx-ground-y", 0.96);
    const startX = sourceRect.left + sourceRect.width * 0.5 - arenaRect.left;
    const startY = sourceRect.top + sourceRect.height * sourceGroundY - arenaRect.top;
    const endX = targetRect.left + targetRect.width * 0.5 - arenaRect.left;
    const endY = targetRect.top + targetRect.height * targetGroundY - arenaRect.top;
    const direction = endX >= startX ? 1 : -1;
    const rats = document.createElement("span");
    rats.className = "battle-fx-melague-sewer-rat-swarm";
    rats.dataset.characterBattleEffect = CHARACTER_ID;
    rats.dataset.sourceSide = effect.sourceSide;
    rats.dataset.targetSide = effect.side;
    rats.style.setProperty("--melague-rats-start-x", `${startX}px`);
    rats.style.setProperty("--melague-rats-start-y", `${startY}px`);
    rats.style.setProperty("--melague-rats-end-x", `${endX}px`);
    rats.style.setProperty("--melague-rats-end-y", `${endY}px`);
    rats.style.setProperty("--melague-rats-direction", direction);
    const mountedRats = appendEffectElement(arena, rats);
    registerTimeout(window.setTimeout(() => mountedRats.remove(), RAT_SWARM_LIFETIME_MS));
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type === "melague-plague-bubbles") {
      mountPlagueBubbles(effect, stageForSide, appendEffectElement, registerTimeout);
      return false;
    }
    if (effect.type === "melague-antibody-absorption-cast") {
      mountAntibodyEnergy(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(
        effect,
        "melague-antibody-absorption-impact",
        ANTIBODY_IMPACT_DELAY_MS,
        registerTimeout,
        playLogEffect,
      );
      return true;
    }
    if (effect.type === "melague-sewer-rats-cast") {
      mountSewerRats(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(
        effect,
        "melague-sewer-rats-impact",
        RAT_IMPACT_DELAY_MS,
        registerTimeout,
        playLogEffect,
      );
      return true;
    }
    return false;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: [PLAGUE_STATUS_NAME],
    effectTypes: [
      "melague-plague-bubbles",
      "melague-pathogen-smoke",
      "melague-antibody-absorption-cast",
      "melague-antibody-absorption-impact",
      "melague-plague-blood-cross",
      "melague-sewer-rats-cast",
      "melague-sewer-rats-impact",
    ],
    sfx: {
      "melague-plague-bubbles": "/assets/sfx/hit.wav",
      "melague-pathogen-smoke": "/assets/sfx/hit.wav",
      "melague-antibody-absorption-cast": "/assets/sfx/stack-spend.wav",
      "melague-antibody-absorption-impact": "/assets/sfx/heal.wav",
      "melague-plague-blood-cross": "/assets/sfx/debuff.wav",
      "melague-sewer-rats-impact": "/assets/sfx/hit.wav",
    },
    statusDamage,
    damage,
    heal,
    statEffect,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
