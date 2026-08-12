"use strict";

(function registerDemonArcherRobinBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before Robin effects.");

  const CHARACTER_ID = "demon_archer_robin";
  const ATTACK_ACTION_NAME = "백은의 관통시";
  const UTILITY_ACTION_NAME = "회영의 엄폐";
  const FLIGHT_MS = 280;
  const IMPACT_MS = 225;

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== UTILITY_ACTION_NAME) return undefined;
    return makeLogEffect("robin-gray-shadow-cover", actorName, actorName, null, actorSide, actorSide);
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (actionName !== ATTACK_ACTION_NAME) return undefined;
    if (!(damage > 0)) return null;
    const effect = makeLogEffect("robin-silver-piercing-arrow", targetName, actorName, null, targetSide, actorSide);
    return effect ? { ...effect, damageValue: false, impactValue: damage } : null;
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type !== "robin-silver-piercing-arrow") return false;
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);
    if (!arena || !sourceStage || !targetStage) return true;

    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const sourceBodyY = registry.stagePercent(sourceStage, "--fx-body-y", 0.5);
    const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
    const startX = sourceRect.left + sourceRect.width / 2 - arenaRect.left;
    const startY = sourceRect.top + sourceRect.height * sourceBodyY - arenaRect.top;
    const endX = targetRect.left + targetRect.width / 2 - arenaRect.left;
    const endY = targetRect.top + targetRect.height * targetBodyY - arenaRect.top;
    const direction = endX >= startX ? 1 : -1;
    const angle = Math.atan2(endY - startY, Math.abs(endX - startX)) * direction;

    const projectile = document.createElement("span");
    projectile.className = "battle-fx-robin-silver-piercing-arrow-projectile";
    projectile.dataset.characterBattleEffect = CHARACTER_ID;
    projectile.style.setProperty("--robin-start-x", `${startX}px`);
    projectile.style.setProperty("--robin-start-y", `${startY}px`);
    projectile.style.setProperty("--robin-end-x", `${endX}px`);
    projectile.style.setProperty("--robin-end-y", `${endY}px`);
    projectile.style.setProperty("--robin-angle", `${angle}rad`);
    projectile.style.setProperty("--robin-direction", direction);
    const mountedProjectile = appendEffectElement(arena, projectile);
    registerTimeout(window.setTimeout(() => mountedProjectile.remove(), FLIGHT_MS + 40));

    const { impactValue, ...baseEffect } = effect;
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type: "robin-silver-piercing-impact",
      value: impactValue,
      damageValue: true,
    }), IMPACT_MS));
    return true;
  }

  registry.register(CHARACTER_ID, {
    effectTypes: ["robin-silver-piercing-arrow", "robin-silver-piercing-impact", "robin-gray-shadow-cover"],
    sfx: {
      "robin-silver-piercing-impact": "/assets/sfx/hit.wav",
      "robin-gray-shadow-cover": "/assets/sfx/defense.wav",
    },
    success,
    damage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
