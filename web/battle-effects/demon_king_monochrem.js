"use strict";

(function registerDemonKingMonochremBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before Monochrem effects.");

  const CHARACTER_ID = "demon_king_monochrem";
  const WHITE_COLLAPSE_ACTION_NAME = "백색 붕괴";
  const BLACK_REVERSAL_ACTION_NAME = "흑색 반전";
  const ACHROMATIC_SILENCE_ACTION_NAME = "무채의 침묵";
  const COLORS_END_ACTION_NAME = "색채의 종언";
  const SILENCE_IMPACT_DELAY_MS = 480;
  const SILENCE_LIFETIME_MS = 760;
  const COLORS_END_IMPACT_DELAY_MS = 820;
  const COLORS_END_LIFETIME_MS = 1760;

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    const isWhiteCollapse = actionName === WHITE_COLLAPSE_ACTION_NAME;
    const isSilence = actionName === ACHROMATIC_SILENCE_ACTION_NAME;
    const isColorsEnd = actionName === COLORS_END_ACTION_NAME;
    if (!isWhiteCollapse && !isSilence && !isColorsEnd) return undefined;
    if (!(damage > 0)) return null;

    const type = isWhiteCollapse
      ? "monochrem-white-collapse"
      : isSilence
        ? "monochrem-achromatic-silence"
        : "monochrem-colors-end";
    const effect = makeLogEffect(type, targetName, actorName, isWhiteCollapse ? damage : null, targetSide, actorSide);
    if (!effect) return null;
    if (isWhiteCollapse) return { ...effect, damageValue: true };
    return {
      ...effect,
      damageValue: false,
      impactDelayMs: isSilence ? SILENCE_IMPACT_DELAY_MS : COLORS_END_IMPACT_DELAY_MS,
      impactValue: damage,
      impactDamageValue: true,
    };
  }

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== BLACK_REVERSAL_ACTION_NAME) return undefined;
    return makeLogEffect(
      "monochrem-black-reversal",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  function mount(parent, className, helpers, lifetime) {
    const element = document.createElement("span");
    element.className = className;
    element.dataset.characterBattleEffect = CHARACTER_ID;
    const mounted = helpers.appendEffectElement(parent, element);
    helpers.registerTimeout(window.setTimeout(() => mounted.remove(), lifetime));
    return element;
  }

  function delayedImpact(effect, type, delay, playLogEffect, registerTimeout) {
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
    }), delay));
  }

  function playSilence(effect, helpers) {
    const stage = helpers.stageForSide(effect.side);
    if (stage) {
      mount(
        stage,
        "battle-fx-effect battle-fx-monochrem-achromatic-silence",
        helpers,
        SILENCE_LIFETIME_MS,
      );
    }
    delayedImpact(
      effect,
      "monochrem-achromatic-silence-impact",
      SILENCE_IMPACT_DELAY_MS,
      helpers.playLogEffect,
      helpers.registerTimeout,
    );
    return true;
  }

  function playColorsEnd(effect, helpers) {
    const { arena } = helpers;
    if (arena) {
      const screen = arena.closest?.(".battle-screen") || arena;
      screen.classList.remove("is-monochrem-colors-end");
      void screen.offsetWidth;
      screen.classList.add("is-monochrem-colors-end");
      helpers.registerTimeout(window.setTimeout(
        () => screen.classList.remove("is-monochrem-colors-end"),
        COLORS_END_LIFETIME_MS,
      ));
      mount(
        arena,
        "battle-fx-monochrem-colors-end-king",
        helpers,
        COLORS_END_LIFETIME_MS,
      );
      const arenaRect = arena.getBoundingClientRect?.() || { left: 0, top: 0, width: 0, height: 0 };
      const screenRect = screen.getBoundingClientRect?.() || { left: 0, top: 0 };
      const wave = document.createElement("span");
      wave.className = "battle-fx-monochrem-colors-end-wave";
      wave.dataset.characterBattleEffect = CHARACTER_ID;
      wave.dataset.sourceSide = effect.sourceSide;
      wave.style.setProperty(
        "--monochrem-colors-end-center-x",
        `${arenaRect.left - screenRect.left + arenaRect.width / 2}px`,
      );
      wave.style.setProperty(
        "--monochrem-colors-end-center-y",
        `${arenaRect.top - screenRect.top + arenaRect.height / 2}px`,
      );
      screen.append(wave);
      helpers.registerTimeout(window.setTimeout(() => wave.remove(), COLORS_END_LIFETIME_MS));
    }
    delayedImpact(
      effect,
      "monochrem-colors-end-impact",
      COLORS_END_IMPACT_DELAY_MS,
      helpers.playLogEffect,
      helpers.registerTimeout,
    );
    return true;
  }

  function playEffect(effect, helpers) {
    const appendEffectElement = helpers.appendEffectElement
      || ((parent, element) => { parent.append(element); return element; });
    const normalizedHelpers = { ...helpers, appendEffectElement };
    if (effect.type === "monochrem-achromatic-silence") return playSilence(effect, normalizedHelpers);
    if (effect.type === "monochrem-colors-end") return playColorsEnd(effect, normalizedHelpers);
    return false;
  }

  registry.register(CHARACTER_ID, {
    effectTypes: [
      "monochrem-white-collapse",
      "monochrem-black-reversal",
      "monochrem-achromatic-silence",
      "monochrem-achromatic-silence-impact",
      "monochrem-colors-end",
      "monochrem-colors-end-impact",
    ],
    sfx: {
      "monochrem-white-collapse": "/assets/sfx/hit.wav",
      "monochrem-black-reversal": "/assets/sfx/defense.wav",
      "monochrem-achromatic-silence": "/assets/sfx/debuff.wav",
      "monochrem-achromatic-silence-impact": "/assets/sfx/hit.wav",
      "monochrem-colors-end": "/assets/sfx/debuff.wav",
      "monochrem-colors-end-impact": "/assets/sfx/hit.wav",
    },
    damage,
    success,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
