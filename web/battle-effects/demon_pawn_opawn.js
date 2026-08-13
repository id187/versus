"use strict";

(function registerDemonPawnOpawnBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before Opawn effects.");

  const CHARACTER_ID = "demon_pawn_opawn";
  const MARCH_ACTION_NAME = "회창의 진군";
  const PROMOTION_ACTION_NAME = "흑백의 승급";
  const MERIT_ACTION_NAME = "무채의 공훈";
  const MARCH_LIFETIME_MS = 460;
  const PROMOTION_LIFETIME_MS = 940;

  function attackEffect({
    actionName,
    actorName,
    actorSide,
    targetName,
    targetSide,
    value,
    makeLogEffect,
  }) {
    const isMarch = actionName === MARCH_ACTION_NAME;
    const isMerit = actionName === MERIT_ACTION_NAME;
    if (!isMarch && !isMerit) return undefined;
    const effect = makeLogEffect(
      isMarch ? "opawn-gray-lance-march" : "opawn-colorless-merit-impact",
      targetName,
      actorName,
      isMarch ? null : value,
      targetSide,
      actorSide,
    );
    if (!effect) return null;
    if (isMerit) return { ...effect, damageValue: true };
    return {
      ...effect,
      damageValue: false,
      damageType: "opawn-gray-lance-march-damage",
      damageAmount: value,
    };
  }

  function damage(payload) {
    if (!(payload.damage > 0)) return null;
    return attackEffect({
      ...payload,
      value: payload.damage,
    });
  }

  function statEffect({ actionName, actorName, actorSide, stat, makeLogEffect }) {
    if (actionName !== PROMOTION_ACTION_NAME || stat !== "atk") return undefined;
    return makeLogEffect(
      "opawn-black-white-promotion",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  function mount(parent, className, effect, appendEffectElement, registerTimeout, lifetime) {
    const element = document.createElement("span");
    element.className = className;
    element.dataset.characterBattleEffect = CHARACTER_ID;
    const mounted = appendEffectElement(parent, element);
    registerTimeout(window.setTimeout(() => mounted.remove(), lifetime));
    return element;
  }

  function playMarch(effect, helpers) {
    const {
      arena,
      stageForSide,
      appendEffectElement,
      registerTimeout,
      playLogEffect,
    } = helpers;
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);
    if (arena && sourceStage && targetStage) {
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
      const distance = Math.hypot(endX - startX, endY - startY);
      const pierce = mount(
        arena,
        "battle-fx-opawn-gray-lance-march-pierce",
        effect,
        appendEffectElement,
        registerTimeout,
        MARCH_LIFETIME_MS,
      );
      pierce.dataset.sourceSide = effect.sourceSide;
      pierce.dataset.targetSide = effect.side;
      pierce.style.setProperty("--opawn-pierce-x", `${startX}px`);
      pierce.style.setProperty("--opawn-pierce-y", `${startY}px`);
      pierce.style.setProperty("--opawn-pierce-width", `${distance + targetRect.width * 0.42}px`);
      pierce.style.setProperty(
        "--opawn-pierce-height",
        `${Math.max(110, Math.min(160, targetRect.width * 0.72))}px`,
      );
      pierce.style.setProperty("--opawn-pierce-angle", `${angle}rad`);
      pierce.style.setProperty("--opawn-pierce-direction", direction);
    }

    const { damageType, damageAmount, ...baseEffect } = effect;
    playLogEffect({
      ...baseEffect,
      type: damageType,
      value: damageAmount,
      damageValue: true,
    });
    return true;
  }

  function playPromotion(effect, helpers) {
    const { stageForSide, appendEffectElement, registerTimeout } = helpers;
    const stage = stageForSide(effect.side);
    if (!stage) return true;
    mount(
      stage,
      "battle-fx-opawn-promotion-pawn",
      effect,
      appendEffectElement,
      registerTimeout,
      PROMOTION_LIFETIME_MS,
    );
    mount(
      stage,
      "battle-fx-opawn-promotion-queen",
      effect,
      appendEffectElement,
      registerTimeout,
      PROMOTION_LIFETIME_MS,
    );
    return true;
  }

  function playEffect(effect, helpers) {
    const appendEffectElement = helpers.appendEffectElement
      || ((parent, element) => { parent.append(element); return element; });
    const normalizedHelpers = { ...helpers, appendEffectElement };
    if (effect.type === "opawn-gray-lance-march") return playMarch(effect, normalizedHelpers);
    if (effect.type === "opawn-black-white-promotion") return playPromotion(effect, normalizedHelpers);
    return false;
  }

  registry.register(CHARACTER_ID, {
    effectTypes: [
      "opawn-gray-lance-march",
      "opawn-gray-lance-march-damage",
      "opawn-black-white-promotion",
      "opawn-colorless-merit-impact",
    ],
    sfx: {
      "opawn-gray-lance-march-damage": "/assets/sfx/hit.wav",
      "opawn-black-white-promotion": "/assets/sfx/buff.wav",
      "opawn-colorless-merit-impact": "/assets/sfx/hit.wav",
    },
    damage,
    statEffect,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
