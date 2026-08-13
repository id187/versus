"use strict";

(function registerReveshaBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before revesha effects.");

  const CHARACTER_ID = "revesha";
  const INSIGHT_STATUS_NAME = "통찰";
  const REVERSED_BLADE_ACTION_NAME = "날이 뒤집힌 검";
  const BROKEN_MIRROR_ACTION_NAME = "깨져버린 거울";
  const FADED_ORB_ACTION_NAME = "빛이 바랜 구슬";
  const FORESEEN_END_ACTION_NAME = "예견된 종말";
  const ORB_WAVE_DELAY_MS = 80;
  const ORB_IMPACT_DELAY_MS = 270;
  const ORB_LIFETIME_MS = 430;
  const WAVE_LIFETIME_MS = 250;

  function counterChange({ statusName, targetName, targetSide, before, after, makeLogEffect }) {
    if (statusName !== INSIGHT_STATUS_NAME || after <= before) return undefined;
    const effect = makeLogEffect(
      "insight-eye",
      targetName,
      targetName,
      `${INSIGHT_STATUS_NAME}+${after - before}`,
      targetSide,
      targetSide,
    );
    return effect ? { ...effect, valueKind: "stack-gain" } : null;
  }

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== BROKEN_MIRROR_ACTION_NAME) return undefined;
    return makeLogEffect(
      "broken-mirror-barrier",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (!(damage > 0)) return null;

    if (actionName === REVERSED_BLADE_ACTION_NAME) {
      const effect = makeLogEffect(
        "reversed-blade-slash",
        targetName,
        actorName,
        damage,
        targetSide,
        actorSide,
      );
      return effect ? { ...effect, damageValue: true } : null;
    }

    if (actionName === FADED_ORB_ACTION_NAME) {
      const effect = makeLogEffect(
        "faded-orb-cast",
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
        impactDamageValue: true,
      } : null;
    }

    if (actionName !== FORESEEN_END_ACTION_NAME) return undefined;
    const effect = makeLogEffect(
      "foreseen-end-cross",
      targetName,
      actorName,
      damage,
      targetSide,
      actorSide,
    );
    return effect ? { ...effect, damageValue: true } : null;
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type !== "faded-orb-cast") return false;

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
      const sourceBodyY = registry.stagePercent(sourceStage, "--fx-body-y", 0.5);
      const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
      const sourceCenterX = sourceRect.left + sourceRect.width * 0.5 - arenaRect.left;
      const targetCenterX = targetRect.left + targetRect.width * 0.5 - arenaRect.left;
      const horizontalDirection = targetCenterX >= sourceCenterX ? 1 : -1;
      const startX = sourceCenterX;
      const startY = sourceRect.top + sourceRect.height * sourceBodyY - arenaRect.top;
      const endX = targetCenterX;
      const endY = targetRect.top + targetRect.height * targetBodyY - arenaRect.top;
      const angle = Math.atan2(endY - startY, Math.abs(endX - startX)) * horizontalDirection;

      const orb = document.createElement("span");
      orb.className = "battle-fx-faded-orb-caster";
      orb.dataset.characterBattleEffect = CHARACTER_ID;
      orb.dataset.sourceSide = effect.sourceSide;
      orb.dataset.targetSide = effect.side;
      orb.style.setProperty("--revesha-orb-x", `${startX}px`);
      orb.style.setProperty("--revesha-orb-y", `${startY}px`);
      orb.style.setProperty("--revesha-orb-flip", horizontalDirection);
      const mountedOrb = appendEffectElement(arena, orb);
      registerTimeout(window.setTimeout(() => mountedOrb.remove(), ORB_LIFETIME_MS));

      registerTimeout(window.setTimeout(() => {
        const wave = document.createElement("span");
        wave.className = "battle-fx-faded-orb-wave-projectile";
        wave.dataset.characterBattleEffect = CHARACTER_ID;
        wave.dataset.sourceSide = effect.sourceSide;
        wave.dataset.targetSide = effect.side;
        wave.style.setProperty("--revesha-wave-start-x", `${startX}px`);
        wave.style.setProperty("--revesha-wave-start-y", `${startY}px`);
        wave.style.setProperty("--revesha-wave-end-x", `${endX}px`);
        wave.style.setProperty("--revesha-wave-end-y", `${endY}px`);
        wave.style.setProperty("--revesha-wave-angle", `${angle}rad`);
        wave.style.setProperty("--revesha-wave-flip", horizontalDirection);
        const mountedWave = appendEffectElement(arena, wave);
        registerTimeout(window.setTimeout(() => mountedWave.remove(), WAVE_LIFETIME_MS));
      }, ORB_WAVE_DELAY_MS));
    }

    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type: "faded-orb-impact",
      value: impactValue,
      damageValue: Boolean(impactDamageValue),
    }), ORB_IMPACT_DELAY_MS));
    return true;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: [INSIGHT_STATUS_NAME],
    effectTypes: [
      "insight-eye",
      "reversed-blade-slash",
      "broken-mirror-barrier",
      "faded-orb-cast",
      "faded-orb-impact",
      "foreseen-end-cross",
    ],
    sfx: {
      "insight-eye": "/assets/sfx/buff.wav",
      "reversed-blade-slash": "/assets/sfx/hit.wav",
      "broken-mirror-barrier": "/assets/sfx/defense.wav",
      "faded-orb-impact": "/assets/sfx/hit.wav",
      "foreseen-end-cross": "/assets/sfx/hit.wav",
    },
    counterChange,
    success,
    damage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
