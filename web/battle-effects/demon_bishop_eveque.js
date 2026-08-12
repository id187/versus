"use strict";

(function registerDemonBishopEvequeBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before Eveque effects.");

  const CHARACTER_ID = "demon_bishop_eveque";
  const REVELATION_ACTION_NAME = "백선의 계시";
  const SANCTUARY_ACTION_NAME = "회색의 성역";
  const CONDEMNATION_ACTION_NAME = "흑선의 단죄";
  const SANCTUARY_MARKER_SELECTOR = ".battle-fx-eveque-gray-sanctuary-marker";

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    const isRevelation = actionName === REVELATION_ACTION_NAME;
    const isCondemnation = actionName === CONDEMNATION_ACTION_NAME;
    if (!isRevelation && !isCondemnation) return undefined;
    if (!(damage > 0)) return null;
    const effect = makeLogEffect(
      isRevelation ? "eveque-white-revelation" : "eveque-black-condemnation",
      targetName,
      actorName,
      damage,
      targetSide,
      actorSide,
    );
    return effect ? { ...effect, damageValue: true } : null;
  }

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== SANCTUARY_ACTION_NAME) return undefined;
    return makeLogEffect(
      "eveque-gray-sanctuary-cast",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  function damageTaken({ targetName, targetSide, damage, makeLogEffect }) {
    if (!(damage > 0)) return null;
    return makeLogEffect(
      "eveque-gray-sanctuary-break",
      targetName,
      targetName,
      null,
      targetSide,
      targetSide,
    );
  }

  function heal({ targetName, targetSide, amount: amountValue, reason, makeLogEffect }) {
    if (reason !== SANCTUARY_ACTION_NAME) return undefined;
    const amount = Math.max(0, Number(amountValue) || 0);
    const effect = makeLogEffect(
      "eveque-gray-sanctuary-heal",
      targetName,
      targetName,
      amount > 0 ? amount : null,
      targetSide,
      targetSide,
    );
    return effect ? { ...effect, valueKind: amount > 0 ? "hp-gain" : "" } : null;
  }

  function markerMount(marker) {
    return marker?.parentElement?.classList?.contains("battle-fx-monochrome-layer")
      ? marker.parentElement
      : marker;
  }

  function playEffect(effect, {
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    const stage = stageForSide(effect.side);
    if (!stage) return false;

    if (effect.type === "eveque-gray-sanctuary-cast") {
      const previous = stage.querySelector(SANCTUARY_MARKER_SELECTOR);
      markerMount(previous)?.remove();
      const marker = document.createElement("span");
      marker.className = "battle-fx-eveque-gray-sanctuary-marker";
      marker.dataset.characterBattleEffect = CHARACTER_ID;
      marker.dataset.sanctuarySide = effect.side;
      appendEffectElement(stage, marker);
      return true;
    }

    const marker = stage.querySelector(SANCTUARY_MARKER_SELECTOR);
    if (effect.type === "eveque-gray-sanctuary-break") {
      if (marker) {
        marker.classList.add("is-breaking");
        const mount = markerMount(marker);
        registerTimeout(window.setTimeout(() => mount.remove(), 520));
      }
      return true;
    }

    if (effect.type !== "eveque-gray-sanctuary-heal") return false;
    if (marker) {
      marker.classList.add("is-healing");
      const mount = markerMount(marker);
      registerTimeout(window.setTimeout(() => mount.remove(), 720));
    }
    playLogEffect({
      type: "heal",
      side: effect.side,
      sourceSide: effect.sourceSide,
      value: effect.value,
      valueKind: effect.valueKind,
      color: effect.color,
    });
    return true;
  }

  registry.register(CHARACTER_ID, {
    effectTypes: [
      "eveque-white-revelation",
      "eveque-gray-sanctuary-cast",
      "eveque-gray-sanctuary-break",
      "eveque-gray-sanctuary-heal",
      "eveque-black-condemnation",
    ],
    sfx: {
      "eveque-white-revelation": "/assets/sfx/hit.wav",
      "eveque-gray-sanctuary-cast": "/assets/sfx/defense.wav",
      "eveque-black-condemnation": "/assets/sfx/hit.wav",
    },
    damage,
    success,
    damageTaken,
    heal,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
