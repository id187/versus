"use strict";

(function registerLibrangBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before librang effects.");

  const CHARACTER_ID = "librang";
  const BALANCE_STATUS_NAME = "균형";
  const LIGHTNESS_ACTION_NAME = "벤다는 것의 가벼움";
  const WEIGHT_ACTION_NAME = "지킨다는 것의 무거움";
  const PRAYER_ACTION_NAME = "평형의 기도";
  const JUDGMENT_ACTION_NAME = "성좌단죄";
  const JUDGMENT_IMPACT_DELAY_MS = 260;
  const JUDGMENT_LIFETIME_MS = 880;

  function counterChange({ statusName, targetName, targetSide, before, after, makeLogEffect }) {
    if (statusName !== BALANCE_STATUS_NAME || after <= before) return undefined;
    const effect = makeLogEffect(
      "balance-sigil",
      targetName,
      targetName,
      `${BALANCE_STATUS_NAME}+${after - before}`,
      targetSide,
      targetSide,
    );
    return effect ? { ...effect, valueKind: "stack-gain" } : null;
  }

  function action({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName === WEIGHT_ACTION_NAME) {
      return makeLogEffect("weight-glyph-drop", actorName, actorName, null, actorSide, actorSide);
    }
    if (actionName === PRAYER_ACTION_NAME) {
      return makeLogEffect("prayer-wings", actorName, actorName, null, actorSide, actorSide);
    }
    return undefined;
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (actionName === LIGHTNESS_ACTION_NAME) {
      if (!(damage > 0)) return null;
      const effect = makeLogEffect(
        "lightness-rising-slash",
        targetName,
        actorName,
        damage,
        targetSide,
        actorSide,
      );
      return effect ? { ...effect, damageValue: true } : null;
    }

    if (actionName !== JUDGMENT_ACTION_NAME) return undefined;
    if (!(damage > 0)) return null;
    const effect = makeLogEffect(
      "constellation-judgment-cast",
      targetName,
      actorName,
      null,
      targetSide,
      actorSide,
    );
    return effect ? {
      ...effect,
      damageValue: false,
      impactDelayMs: JUDGMENT_IMPACT_DELAY_MS,
      impactValue: damage,
      impactDamageValue: true,
    } : null;
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type !== "constellation-judgment-cast") return false;

    const {
      impactValue,
      impactDamageValue,
      delayMs: _delayMs,
      ...baseEffect
    } = effect;

    const targetStage = typeof stageForSide === "function" ? stageForSide(effect.side) : null;
    if (arena && targetStage) {
      const slash = document.createElement("span");
      slash.className = "battle-fx-constellation-judgment-screen";
      slash.dataset.characterBattleEffect = CHARACTER_ID;
      slash.dataset.sourceSide = effect.sourceSide;
      slash.dataset.targetSide = effect.side;
      const arenaRect = arena.getBoundingClientRect();
      const targetRect = targetStage.getBoundingClientRect();
      const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
      const targetX = targetRect.left - arenaRect.left + targetRect.width * 0.5;
      const targetY = targetRect.top - arenaRect.top + targetRect.height * targetBodyY;
      slash.style.setProperty("--librang-judgment-x", `${targetX}px`);
      slash.style.setProperty("--librang-judgment-y", `${targetY}px`);
      slash.style.setProperty("--librang-judgment-width", `${Math.max(220, targetRect.width * 1.4)}px`);
      slash.style.setProperty("--librang-judgment-height", `${Math.max(arenaRect.height * 1.4, targetRect.height * 2)}px`);
      const mountedSlash = appendEffectElement(arena, slash);
      registerTimeout(window.setTimeout(() => mountedSlash.remove(), JUDGMENT_LIFETIME_MS));
    }

    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type: "constellation-judgment-impact",
      value: impactValue,
      damageValue: Boolean(impactDamageValue),
    }), JUDGMENT_IMPACT_DELAY_MS));
    return true;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: [BALANCE_STATUS_NAME],
    effectTypes: [
      "balance-sigil",
      "lightness-rising-slash",
      "weight-glyph-drop",
      "prayer-wings",
      "constellation-judgment-cast",
      "constellation-judgment-impact",
    ],
    sfx: {
      "balance-sigil": "/assets/sfx/buff.wav",
      "lightness-rising-slash": "/assets/sfx/hit.wav",
      "weight-glyph-drop": "/assets/sfx/defense.wav",
      "prayer-wings": "/assets/sfx/buff.wav",
      "constellation-judgment-cast": "/assets/sfx/hit.wav",
    },
    counterChange,
    action,
    damage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
