"use strict";

(function registerKarossyBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before karossy effects.");

  const CHARACTER_ID = "karossy";
  const THUNDER_ACTION_NAME = "우르릉 쾅쾅";
  const CLOUDY_ACTION_NAME = "구물구물";
  const SUNNY_ACTION_NAME = "쨍쨍";
  const WEATHER_BOMB_ACTION_NAME = "대기상 폭탄";
  const THUNDER_LIFETIME_MS = 460;
  const BOMB_IMPACT_DELAY_MS = 520;
  const BOMB_LIFETIME_MS = 680;
  const WEATHER_SLUGS = Object.freeze({
    "천둥": "thunder",
    "흐림": "cloudy",
    "맑음": "sunny",
  });

  function weatherFromBattle(battle, actorSide) {
    const fighter = battle?.[actorSide];
    const stateText = String(fighter?.status_text || fighter?.stateText || "");
    for (const [weather, slug] of Object.entries(WEATHER_SLUGS)) {
      if (stateText.includes(`예보 ${weather}`)) return slug;
    }
    return "sunny";
  }

  function damage({
    actionName,
    actorName,
    actorSide,
    targetName,
    targetSide,
    damage: damageValue,
    battle,
    makeLogEffect,
  }) {
    const damage = Number(damageValue);
    if (!(damage > 0)) return null;

    if (actionName === THUNDER_ACTION_NAME) {
      const effect = makeLogEffect(
        "thunder-crash-cast",
        targetName,
        actorName,
        null,
        targetSide,
        actorSide,
      );
      return effect ? {
        ...effect,
        damageValue: false,
        impactValue: damage,
        impactDamageValue: true,
      } : null;
    }

    if (actionName !== WEATHER_BOMB_ACTION_NAME) return undefined;
    const effect = makeLogEffect(
      "weather-bomb-cast",
      targetName,
      actorName,
      null,
      targetSide,
      actorSide,
    );
    return effect ? {
      ...effect,
      damageValue: false,
      impactDelayMs: BOMB_IMPACT_DELAY_MS,
      impactValue: damage,
      impactDamageValue: true,
      weather: weatherFromBattle(battle, actorSide),
    } : null;
  }

  function statEffect({
    actionName,
    actorName,
    actorSide,
    targetName,
    targetSide,
    stat,
    makeLogEffect,
  }) {
    if (actionName !== CLOUDY_ACTION_NAME || stat !== "atk") return undefined;
    const effect = makeLogEffect(
      "cloudy-fog",
      targetName || actorName,
      actorName,
      "ATK",
      targetSide || actorSide,
      actorSide,
    );
    return effect ? { ...effect, valueKind: "buff" } : null;
  }

  function heal({
    actionName,
    actorName,
    actorSide,
    targetName,
    targetSide,
    amount: amountValue,
    makeLogEffect,
  }) {
    const amount = Number(amountValue);
    if (actionName !== SUNNY_ACTION_NAME) return undefined;
    if (!(amount > 0)) return null;
    const effect = makeLogEffect(
      "sunshine",
      targetName || actorName,
      actorName,
      amount,
      targetSide || actorSide,
      actorSide,
    );
    return effect ? { ...effect, valueKind: "hp-gain" } : null;
  }

  function appendThunderBurst(effect, arena, sourceStage, targetStage, appendEffectElement, registerTimeout) {
    if (!arena || !sourceStage || !targetStage) return;
    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
    const sourceCenterX = sourceRect.left + sourceRect.width * 0.5 - arenaRect.left;
    const targetCenterX = targetRect.left + targetRect.width * 0.5 - arenaRect.left;
    const horizontalDirection = targetCenterX >= sourceCenterX ? 1 : -1;
    const startX = sourceRect.left
      + sourceRect.width * (horizontalDirection > 0 ? 0.64 : 0.36)
      - arenaRect.left;
    const startY = sourceRect.top + sourceRect.height * 0.48 - arenaRect.top;
    const endX = targetCenterX;
    const endY = targetRect.top + targetRect.height * targetBodyY - arenaRect.top;
    const distance = Math.hypot(endX - startX, endY - startY);
    const angle = Math.atan2(endY - startY, Math.abs(endX - startX)) * horizontalDirection;

    const burst = document.createElement("span");
    burst.className = "battle-fx-thunder-crash-beam";
    burst.dataset.characterBattleEffect = CHARACTER_ID;
    burst.dataset.sourceSide = effect.sourceSide;
    burst.dataset.targetSide = effect.side;
    burst.style.setProperty("--karossy-thunder-x", `${startX}px`);
    burst.style.setProperty("--karossy-thunder-y", `${startY}px`);
    burst.style.setProperty("--karossy-thunder-width", `${distance}px`);
    burst.style.setProperty("--karossy-thunder-angle", `${angle}rad`);
    burst.style.setProperty("--karossy-thunder-flip", horizontalDirection);
    const mountedBurst = appendEffectElement(arena, burst);
    registerTimeout(window.setTimeout(() => mountedBurst.remove(), THUNDER_LIFETIME_MS));
  }

  function appendWeatherBomb(effect, arena, sourceStage, targetStage, appendEffectElement, registerTimeout) {
    if (!arena || !sourceStage || !targetStage) return;
    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
    const sourceCenterX = sourceRect.left + sourceRect.width * 0.5 - arenaRect.left;
    const endX = targetRect.left + targetRect.width * 0.5 - arenaRect.left;
    const horizontalDirection = endX >= sourceCenterX ? 1 : -1;
    const startX = sourceRect.left
      + sourceRect.width * (horizontalDirection > 0 ? 0.64 : 0.36)
      - arenaRect.left;
    const startY = sourceRect.top + sourceRect.height * 0.44 - arenaRect.top;
    const endY = targetRect.top + targetRect.height * targetBodyY - arenaRect.top;
    const midX = (startX + endX) / 2;
    const arcHeight = Math.max(72, Math.min(165, Math.abs(endX - startX) * 0.25));
    const midY = Math.min(startY, endY) - arcHeight;

    const bomb = document.createElement("span");
    bomb.className = "battle-fx-weather-bomb-projectile";
    bomb.dataset.characterBattleEffect = CHARACTER_ID;
    bomb.dataset.sourceSide = effect.sourceSide;
    bomb.dataset.targetSide = effect.side;
    bomb.dataset.weather = effect.weather;
    bomb.style.setProperty("--karossy-bomb-start-x", `${startX}px`);
    bomb.style.setProperty("--karossy-bomb-start-y", `${startY}px`);
    bomb.style.setProperty("--karossy-bomb-mid-x", `${midX}px`);
    bomb.style.setProperty("--karossy-bomb-mid-y", `${midY}px`);
    bomb.style.setProperty("--karossy-bomb-end-x", `${endX}px`);
    bomb.style.setProperty("--karossy-bomb-end-y", `${endY}px`);
    bomb.style.setProperty("--karossy-bomb-flip", horizontalDirection);
    bomb.style.setProperty("--karossy-bomb-rotation-start", `${-16 * horizontalDirection}deg`);
    bomb.style.setProperty("--karossy-bomb-rotation-mid", `${18 * horizontalDirection}deg`);
    bomb.style.setProperty("--karossy-bomb-rotation-end", `${54 * horizontalDirection}deg`);
    const mountedBomb = appendEffectElement(arena, bomb);
    registerTimeout(window.setTimeout(() => mountedBomb.remove(), BOMB_LIFETIME_MS));
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type === "thunder-crash-cast") {
      const {
        impactValue,
        impactDamageValue,
        delayMs: _delayMs,
        ...baseEffect
      } = effect;
      appendThunderBurst(
        effect,
        arena,
        stageForSide(effect.sourceSide),
        stageForSide(effect.side),
        appendEffectElement,
        registerTimeout,
      );
      playLogEffect({
        ...baseEffect,
        type: "thunder-crash-impact",
        value: impactValue,
        damageValue: Boolean(impactDamageValue),
      });
      return true;
    }

    if (effect.type !== "weather-bomb-cast") return false;
    const {
      impactDelayMs: _impactDelayMs,
      impactValue,
      impactDamageValue,
      weather = "sunny",
      delayMs: _delayMs,
      ...baseEffect
    } = effect;
    appendWeatherBomb(
      effect,
      arena,
      stageForSide(effect.sourceSide),
      stageForSide(effect.side),
      appendEffectElement,
      registerTimeout,
    );
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type: `weather-bomb-${weather}-impact`,
      value: impactValue,
      damageValue: Boolean(impactDamageValue),
    }), BOMB_IMPACT_DELAY_MS));
    return true;
  }

  registry.register(CHARACTER_ID, {
    effectTypes: [
      "thunder-crash-cast",
      "thunder-crash-impact",
      "cloudy-fog",
      "sunshine",
      "weather-bomb-cast",
      "weather-bomb-thunder-impact",
      "weather-bomb-cloudy-impact",
      "weather-bomb-sunny-impact",
    ],
    sfx: {
      "thunder-crash-impact": "/assets/sfx/hit.wav",
      "cloudy-fog": "/assets/sfx/buff.wav",
      sunshine: "/assets/sfx/heal.wav",
      "weather-bomb-thunder-impact": "/assets/sfx/hit.wav",
      "weather-bomb-cloudy-impact": "/assets/sfx/hit.wav",
      "weather-bomb-sunny-impact": "/assets/sfx/hit.wav",
    },
    damage,
    statEffect,
    heal,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
