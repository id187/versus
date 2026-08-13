"use strict";

(function registerAshendBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before ashend effects.");

  const CHARACTER_ID = "ashend";
  const ASHEN_SLASH_ACTION_NAME = "회맹섬";
  const GRAY_MIST_ACTION_NAME = "회색의 안개 속으로";
  const GRAY_SWORD_ACTION_NAME = "회무습";
  const ASH_BODY_ACTION_NAME = "이 몸이 재가 되어";
  const GRAY_MIST_SUCCESS_LOG = "이번 턴 이후 상대 공격에 대한 회피 판정이 반드시 성공한다.";
  const ASH_BODY_SUCCESS_LOG = "4턴 동안 상대의 공격을 50% 확률로 회피한다.";
  const GRAY_SWORD_IMPACT_DELAY_MS = 300;
  const GRAY_SWORD_LIFETIME_MS = 500;
  const ASH_BODY_LIFETIME_MS = 1120;

  function statusApplied({ statusName, actorName, actorSide, targetName, targetSide, makeLogEffect }) {
    if (statusName !== "회진") return undefined;
    return makeLogEffect(
      "ash-haze-status",
      targetName,
      actorName,
      null,
      targetSide,
      actorSide,
    );
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (!(damage > 0)) return null;

    if (actionName === ASHEN_SLASH_ACTION_NAME) {
      const effect = makeLogEffect(
        "ashen-slash",
        targetName,
        actorName,
        damage,
        targetSide,
        actorSide,
      );
      return effect ? { ...effect, damageValue: true } : null;
    }

    if (actionName !== GRAY_SWORD_ACTION_NAME) return undefined;
    const effect = makeLogEffect(
      "gray-sword-drop",
      targetName,
      actorName,
      null,
      targetSide,
      actorSide,
    );
    return effect ? {
      ...effect,
      damageValue: false,
      impactDelayMs: GRAY_SWORD_IMPACT_DELAY_MS,
      impactValue: damage,
      impactDamageValue: true,
    } : null;
  }

  function log({ line, actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName === GRAY_MIST_ACTION_NAME && line === GRAY_MIST_SUCCESS_LOG) {
      return makeLogEffect("gray-mist", actorName, actorName, null, actorSide, actorSide);
    }
    if (actionName === ASH_BODY_ACTION_NAME && line === ASH_BODY_SUCCESS_LOG) {
      return makeLogEffect("ash-body-disperse", actorName, actorName, null, actorSide, actorSide);
    }
    return undefined;
  }

  function playEffect(effect, {
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type === "gray-sword-drop") {
      const {
        impactDelayMs: _impactDelayMs,
        impactValue,
        impactDamageValue,
        delayMs: _delayMs,
        ...baseEffect
      } = effect;
      const targetStage = stageForSide(effect.side);
      if (targetStage) {
        const sword = document.createElement("span");
        sword.className = "battle-fx-gray-sword-drop-projectile";
        sword.dataset.characterBattleEffect = CHARACTER_ID;
        sword.dataset.sourceSide = effect.sourceSide;
        sword.dataset.targetSide = effect.side;
        const mountedSword = appendEffectElement(targetStage, sword);
        registerTimeout(window.setTimeout(() => mountedSword.remove(), GRAY_SWORD_LIFETIME_MS));
      }
      registerTimeout(window.setTimeout(() => playLogEffect({
        ...baseEffect,
        type: "gray-sword-impact",
        value: impactValue,
        damageValue: Boolean(impactDamageValue),
      }), GRAY_SWORD_IMPACT_DELAY_MS));
      return true;
    }

    if (effect.type !== "ash-body-disperse") return false;
    const sourceStage = stageForSide(effect.sourceSide || effect.side);
    if (!sourceStage) return true;
    sourceStage.classList.remove("is-ashend-ash-body");
    void sourceStage.offsetWidth;
    sourceStage.classList.add("is-ashend-ash-body");

    const ash = document.createElement("span");
    ash.className = "battle-fx-effect battle-fx-ash-body-disperse";
    ash.dataset.characterBattleEffect = CHARACTER_ID;
    ash.dataset.sourceSide = effect.sourceSide || effect.side;
    const mountedAsh = appendEffectElement(sourceStage, ash);
    registerTimeout(window.setTimeout(() => mountedAsh.remove(), ASH_BODY_LIFETIME_MS));
    registerTimeout(window.setTimeout(
      () => sourceStage.classList.remove("is-ashend-ash-body"),
      ASH_BODY_LIFETIME_MS,
    ));
    return true;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: ["회진"],
    effectTypes: [
      "ashen-slash",
      "ash-haze-status",
      "gray-mist",
      "gray-sword-drop",
      "gray-sword-impact",
      "ash-body-disperse",
    ],
    sfx: {
      "ashen-slash": "/assets/sfx/hit.wav",
      "ash-haze-status": "/assets/sfx/debuff.wav",
      "gray-mist": "/assets/sfx/defense.wav",
      "gray-sword-impact": "/assets/sfx/hit.wav",
      "ash-body-disperse": "/assets/sfx/buff.wav",
    },
    damage,
    statusApplied,
    log,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
