"use strict";

(function registerXenoxBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before xenox effects.");

  const CHARACTER_ID = "xenox";
  const ATTRACTED_FATE = "이끌리는 운명";
  const EXTENDED_FATE = "연장되는 운명";
  const FATE_PREVIEW = "운명 맛보기";
  const UNSTOPPABLE_FATE = "막을 수 없는 운명";
  const METEOR_FALL = "유성 낙하";
  const METEOR_IMPACT_MS = 500;
  const ATTRACTED_IMPACT_MS = 520;

  function action({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName === METEOR_FALL) {
      return makeLogEffect(
        "xenox-orbit-meteor-clock",
        actorName,
        actorName,
        null,
        actorSide,
        actorSide,
      );
    }
    return undefined;
  }

  function counterChange({ actionName, targetName, targetSide, before, after, makeLogEffect }) {
    if (actionName !== EXTENDED_FATE || after <= before) return undefined;
    return makeLogEffect(
      "xenox-extended-fate-clock",
      targetName,
      targetName,
      null,
      targetSide,
      targetSide,
    );
  }

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== UNSTOPPABLE_FATE) return undefined;
    return makeLogEffect(
      "xenox-unstoppable-clock",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage: rawDamage, makeLogEffect }) {
    const damageValue = Number(rawDamage);
    if (!(damageValue > 0)) return null;
    if (actionName === FATE_PREVIEW) {
      const effect = makeLogEffect(
        "xenox-fate-preview-light",
        targetName,
        actorName,
        damageValue,
        targetSide,
        actorSide,
      );
      return effect ? { ...effect, damageValue: true } : null;
    }
    if (actionName === ATTRACTED_FATE) {
      const effect = makeLogEffect(
        "xenox-attracted-fate-cast",
        targetName,
        actorName,
        null,
        targetSide,
        actorSide,
      );
      return effect ? {
        ...effect,
        impactDelayMs: ATTRACTED_IMPACT_MS,
        impactValue: damageValue,
        impactDamageValue: true,
      } : null;
    }
    if (actionName === METEOR_FALL) {
      const effect = makeLogEffect(
        "xenox-meteor-cast",
        targetName,
        actorName,
        null,
        targetSide,
        actorSide,
      );
      return effect ? {
        ...effect,
        impactDelayMs: METEOR_IMPACT_MS,
        impactValue: damageValue,
        impactDamageValue: true,
      } : null;
    }
    return undefined;
  }

  function scheduleImpact(effect, type, delayMs, registerTimeout, playLogEffect) {
    const {
      impactDelayMs: _impactDelayMs,
      impactValue,
      impactDamageValue,
      delayMs: _delayMs,
      ...baseEffect
    } = effect;
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type,
      value: impactValue,
      damageValue: Boolean(impactDamageValue),
    }), delayMs));
  }

  function arenaGeometry(effect, arena, stageForSide) {
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);
    if (!arena || !sourceStage || !targetStage) return null;
    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const sourceBodyY = registry.stagePercent(sourceStage, "--fx-body-y", 0.5);
    const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
    const targetGroundY = registry.stagePercent(targetStage, "--fx-ground-y", 0.96);
    return {
      arenaRect,
      sourceRect,
      targetRect,
      startX: sourceRect.left + sourceRect.width * 0.5 - arenaRect.left,
      startY: sourceRect.top + sourceRect.height * sourceBodyY - arenaRect.top,
      endX: targetRect.left + targetRect.width * 0.5 - arenaRect.left,
      endY: targetRect.top + targetRect.height * targetBodyY - arenaRect.top,
      targetGroundY: targetRect.top + targetRect.height * targetGroundY - arenaRect.top,
    };
  }

  function mountMeteor(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const geometry = arenaGeometry(effect, arena, stageForSide);
    if (!geometry) return;
    const { arenaRect, targetRect, endX, targetGroundY } = geometry;
    const startY = Math.max(-180, targetRect.top - arenaRect.top - Math.max(250, targetRect.height * 0.72));
    const meteor = document.createElement("span");
    meteor.className = "battle-fx-xenox-meteor-projectile";
    meteor.dataset.characterBattleEffect = CHARACTER_ID;
    meteor.dataset.sourceSide = effect.sourceSide;
    meteor.dataset.targetSide = effect.side;
    meteor.style.setProperty("--xenox-meteor-x", `${endX}px`);
    meteor.style.setProperty("--xenox-meteor-start-y", `${startY}px`);
    meteor.style.setProperty("--xenox-meteor-end-y", `${targetGroundY}px`);
    const mounted = appendEffectElement(arena, meteor);
    registerTimeout(window.setTimeout(() => mounted.remove(), METEOR_IMPACT_MS + 140));
  }

  function mountAttractedOrbs(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const geometry = arenaGeometry(effect, arena, stageForSide);
    if (!geometry) return;
    const { arenaRect, startX, startY, endX, endY } = geometry;
    const direction = endX >= startX ? 1 : -1;
    const midX = (startX + endX) * 0.5;
    const curve = Math.min(128, Math.max(86, Math.abs(endX - startX) * 0.2));
    const centerY = (startY + endY) * 0.5;
    const midpoints = [
      Math.max(16, centerY - curve),
      Math.min(arenaRect.height - 16, centerY + curve),
    ];
    midpoints.forEach((midY, index) => {
      const orb = document.createElement("span");
      orb.className = `battle-fx-xenox-attracted-orb battle-fx-xenox-attracted-orb-${index + 1}`;
      orb.dataset.characterBattleEffect = CHARACTER_ID;
      orb.dataset.sourceSide = effect.sourceSide;
      orb.dataset.targetSide = effect.side;
      orb.style.setProperty("--xenox-start-x", `${startX}px`);
      orb.style.setProperty("--xenox-start-y", `${startY}px`);
      orb.style.setProperty("--xenox-mid-x", `${midX}px`);
      orb.style.setProperty("--xenox-mid-y", `${midY}px`);
      orb.style.setProperty("--xenox-end-x", `${endX}px`);
      orb.style.setProperty("--xenox-end-y", `${endY}px`);
      orb.style.setProperty("--xenox-direction", direction);
      const mounted = appendEffectElement(arena, orb);
      registerTimeout(window.setTimeout(() => mounted.remove(), ATTRACTED_IMPACT_MS + 140));
    });
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type === "xenox-meteor-cast") {
      mountMeteor(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(effect, "xenox-meteor-impact", METEOR_IMPACT_MS, registerTimeout, playLogEffect);
      return true;
    }
    if (effect.type === "xenox-attracted-fate-cast") {
      mountAttractedOrbs(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(effect, "xenox-attracted-impact", ATTRACTED_IMPACT_MS, registerTimeout, playLogEffect);
      return true;
    }
    return false;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: ["궤도"],
    effectTypes: [
      "xenox-orbit-meteor-clock",
      "xenox-extended-fate-clock",
      "xenox-meteor-cast",
      "xenox-meteor-impact",
      "xenox-attracted-fate-cast",
      "xenox-attracted-impact",
      "xenox-fate-preview-light",
      "xenox-unstoppable-clock",
    ],
    sfx: {
      "xenox-orbit-meteor-clock": "/assets/sfx/buff.wav",
      "xenox-extended-fate-clock": "/assets/sfx/buff.wav",
      "xenox-meteor-impact": "/assets/sfx/hit.wav",
      "xenox-attracted-impact": "/assets/sfx/hit.wav",
      "xenox-fate-preview-light": "/assets/sfx/hit.wav",
      "xenox-unstoppable-clock": "/assets/sfx/defense.wav",
    },
    action,
    counterChange,
    success,
    damage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
