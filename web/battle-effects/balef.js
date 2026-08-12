"use strict";

(function registerBalefBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before balef effects.");

  const CHARACTER_ID = "balef";
  const SHATTER_ACTION_NAME = "범권괴권";
  const ABSORB_ACTION_NAME = "흡성대권";
  const PIERCE_ACTION_NAME = "관통마권";
  const ULTIMATE_ACTION_NAME = "극의환권";
  const ATTACK_EFFECTS = Object.freeze({
    [SHATTER_ACTION_NAME]: "balef-shatter-punch",
    [ABSORB_ACTION_NAME]: "balef-drain-punch",
    [PIERCE_ACTION_NAME]: "balef-spiral-punch",
  });
  const ORB_PARTICLES = Object.freeze([
    { size: 38, startX: -0.06, startY: -0.13, endX: 0.02, endY: -0.04, curve: -0.12, delay: 90, duration: 620 },
    { size: 25, startX: 0.12, startY: -0.02, endX: -0.04, endY: 0.05, curve: 0.11, delay: 145, duration: 570 },
    { size: 17, startX: -0.15, startY: 0.11, endX: 0.06, endY: 0.01, curve: -0.06, delay: 205, duration: 520 },
    { size: 31, startX: 0.03, startY: 0.16, endX: -0.01, endY: -0.07, curve: 0.14, delay: 240, duration: 600 },
    { size: 13, startX: 0.17, startY: -0.17, endX: 0.08, endY: 0.07, curve: -0.15, delay: 285, duration: 480 },
    { size: 21, startX: -0.09, startY: 0.01, endX: -0.07, endY: -0.01, curve: 0.07, delay: 330, duration: 530 },
  ]);

  function sideForName(battle, fighterName) {
    return ["player", "ai"].find((side) => battle?.[side]?.name === fighterName) || null;
  }

  function action({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== ULTIMATE_ACTION_NAME) return undefined;
    return makeLogEffect("balef-triad-sigil", actorName, actorName, null, actorSide, actorSide);
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    const effectType = ATTACK_EFFECTS[actionName];
    if (!effectType) return undefined;
    if (!(damage > 0)) return null;
    const effect = makeLogEffect(effectType, targetName, actorName, damage, targetSide, actorSide);
    return effect ? { ...effect, damageValue: true } : null;
  }

  function cost({ actionName, actorName, actorSide, fighterName, beforeMp, afterMp, battle, makeLogEffect, oppositeSide }) {
    if (actionName !== ABSORB_ACTION_NAME || !(afterMp < beforeMp) || fighterName === actorName) return undefined;
    const drainedSide = sideForName(battle, fighterName) || oppositeSide(actorSide);
    const amount = beforeMp - afterMp;
    const effect = makeLogEffect(
      "balef-absorption-orbs",
      fighterName,
      actorName,
      amount,
      drainedSide,
      actorSide,
    );
    return effect ? { ...effect, valueKind: "mp-loss" } : null;
  }

  function counterChange({ statusName, targetName, targetSide, before, after, makeLogEffect }) {
    if (statusName !== "권의" || !(after > before)) return undefined;
    const effect = makeLogEffect(
      "balef-flow-gain",
      targetName,
      targetName,
      `권의+${after - before}`,
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
  }) {
    if (effect.type !== "balef-absorption-orbs") return false;
    const drainedStage = stageForSide(effect.side);
    const balefStage = stageForSide(effect.sourceSide);
    if (!arena || !drainedStage || !balefStage) return false;

    const arenaRect = arena.getBoundingClientRect();
    const drainedRect = drainedStage.getBoundingClientRect();
    const balefRect = balefStage.getBoundingClientRect();
    const drainedBodyY = registry.stagePercent(drainedStage, "--fx-body-y", 0.5);
    const balefBodyY = registry.stagePercent(balefStage, "--fx-body-y", 0.5);
    const baseStartX = drainedRect.left + drainedRect.width / 2 - arenaRect.left;
    const baseStartY = drainedRect.top + drainedRect.height * drainedBodyY - arenaRect.top;
    const baseEndX = balefRect.left + balefRect.width / 2 - arenaRect.left;
    const baseEndY = balefRect.top + balefRect.height * balefBodyY - arenaRect.top;

    for (const particle of ORB_PARTICLES) {
      const startX = baseStartX + drainedRect.width * particle.startX;
      const startY = baseStartY + drainedRect.height * particle.startY;
      const endX = baseEndX + balefRect.width * particle.endX;
      const endY = baseEndY + balefRect.height * particle.endY;
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2 + arenaRect.height * particle.curve;
      const orb = document.createElement("span");
      orb.className = "battle-fx-balef-absorption-orb";
      orb.dataset.characterBattleEffect = CHARACTER_ID;
      orb.style.setProperty("--balef-orb-size", `${particle.size}px`);
      orb.style.setProperty("--balef-orb-start-x", `${startX}px`);
      orb.style.setProperty("--balef-orb-start-y", `${startY}px`);
      orb.style.setProperty("--balef-orb-mid-x", `${midX}px`);
      orb.style.setProperty("--balef-orb-mid-y", `${midY}px`);
      orb.style.setProperty("--balef-orb-end-x", `${endX}px`);
      orb.style.setProperty("--balef-orb-end-y", `${endY}px`);
      orb.style.setProperty("--balef-orb-delay", `${particle.delay}ms`);
      orb.style.setProperty("--balef-orb-duration", `${particle.duration}ms`);
      const mountedOrb = appendEffectElement(arena, orb);
      registerTimeout(window.setTimeout(() => mountedOrb.remove(), particle.delay + particle.duration + 80));
    }
    return false;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: ["권의"],
    effectTypes: [
      "balef-shatter-punch",
      "balef-drain-punch",
      "balef-spiral-punch",
      "balef-absorption-orbs",
      "balef-triad-sigil",
      "balef-flow-gain",
    ],
    sfx: {
      "balef-shatter-punch": "/assets/sfx/hit.wav",
      "balef-drain-punch": "/assets/sfx/hit.wav",
      "balef-spiral-punch": "/assets/sfx/hit.wav",
      "balef-absorption-orbs": "/assets/sfx/stack-gain.wav",
      "balef-triad-sigil": "/assets/sfx/buff.wav",
      "balef-flow-gain": "/assets/sfx/stack-gain.wav",
    },
    action,
    damage,
    cost,
    counterChange,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
