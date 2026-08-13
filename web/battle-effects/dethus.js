"use strict";

(function registerDethusBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before dethus effects.");

  const CHARACTER_ID = "dethus";
  const THIRST_STATUS_NAME = "갈증";
  const HARVEST_ACTION_NAME = "혼천 거두기";
  const QUICKSAND_ACTION_NAME = "빠져드는 모래늪";
  const MIRAGE_CURSE_ACTION_NAME = "신기루의 저주";
  const PARCHED_EARTH_ACTION_NAME = "말라붙는 대지";
  const HARVEST_LIFETIME_MS = 720;
  const CRACK_LIFETIME_MS = 720;
  const ERUPTION_DELAY_MS = 300;

  function statusDamage({ statusName, targetName, targetSide, damage, makeLogEffect }) {
    if (statusName !== THIRST_STATUS_NAME) return undefined;
    if (!(damage > 0)) return null;
    const effect = makeLogEffect(
      "dethus-thirst-sandstorm",
      targetName,
      targetName,
      damage,
      targetSide,
      targetSide,
    );
    return effect ? { ...effect, damageValue: true } : null;
  }

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== QUICKSAND_ACTION_NAME) return undefined;
    return makeLogEffect(
      "dethus-quicksand-guard",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage: rawDamage, makeLogEffect }) {
    const damageValue = Number(rawDamage);
    if (![HARVEST_ACTION_NAME, MIRAGE_CURSE_ACTION_NAME, PARCHED_EARTH_ACTION_NAME].includes(actionName)) {
      return undefined;
    }
    if (!(damageValue > 0)) return null;

    if (actionName === HARVEST_ACTION_NAME) {
      const effect = makeLogEffect(
        "dethus-harvest-soul",
        targetName,
        actorName,
        damageValue,
        targetSide,
        actorSide,
      );
      return effect ? { ...effect, damageValue: true } : null;
    }

    if (actionName === MIRAGE_CURSE_ACTION_NAME) {
      const effect = makeLogEffect(
        "dethus-mirage-curse",
        targetName,
        actorName,
        damageValue,
        targetSide,
        actorSide,
      );
      return effect ? { ...effect, damageValue: true } : null;
    }

    const effect = makeLogEffect(
      "dethus-parched-earth-crack",
      targetName,
      actorName,
      null,
      targetSide,
      actorSide,
    );
    return effect ? {
      ...effect,
      damageValue: false,
      impactValue: damageValue,
      impactDamageValue: true,
    } : null;
  }

  function mountHarvestSoul(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const targetStage = stageForSide(effect.side);
    const dethusStage = stageForSide(effect.sourceSide);
    if (!arena || !targetStage || !dethusStage) return false;

    const arenaRect = arena.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const dethusRect = dethusStage.getBoundingClientRect();
    const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
    const dethusBodyY = registry.stagePercent(dethusStage, "--fx-body-y", 0.5);
    const startX = targetRect.left + targetRect.width * 0.5 - arenaRect.left;
    const startY = targetRect.top + targetRect.height * targetBodyY - arenaRect.top;
    const endX = dethusRect.left + dethusRect.width * 0.5 - arenaRect.left;
    const endY = dethusRect.top + dethusRect.height * dethusBodyY - arenaRect.top;
    const direction = endX >= startX ? 1 : -1;

    const soul = document.createElement("span");
    soul.className = "battle-fx-dethus-harvest-soul-flight";
    soul.dataset.characterBattleEffect = CHARACTER_ID;
    soul.style.setProperty("--dethus-harvest-start-x", `${startX}px`);
    soul.style.setProperty("--dethus-harvest-start-y", `${startY}px`);
    soul.style.setProperty("--dethus-harvest-end-x", `${endX}px`);
    soul.style.setProperty("--dethus-harvest-end-y", `${endY}px`);
    soul.style.setProperty("--dethus-harvest-flip", direction < 0 ? 1 : -1);
    const mounted = appendEffectElement(arena, soul);
    registerTimeout(window.setTimeout(() => mounted.remove(), HARVEST_LIFETIME_MS));
    return true;
  }

  function mountParchedEarth(effect, stageForSide, appendEffectElement, registerTimeout, playLogEffect) {
    const targetStage = stageForSide(effect.side);
    if (!targetStage) return false;

    const crack = document.createElement("span");
    crack.className = "battle-fx-effect battle-fx-dethus-parched-earth-crack-stage";
    crack.dataset.characterBattleEffect = CHARACTER_ID;
    const mounted = appendEffectElement(targetStage, crack);
    registerTimeout(window.setTimeout(() => mounted.remove(), CRACK_LIFETIME_MS));

    const {
      characterEffectId: _characterEffectId,
      impactValue,
      impactDamageValue,
      ...baseEffect
    } = effect;
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      characterEffectId: CHARACTER_ID,
      type: "dethus-parched-earth-eruption",
      value: impactValue,
      damageValue: Boolean(impactDamageValue),
    }), ERUPTION_DELAY_MS));
    return true;
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type === "dethus-harvest-soul") {
      mountHarvestSoul(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      return false;
    }
    if (effect.type === "dethus-parched-earth-crack") {
      return mountParchedEarth(effect, stageForSide, appendEffectElement, registerTimeout, playLogEffect);
    }
    return false;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: [THIRST_STATUS_NAME],
    effectTypes: [
      "dethus-thirst-sandstorm",
      "dethus-harvest-soul",
      "dethus-quicksand-guard",
      "dethus-mirage-curse",
      "dethus-parched-earth-crack",
      "dethus-parched-earth-eruption",
    ],
    sfx: {
      "dethus-thirst-sandstorm": "/assets/sfx/hit.wav",
      "dethus-harvest-soul": "/assets/sfx/hit.wav",
      "dethus-quicksand-guard": "/assets/sfx/defense.wav",
      "dethus-mirage-curse": "/assets/sfx/hit.wav",
      "dethus-parched-earth-crack": "/assets/sfx/debuff.wav",
      "dethus-parched-earth-eruption": "/assets/sfx/hit.wav",
    },
    statusDamage,
    success,
    damage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
