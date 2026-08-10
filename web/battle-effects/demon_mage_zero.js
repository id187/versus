"use strict";

(function registerDemonMageZeroBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before Zero effects.");

  const CHARACTER_ID = "demon_mage_zero";
  const ATTACK_ACTION_NAME = "백광의 마탄";
  const UTILITY_ACTION_NAME = "회백의 역장";
  const FLIGHT_MS = 240;
  const IMPACT_MS = 190;

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== UTILITY_ACTION_NAME) return undefined;
    return makeLogEffect("zero-gray-force-field", actorName, actorName, null, actorSide, actorSide);
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (actionName !== ATTACK_ACTION_NAME) return undefined;
    if (!(damage > 0)) return null;
    const effect = makeLogEffect("zero-white-magic-bullet", targetName, actorName, null, targetSide, actorSide);
    return effect ? { ...effect, damageValue: false, impactValue: damage } : null;
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type !== "zero-white-magic-bullet") return false;
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);
    if (!arena || !sourceStage || !targetStage) return true;

    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const startX = sourceRect.left + sourceRect.width / 2 - arenaRect.left;
    const startY = sourceRect.top + sourceRect.height * 0.48 - arenaRect.top;
    const endX = targetRect.left + targetRect.width / 2 - arenaRect.left;
    const endY = targetRect.top + targetRect.height * 0.48 - arenaRect.top;
    const direction = endX >= startX ? 1 : -1;
    const angle = Math.atan2(endY - startY, Math.abs(endX - startX)) * direction;

    const projectile = document.createElement("span");
    projectile.className = "battle-fx-zero-white-magic-bullet-projectile";
    projectile.dataset.characterBattleEffect = CHARACTER_ID;
    projectile.style.setProperty("--zero-start-x", `${startX}px`);
    projectile.style.setProperty("--zero-start-y", `${startY}px`);
    projectile.style.setProperty("--zero-end-x", `${endX}px`);
    projectile.style.setProperty("--zero-end-y", `${endY}px`);
    projectile.style.setProperty("--zero-angle", `${angle}rad`);
    projectile.style.setProperty("--zero-direction", direction);
    const mountedProjectile = appendEffectElement(arena, projectile);
    registerTimeout(window.setTimeout(() => mountedProjectile.remove(), FLIGHT_MS + 40));

    const { impactValue, ...baseEffect } = effect;
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type: "zero-white-magic-impact",
      value: impactValue,
      damageValue: true,
    }), IMPACT_MS));
    return true;
  }

  registry.register(CHARACTER_ID, {
    effectTypes: ["zero-white-magic-bullet", "zero-white-magic-impact", "zero-gray-force-field"],
    sfx: {
      "zero-white-magic-impact": "/assets/sfx/hit.wav",
      "zero-gray-force-field": "/assets/sfx/defense.wav",
    },
    success,
    damage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
