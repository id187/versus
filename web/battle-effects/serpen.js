"use strict";

(function registerSerpenBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before serpen effects.");

  const CHARACTER_ID = "serpen";
  const HALF_MOON_DANCE_ACTION_NAME = "반달무도";
  const RISING_TRAJECTORY_ACTION_NAME = "차오르는 궤적";
  const WANING_CARVE_ACTION_NAME = "기우는 도려내기";
  const FULL_MOON_SURGE_ACTION_NAME = "만월충천";
  const PHASE_MARKER_LIFETIME_MS = 980;
  const HALF_MOON_DANCE_LIFETIME_MS = 1040;
  const RISING_IMPACT_DELAY_MS = 620;
  const RISING_LIFETIME_MS = 840;
  const WANING_IMPACT_DELAY_MS = 230;
  const WANING_LIFETIME_MS = 780;
  const FULL_MOON_IMPACT_DELAY_MS = 500;
  const FULL_MOON_LIFETIME_MS = 840;
  const PHASE_KEYS = Object.freeze({
    "삭월": "new-moon",
    "초승": "waxing-crescent",
    "상현": "first-quarter",
    "만월": "full-moon",
    "하현": "last-quarter",
    "그믐": "waning-crescent",
  });

  function action({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== HALF_MOON_DANCE_ACTION_NAME) return undefined;
    return makeLogEffect("serpen-half-moon-dance", actorName, actorName, null, actorSide, actorSide);
  }

  function phaseChange({ phase, targetName, targetSide, actorName, actorSide, makeLogEffect }) {
    const phaseKey = PHASE_KEYS[phase];
    if (!phaseKey) return undefined;
    const resolvedName = targetName || actorName;
    const resolvedSide = targetSide || actorSide;
    const effect = makeLogEffect(
      "serpen-phase-change",
      resolvedName,
      resolvedName,
      null,
      resolvedSide,
      resolvedSide,
    );
    return effect ? { ...effect, phaseKey } : null;
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage: rawDamage, makeLogEffect }) {
    const damageValue = Number(rawDamage);
    if (![RISING_TRAJECTORY_ACTION_NAME, WANING_CARVE_ACTION_NAME, FULL_MOON_SURGE_ACTION_NAME].includes(actionName)) {
      return undefined;
    }
    if (!(damageValue > 0)) return null;

    let type;
    let impactDelayMs;
    if (actionName === RISING_TRAJECTORY_ACTION_NAME) {
      type = "serpen-rising-trajectory-cast";
      impactDelayMs = RISING_IMPACT_DELAY_MS;
    } else if (actionName === WANING_CARVE_ACTION_NAME) {
      type = "serpen-waning-carve-cast";
      impactDelayMs = WANING_IMPACT_DELAY_MS;
    } else {
      type = "serpen-full-moon-surge-cast";
      impactDelayMs = FULL_MOON_IMPACT_DELAY_MS;
    }

    const effect = makeLogEffect(type, targetName, actorName, null, targetSide, actorSide);
    return effect ? {
      ...effect,
      damageValue: false,
      impactDelayMs,
      impactValue: damageValue,
      impactDamageValue: true,
    } : null;
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

  function mountPhaseMarker(effect, stageForSide, appendEffectElement, registerTimeout) {
    const targetStage = stageForSide(effect.side);
    if (!targetStage) return;
    const marker = document.createElement("span");
    marker.className = "battle-fx-serpen-phase-marker";
    marker.dataset.characterBattleEffect = CHARACTER_ID;
    marker.dataset.phase = effect.phaseKey;
    marker.dataset.targetSide = effect.side;
    const mountedMarker = appendEffectElement(targetStage, marker);
    registerTimeout(window.setTimeout(() => mountedMarker.remove(), PHASE_MARKER_LIFETIME_MS));
  }

  function mountHalfMoonDance(effect, stageForSide, appendEffectElement, registerTimeout) {
    const sourceStage = stageForSide(effect.sourceSide || effect.side);
    if (!sourceStage) return;
    const orbit = document.createElement("span");
    orbit.className = "battle-fx-serpen-half-moon-orbit";
    orbit.dataset.characterBattleEffect = CHARACTER_ID;
    orbit.dataset.sourceSide = effect.sourceSide;
    for (let index = 0; index < 3; index += 1) {
      const orb = document.createElement("span");
      orb.className = "battle-fx-serpen-half-moon-orb";
      orb.style.setProperty("--serpen-orb-index", index);
      orbit.append(orb);
    }
    const mountedOrbit = appendEffectElement(sourceStage, orbit);
    registerTimeout(window.setTimeout(() => mountedOrbit.remove(), HALF_MOON_DANCE_LIFETIME_MS));
  }

  function mountRisingTrajectory(effect, stageForSide, appendEffectElement, registerTimeout) {
    const targetStage = stageForSide(effect.side);
    if (!targetStage) return;
    const slash = document.createElement("span");
    slash.className = "battle-fx-serpen-rising-trajectory";
    slash.dataset.characterBattleEffect = CHARACTER_ID;
    slash.dataset.sourceSide = effect.sourceSide;
    slash.dataset.targetSide = effect.side;
    slash.style.setProperty("--serpen-facing", effect.sourceSide === "ai" ? -1 : 1);
    const mountedSlash = appendEffectElement(targetStage, slash);
    registerTimeout(window.setTimeout(() => mountedSlash.remove(), RISING_LIFETIME_MS));
  }

  function mountWaningCarve(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);
    if (!arena || !sourceStage || !targetStage) return;
    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const sourceY = registry.stagePercent(sourceStage, "--fx-body-y", 0.5);
    const targetY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
    const sourceX = sourceRect.left + sourceRect.width * 0.5 - arenaRect.left;
    const targetX = targetRect.left + targetRect.width * 0.5 - arenaRect.left;
    const slash = document.createElement("span");
    slash.className = "battle-fx-serpen-waning-carve";
    slash.dataset.characterBattleEffect = CHARACTER_ID;
    slash.dataset.sourceSide = effect.sourceSide;
    slash.dataset.targetSide = effect.side;
    slash.style.setProperty("--serpen-waning-start-x", `${targetX}px`);
    slash.style.setProperty("--serpen-waning-start-y", `${targetRect.top + targetRect.height * targetY - arenaRect.top}px`);
    slash.style.setProperty("--serpen-waning-end-x", `${sourceX}px`);
    slash.style.setProperty("--serpen-waning-end-y", `${sourceRect.top + sourceRect.height * sourceY - arenaRect.top}px`);
    slash.style.setProperty("--serpen-facing", sourceX < targetX ? 1 : -1);
    const mountedSlash = appendEffectElement(arena, slash);
    registerTimeout(window.setTimeout(() => mountedSlash.remove(), WANING_LIFETIME_MS));
  }

  function mountFullMoonSurge(effect, stageForSide, appendEffectElement, registerTimeout) {
    const targetStage = stageForSide(effect.side);
    if (!targetStage) return;
    const moon = document.createElement("span");
    moon.className = "battle-fx-serpen-full-moon-surge";
    moon.dataset.characterBattleEffect = CHARACTER_ID;
    moon.dataset.sourceSide = effect.sourceSide;
    moon.dataset.targetSide = effect.side;
    for (const half of ["left", "right"]) {
      const piece = document.createElement("span");
      piece.className = `battle-fx-serpen-full-moon-half battle-fx-serpen-full-moon-half-${half}`;
      moon.append(piece);
    }
    const mountedMoon = appendEffectElement(targetStage, moon);
    registerTimeout(window.setTimeout(() => mountedMoon.remove(), FULL_MOON_LIFETIME_MS));
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type === "serpen-phase-change") {
      mountPhaseMarker(effect, stageForSide, appendEffectElement, registerTimeout);
      return true;
    }
    if (effect.type === "serpen-half-moon-dance") {
      mountHalfMoonDance(effect, stageForSide, appendEffectElement, registerTimeout);
      return true;
    }
    if (effect.type === "serpen-rising-trajectory-cast") {
      mountRisingTrajectory(effect, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(effect, "serpen-rising-trajectory-impact", RISING_IMPACT_DELAY_MS, registerTimeout, playLogEffect);
      return true;
    }
    if (effect.type === "serpen-waning-carve-cast") {
      mountWaningCarve(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(effect, "serpen-waning-carve-impact", WANING_IMPACT_DELAY_MS, registerTimeout, playLogEffect);
      return true;
    }
    if (effect.type === "serpen-full-moon-surge-cast") {
      mountFullMoonSurge(effect, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(effect, "serpen-full-moon-surge-impact", FULL_MOON_IMPACT_DELAY_MS, registerTimeout, playLogEffect);
      return true;
    }
    return false;
  }

  registry.register(CHARACTER_ID, {
    effectTypes: [
      "serpen-phase-change",
      "serpen-half-moon-dance",
      "serpen-rising-trajectory-cast",
      "serpen-rising-trajectory-impact",
      "serpen-waning-carve-cast",
      "serpen-waning-carve-impact",
      "serpen-full-moon-surge-cast",
      "serpen-full-moon-surge-impact",
    ],
    sfx: {
      "serpen-phase-change": "/assets/sfx/buff.wav",
      "serpen-half-moon-dance": "/assets/sfx/buff.wav",
      "serpen-rising-trajectory-impact": "/assets/sfx/hit.wav",
      "serpen-waning-carve-impact": "/assets/sfx/hit.wav",
      "serpen-full-moon-surge-impact": "/assets/sfx/hit.wav",
    },
    action,
    phaseChange,
    damage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
