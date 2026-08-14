"use strict";

(function registerWindayBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before winday effects.");

  const CHARACTER_ID = "winday";
  const GALE_STATUS_NAME = "선풍";
  const WIND_BORNE_MACE_ACTION_NAME = "바람을 탄 철퇴";
  const GALE_BLADE_BULWARK_ACTION_NAME = "칼바람 방벽";
  const FIERCE_WHIRLWIND_ACTION_NAME = "세찬 소용돌이";
  const PATH_OPENING_GALE_ACTION_NAME = "길을 뚫는 강풍";
  const PATH_OPENING_IMPACT_DELAY_MS = 340;
  const PATH_OPENING_PROJECTILE_LIFETIME_MS = 440;
  const DAMAGE_EFFECT_TYPES = Object.freeze({
    [WIND_BORNE_MACE_ACTION_NAME]: "winday-windborne-mace-impact",
    [FIERCE_WHIRLWIND_ACTION_NAME]: "winday-fierce-whirlwind-impact",
    [PATH_OPENING_GALE_ACTION_NAME]: "winday-path-opening-gale-flight",
  });

  function counterChange({ statusName, targetName, targetSide, before, after, makeLogEffect }) {
    const beforeValue = Number(before);
    const afterValue = Number(after);
    if (statusName !== GALE_STATUS_NAME || !(afterValue > beforeValue)) return undefined;
    const effect = makeLogEffect(
      "winday-gale-stack-breeze",
      targetName,
      targetName,
      `${GALE_STATUS_NAME}+${afterValue - beforeValue}`,
      targetSide,
      targetSide,
    );
    return effect ? { ...effect, valueKind: "stack-gain" } : null;
  }

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== GALE_BLADE_BULWARK_ACTION_NAME) return undefined;
    return makeLogEffect(
      "winday-gale-blade-bulwark",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage: rawDamage, makeLogEffect }) {
    const type = DAMAGE_EFFECT_TYPES[actionName];
    if (!type) return undefined;
    const damageValue = Number(rawDamage);
    if (!(damageValue > 0)) return null;

    if (actionName === PATH_OPENING_GALE_ACTION_NAME) {
      const effect = makeLogEffect(type, targetName, actorName, null, targetSide, actorSide);
      return effect ? {
        ...effect,
        damageValue: false,
        impactDelayMs: PATH_OPENING_IMPACT_DELAY_MS,
        impactValue: damageValue,
        impactDamageValue: true,
      } : null;
    }

    const effect = makeLogEffect(type, targetName, actorName, damageValue, targetSide, actorSide);
    return effect ? { ...effect, damageValue: true } : null;
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
      startX: sourceRect.left + sourceRect.width * 0.5 - arenaRect.left,
      startY: sourceRect.top + sourceRect.height * sourceBodyY - arenaRect.top,
      endX: targetRect.left + targetRect.width * 0.5 - arenaRect.left,
      endY: targetRect.top + targetRect.height * targetBodyY - arenaRect.top,
    };
  }

  function mountPathOpeningGale(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const geometry = arenaGeometry(effect, arena, stageForSide);
    if (!geometry) return;
    const { startX, startY, endX, endY } = geometry;
    const direction = endX >= startX ? 1 : -1;
    const angle = Math.atan2(endY - startY, Math.abs(endX - startX)) * direction;
    const projectile = document.createElement("span");
    projectile.className = "battle-fx-winday-path-opening-gale-projectile";
    projectile.dataset.characterBattleEffect = CHARACTER_ID;
    projectile.dataset.sourceSide = effect.sourceSide;
    projectile.dataset.targetSide = effect.side;
    projectile.style.setProperty("--winday-start-x", `${startX}px`);
    projectile.style.setProperty("--winday-start-y", `${startY}px`);
    projectile.style.setProperty("--winday-end-x", `${endX}px`);
    projectile.style.setProperty("--winday-end-y", `${endY}px`);
    projectile.style.setProperty("--winday-projectile-angle", `${angle}rad`);
    projectile.style.setProperty("--winday-projectile-flip", direction);
    const mountedProjectile = appendEffectElement(arena, projectile);
    registerTimeout(window.setTimeout(
      () => mountedProjectile.remove(),
      PATH_OPENING_PROJECTILE_LIFETIME_MS,
    ));
  }

  function schedulePathOpeningImpact(effect, registerTimeout, playLogEffect) {
    const {
      impactDelayMs,
      impactValue,
      impactDamageValue,
      delayMs: _delayMs,
      ...baseEffect
    } = effect;
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type: "winday-path-opening-gale-impact",
      value: impactValue,
      damageValue: Boolean(impactDamageValue),
    }), Number(impactDelayMs) || PATH_OPENING_IMPACT_DELAY_MS));
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type !== "winday-path-opening-gale-flight") return false;
    mountPathOpeningGale(effect, arena, stageForSide, appendEffectElement, registerTimeout);
    schedulePathOpeningImpact(effect, registerTimeout, playLogEffect);
    return true;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: [GALE_STATUS_NAME],
    effectTypes: [
      "winday-gale-stack-breeze",
      "winday-windborne-mace-impact",
      "winday-gale-blade-bulwark",
      "winday-fierce-whirlwind-impact",
      "winday-path-opening-gale-flight",
      "winday-path-opening-gale-impact",
    ],
    sfx: {
      "winday-gale-stack-breeze": "/assets/sfx/stack-gain.wav",
      "winday-windborne-mace-impact": "/assets/sfx/hit.wav",
      "winday-gale-blade-bulwark": "/assets/sfx/defense.wav",
      "winday-fierce-whirlwind-impact": "/assets/sfx/hit.wav",
      "winday-path-opening-gale-impact": "/assets/sfx/hit.wav",
    },
    counterChange,
    success,
    damage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
