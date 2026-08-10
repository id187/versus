"use strict";

(function registerCryneBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before cryne effects.");

  const CHARACTER_ID = "cryne";
  const WAILING_WOUND_ACTION_NAME = "울부짖는 상처";
  const THORN_CHAIN_ACTION_NAME = "가시 돋친 사슬";
  const SIN_AND_PUNISHMENT_ACTION_NAME = "죄와 벌";
  const ENDLESS_PAIN_ACTION_NAME = "끝없는 고통";
  let endlessPainHitIndex = 0;

  function action({ actionName }) {
    if (actionName === ENDLESS_PAIN_ACTION_NAME) endlessPainHitIndex = 0;
    return undefined;
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    const effectType = actionName === THORN_CHAIN_ACTION_NAME
      ? "thorn-chain"
      : actionName === SIN_AND_PUNISHMENT_ACTION_NAME
        ? "sin-and-punishment"
        : actionName === ENDLESS_PAIN_ACTION_NAME
          ? `endless-pain-${(endlessPainHitIndex++ % 3) + 1}`
          : null;
    if (!effectType) return undefined;
    const effect = makeLogEffect(
      effectType,
      targetName,
      actorName,
      damage,
      targetSide,
      actorSide,
    );
    if (!effect) return null;
    if (actionName === SIN_AND_PUNISHMENT_ACTION_NAME) {
      return {
        ...effect,
        value: null,
        damageValue: false,
        impactDelayMs: 260,
        impactValue: damage,
        impactDamageValue: damage > 0,
      };
    }
    return { ...effect, damageValue: damage > 0 };
  }

  function counterChange({ statusName, targetName, targetSide, before, after, makeLogEffect }) {
    if (statusName !== "상흔" || after <= before) return undefined;
    const effect = makeLogEffect(
      "scar-thorns",
      targetName,
      targetName,
      `상흔+${after - before}`,
      targetSide,
      targetSide,
    );
    return effect ? { ...effect, valueKind: "stack-gain" } : null;
  }

  function statEffect({ actionName, actorName, actorSide, targetName, targetSide, stat, makeLogEffect }) {
    if (actionName !== WAILING_WOUND_ACTION_NAME || stat !== "atk") return undefined;
    return makeLogEffect(
      "wailing-wound-ring-sides",
      targetName || actorName,
      actorName,
      null,
      targetSide || actorSide,
      actorSide,
    );
  }

  function playEffect(effect, { registerTimeout, playLogEffect }) {
    if (effect.type !== "sin-and-punishment") return false;
    const {
      impactValue,
      impactDamageValue,
      delayMs: _delayMs,
      ...baseEffect
    } = effect;

    playLogEffect({
      ...baseEffect,
      type: "sin-and-punishment-bind",
      value: null,
      damageValue: false,
    });
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type: "sin-and-punishment-slash",
      value: impactValue,
      damageValue: Boolean(impactDamageValue),
    }), 260));
    return true;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: ["상흔"],
    effectTypes: [
      "scar-thorns",
      "wailing-wound-ring-sides",
      "thorn-chain",
      "sin-and-punishment",
      "sin-and-punishment-bind",
      "sin-and-punishment-slash",
      "endless-pain-1",
      "endless-pain-2",
      "endless-pain-3",
    ],
    sfx: {
      "scar-thorns": "/assets/sfx/debuff.wav",
      "wailing-wound-ring-sides": "/assets/sfx/buff.wav",
      "thorn-chain": "/assets/sfx/hit.wav",
      "sin-and-punishment-bind": "/assets/sfx/debuff.wav",
      "sin-and-punishment-slash": "/assets/sfx/hit.wav",
      "endless-pain-1": "/assets/sfx/hit.wav",
      "endless-pain-2": "/assets/sfx/hit.wav",
      "endless-pain-3": "/assets/sfx/hit.wav",
    },
    action,
    damage,
    counterChange,
    statEffect,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
