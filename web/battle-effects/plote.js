"use strict";

(function registerPloteBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before plote effects.");

  const CHARACTER_ID = "plote";
  const FIREBALL_ACTION_NAME = "화염탄";
  const BLOCKING_FLAMES_ACTION_NAME = "가로막는 불길";
  const EMBER_DETONATION_ACTION_NAME = "잔화기폭";
  const INFERNO_LOTUS_ACTION_NAME = "연옥의 꽃";
  const PROJECTILE_IMPACT_DELAY_MS = 110;
  const PROJECTILE_LIFETIME_MS = 200;
  function action({ actionName }) {
    return actionName === BLOCKING_FLAMES_ACTION_NAME ? null : undefined;
  }

  function cost({ actionName, actorName, actorSide, beforeMp, afterMp, isActionCost, makeLogEffect }) {
    return undefined;
  }

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== BLOCKING_FLAMES_ACTION_NAME) return undefined;
    return makeLogEffect("blocking-flames", actorName, actorName, null, actorSide, actorSide);
  }

  function statusDamage({ statusName, targetName, targetSide, damage, makeLogEffect }) {
    if (statusName !== "화상") return undefined;
    if (!(damage > 0)) return null;
    const effect = makeLogEffect("burn-tick", targetName, targetName, damage, targetSide, targetSide);
    return effect ? { ...effect, damageValue: true } : null;
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if ([FIREBALL_ACTION_NAME, INFERNO_LOTUS_ACTION_NAME].includes(actionName)) {
      if (!(damage > 0)) return null;
      const isLotus = actionName === INFERNO_LOTUS_ACTION_NAME;
      const effect = makeLogEffect(
        isLotus ? "inferno-lotus-seed" : "fireball-flight",
        targetName,
        actorName,
        null,
        targetSide,
        actorSide,
      );
        return effect ? {
          ...effect,
          damageValue: false,
          impactDelayMs: PROJECTILE_IMPACT_DELAY_MS,
          impactValue: damage,
        impactDamageValue: true,
      } : null;
    }
    if (actionName === EMBER_DETONATION_ACTION_NAME) {
      if (!(damage > 0)) return null;
      const effect = makeLogEffect("ember-detonation-blast", targetName, actorName, damage, targetSide, actorSide);
      return effect ? { ...effect, damageValue: true } : null;
    }
    return undefined;
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type === "ember-detonation-blast") {
      const targetStage = stageForSide(effect.side);
      if (!targetStage) return false;
      const burst = document.createElement("span");
      burst.className = "battle-fx-ember-detonation-cross";
      burst.dataset.characterBattleEffect = CHARACTER_ID;
      const mountedBurst = appendEffectElement(targetStage, burst);
      registerTimeout(window.setTimeout(() => mountedBurst.remove(), 820));
      return false;
    }
    if (!["fireball-flight", "inferno-lotus-seed"].includes(effect.type)) return false;
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);
    if (!arena || !sourceStage || !targetStage) return true;

    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const startX = sourceRect.left + sourceRect.width / 2 - arenaRect.left;
    const startY = sourceRect.top + sourceRect.height / 2 - arenaRect.top;
    const endX = targetRect.left + targetRect.width / 2 - arenaRect.left;
    const isLotusSeed = effect.type.startsWith("inferno-lotus-seed");
    const endY = targetRect.top + targetRect.height * (isLotusSeed ? 0.84 : 0.5) - arenaRect.top;
    const horizontalDirection = endX >= startX ? 1 : -1;
    const angle = Math.atan2(endY - startY, Math.abs(endX - startX)) * horizontalDirection;

    const projectile = document.createElement("span");
    projectile.className = isLotusSeed
      ? "battle-fx-inferno-lotus-seed"
      : "battle-fx-fireball-flight";
    projectile.dataset.characterBattleEffect = CHARACTER_ID;
    projectile.dataset.sourceSide = effect.sourceSide;
    projectile.dataset.targetSide = effect.side;
    projectile.style.setProperty("--fireball-start-x", `${startX}px`);
    projectile.style.setProperty("--fireball-start-y", `${startY}px`);
    projectile.style.setProperty("--fireball-end-x", `${endX}px`);
    projectile.style.setProperty("--fireball-end-y", `${endY}px`);
    projectile.style.setProperty("--fireball-angle", `${angle}rad`);
    projectile.style.setProperty("--fireball-flip", horizontalDirection);
    const mountedProjectile = appendEffectElement(arena, projectile);
    registerTimeout(window.setTimeout(() => mountedProjectile.remove(), PROJECTILE_LIFETIME_MS));
    const {
      impactValue,
      impactDamageValue,
      ...baseEffect
    } = effect;
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type: isLotusSeed ? "inferno-lotus-bloom" : "fireball-impact",
      value: impactValue,
      damageValue: Boolean(impactDamageValue),
    }), PROJECTILE_IMPACT_DELAY_MS));
    return true;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: ["화상"],
    effectTypes: [
      "fireball-flight",
      "fireball-impact",
      "burn-tick",
      "blocking-flames",
      "ember-detonation-blast",
      "inferno-lotus-seed",
      "inferno-lotus-bloom",
    ],
    sfx: {
      "fireball-impact": "/assets/sfx/hit.wav",
      "burn-tick": "/assets/sfx/hit.wav",
      "blocking-flames": "/assets/sfx/defense.wav",
      "ember-detonation-blast": "/assets/sfx/hit.wav",
      "inferno-lotus-bloom": "/assets/sfx/hit.wav",
    },
    action,
    cost,
    success,
    damage,
    statusDamage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
