"use strict";

(function registerXeroxBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before xerox effects.");

  const CHARACTER_ID = "xerox";
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
        "xerox-orbit-meteor-clock",
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
      "xerox-extended-fate-clock",
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
      "xerox-unstoppable-clock",
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
        "xerox-fate-preview-light",
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
        "xerox-attracted-fate-cast",
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
        "xerox-meteor-cast",
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
    meteor.className = "battle-fx-xerox-meteor-projectile";
    meteor.dataset.characterBattleEffect = CHARACTER_ID;
    meteor.dataset.sourceSide = effect.sourceSide;
    meteor.dataset.targetSide = effect.side;
    meteor.style.setProperty("--xerox-meteor-x", `${endX}px`);
    meteor.style.setProperty("--xerox-meteor-start-y", `${startY}px`);
    meteor.style.setProperty("--xerox-meteor-end-y", `${targetGroundY}px`);
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
      orb.className = `battle-fx-xerox-attracted-orb battle-fx-xerox-attracted-orb-${index + 1}`;
      orb.dataset.characterBattleEffect = CHARACTER_ID;
      orb.dataset.sourceSide = effect.sourceSide;
      orb.dataset.targetSide = effect.side;
      orb.style.setProperty("--xerox-start-x", `${startX}px`);
      orb.style.setProperty("--xerox-start-y", `${startY}px`);
      orb.style.setProperty("--xerox-mid-x", `${midX}px`);
      orb.style.setProperty("--xerox-mid-y", `${midY}px`);
      orb.style.setProperty("--xerox-end-x", `${endX}px`);
      orb.style.setProperty("--xerox-end-y", `${endY}px`);
      orb.style.setProperty("--xerox-direction", direction);
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
    if (effect.type === "xerox-meteor-cast") {
      mountMeteor(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(effect, "xerox-meteor-impact", METEOR_IMPACT_MS, registerTimeout, playLogEffect);
      return true;
    }
    if (effect.type === "xerox-attracted-fate-cast") {
      mountAttractedOrbs(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(effect, "xerox-attracted-impact", ATTRACTED_IMPACT_MS, registerTimeout, playLogEffect);
      return true;
    }
    return false;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: ["궤도"],
    effectTypes: [
      "xerox-orbit-meteor-clock",
      "xerox-extended-fate-clock",
      "xerox-meteor-cast",
      "xerox-meteor-impact",
      "xerox-attracted-fate-cast",
      "xerox-attracted-impact",
      "xerox-fate-preview-light",
      "xerox-unstoppable-clock",
    ],
    sfx: {
      "xerox-orbit-meteor-clock": "/assets/sfx/buff.wav",
      "xerox-extended-fate-clock": "/assets/sfx/buff.wav",
      "xerox-meteor-impact": "/assets/sfx/hit.wav",
      "xerox-attracted-impact": "/assets/sfx/hit.wav",
      "xerox-fate-preview-light": "/assets/sfx/hit.wav",
      "xerox-unstoppable-clock": "/assets/sfx/defense.wav",
    },
    action,
    counterChange,
    success,
    damage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
