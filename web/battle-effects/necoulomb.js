"use strict";

(function registerNecoulombBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before necoulomb effects.");

  const CHARACTER_ID = "necoulomb";
  const NEGATIVE_STATUS_NAME = "음전";
  const CHARGE_RELEASE_ACTION_NAME = "전하 방출";
  const REVERSE_CURRENT_ACTION_NAME = "역류하는 힘";
  const NOTHING_TO_NEGATIVE_ACTION_NAME = "무에서 음으로";
  const FULL_DISCHARGE_ACTION_NAME = "완전 방전";
  const CHARGE_IMPACT_DELAY_MS = 300;
  const CHARGE_PROJECTILE_LIFETIME_MS = 390;
  const BEAM_IMPACT_DELAY_MS = 260;
  const BEAM_LIFETIME_MS = 520;
  const FULL_DISCHARGE_IMPACT_DELAY_MS = 620;
  const FULL_DISCHARGE_LIFETIME_MS = 940;

  function counterChange({ statusName, line, targetName, targetSide, before, after, makeLogEffect }) {
    if (statusName !== NEGATIVE_STATUS_NAME || after <= before) return undefined;
    if (String(line || "").includes("(완전 방전)")) return null;
    const effect = makeLogEffect(
      "negative-charge-gain",
      targetName,
      targetName,
      `${NEGATIVE_STATUS_NAME}+${after - before}`,
      targetSide,
      targetSide,
    );
    return effect ? { ...effect, valueKind: "stack-gain" } : null;
  }

  function statEffect({ actionName, actorName, actorSide, targetName, stat, multiplier, makeLogEffect }) {
    if (
      actionName !== REVERSE_CURRENT_ACTION_NAME
      || targetName !== actorName
      || stat !== "atk"
      || Number(multiplier) !== 1.3
    ) return undefined;
    return makeLogEffect(
      "reverse-current-power",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage: rawDamage, makeLogEffect }) {
    const damageValue = Number(rawDamage);
    if (![CHARGE_RELEASE_ACTION_NAME, NOTHING_TO_NEGATIVE_ACTION_NAME, FULL_DISCHARGE_ACTION_NAME].includes(actionName)) {
      return undefined;
    }
    if (!(damageValue > 0)) return null;

    let type;
    let impactDelayMs;
    if (actionName === CHARGE_RELEASE_ACTION_NAME) {
      type = "charge-release-flight";
      impactDelayMs = CHARGE_IMPACT_DELAY_MS;
    } else if (actionName === NOTHING_TO_NEGATIVE_ACTION_NAME) {
      type = "nothing-to-negative-beam";
      impactDelayMs = BEAM_IMPACT_DELAY_MS;
    } else {
      type = "full-discharge-cast";
      impactDelayMs = FULL_DISCHARGE_IMPACT_DELAY_MS;
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

  function arenaGeometry(effect, arena, stageForSide) {
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);
    if (!arena || !sourceStage || !targetStage) return null;
    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const sourceBodyY = registry.stagePercent(sourceStage, "--fx-body-y", 0.5);
    const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
    return {
      sourceStage,
      startX: sourceRect.left + sourceRect.width * 0.5 - arenaRect.left,
      startY: sourceRect.top + sourceRect.height * sourceBodyY - arenaRect.top,
      endX: targetRect.left + targetRect.width * 0.5 - arenaRect.left,
      endY: targetRect.top + targetRect.height * targetBodyY - arenaRect.top,
    };
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

  function mountChargeRelease(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const geometry = arenaGeometry(effect, arena, stageForSide);
    if (!geometry) return;
    const { startX, startY, endX, endY } = geometry;
    const direction = endX >= startX ? 1 : -1;
    const angle = Math.atan2(endY - startY, Math.abs(endX - startX)) * direction;
    const projectile = document.createElement("span");
    projectile.className = "battle-fx-necoulomb-charge-release-projectile";
    projectile.dataset.characterBattleEffect = CHARACTER_ID;
    projectile.dataset.sourceSide = effect.sourceSide;
    projectile.dataset.targetSide = effect.side;
    projectile.style.setProperty("--necoulomb-start-x", `${startX}px`);
    projectile.style.setProperty("--necoulomb-start-y", `${startY}px`);
    projectile.style.setProperty("--necoulomb-end-x", `${endX}px`);
    projectile.style.setProperty("--necoulomb-end-y", `${endY}px`);
    projectile.style.setProperty("--necoulomb-projectile-angle", `${angle}rad`);
    projectile.style.setProperty("--necoulomb-projectile-flip", direction);
    const mountedProjectile = appendEffectElement(arena, projectile);
    registerTimeout(window.setTimeout(() => mountedProjectile.remove(), CHARGE_PROJECTILE_LIFETIME_MS));
  }

  function mountNegativeBeam(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const geometry = arenaGeometry(effect, arena, stageForSide);
    if (!geometry) return;
    const { startX, startY, endX, endY } = geometry;
    const direction = endX >= startX ? 1 : -1;
    const distance = Math.hypot(endX - startX, endY - startY);
    const angle = Math.atan2(endY - startY, Math.abs(endX - startX)) * direction;
    const beam = document.createElement("span");
    beam.className = "battle-fx-necoulomb-negative-beam";
    beam.dataset.characterBattleEffect = CHARACTER_ID;
    beam.dataset.sourceSide = effect.sourceSide;
    beam.dataset.targetSide = effect.side;
    beam.style.setProperty("--necoulomb-beam-x", `${(startX + endX) * 0.5}px`);
    beam.style.setProperty("--necoulomb-beam-y", `${(startY + endY) * 0.5}px`);
    beam.style.setProperty("--necoulomb-beam-width", `${Math.max(150, distance * 1.05)}px`);
    beam.style.setProperty("--necoulomb-beam-angle", `${angle}rad`);
    beam.style.setProperty("--necoulomb-beam-flip", direction);
    const mountedBeam = appendEffectElement(arena, beam);
    registerTimeout(window.setTimeout(() => mountedBeam.remove(), BEAM_LIFETIME_MS));
  }

  function mountFullDischarge(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const geometry = arenaGeometry(effect, arena, stageForSide);
    if (!geometry) return;
    const { startX, startY, endX, endY } = geometry;
    const targetDistance = Math.hypot(endX - startX, endY - startY);
    const wave = document.createElement("span");
    wave.className = "battle-fx-necoulomb-full-discharge-wave";
    wave.dataset.characterBattleEffect = CHARACTER_ID;
    wave.dataset.sourceSide = effect.sourceSide;
    wave.dataset.targetSide = effect.side;
    wave.style.setProperty("--necoulomb-discharge-x", `${startX}px`);
    wave.style.setProperty("--necoulomb-discharge-y", `${startY}px`);
    wave.style.setProperty("--necoulomb-discharge-size", `${Math.max(220, targetDistance * 2)}px`);
    const mountedWave = appendEffectElement(arena, wave);
    registerTimeout(window.setTimeout(() => mountedWave.remove(), FULL_DISCHARGE_LIFETIME_MS));
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type === "charge-release-flight") {
      mountChargeRelease(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(effect, "charge-release-impact", CHARGE_IMPACT_DELAY_MS, registerTimeout, playLogEffect);
      return true;
    }
    if (effect.type === "nothing-to-negative-beam") {
      mountNegativeBeam(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(effect, "nothing-to-negative-impact", BEAM_IMPACT_DELAY_MS, registerTimeout, playLogEffect);
      return true;
    }
    if (effect.type === "full-discharge-cast") {
      mountFullDischarge(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(effect, "full-discharge-impact", FULL_DISCHARGE_IMPACT_DELAY_MS, registerTimeout, playLogEffect);
      return true;
    }
    return false;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: [NEGATIVE_STATUS_NAME],
    effectTypes: [
      "negative-charge-gain",
      "reverse-current-power",
      "charge-release-flight",
      "charge-release-impact",
      "nothing-to-negative-beam",
      "nothing-to-negative-impact",
      "full-discharge-cast",
      "full-discharge-impact",
    ],
    sfx: {
      "negative-charge-gain": "/assets/sfx/buff.wav",
      "reverse-current-power": "/assets/sfx/buff.wav",
      "charge-release-impact": "/assets/sfx/hit.wav",
      "nothing-to-negative-impact": "/assets/sfx/hit.wav",
      "full-discharge-impact": "/assets/sfx/hit.wav",
    },
    counterChange,
    statEffect,
    damage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
