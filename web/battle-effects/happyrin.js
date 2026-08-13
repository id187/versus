"use strict";

(function registerHappyrinBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before happyrin effects.");

  const CHARACTER_ID = "happyrin";
  const MADNESS_STATUS_NAME = "광증";
  const REACTION_FLASK_ACTION_NAME = "반응 유리병";
  const MADNESS_INFECTION_ACTION_NAME = "광기 전염";
  const CRAZED_BEATING_ACTION_NAME = "정신나간 후려치기";
  const OVERDOSE_ACTION_NAME = "약물 과복용";
  const MADNESS_SWIRL_LIFETIME_MS = 840;
  const FLASK_IMPACT_DELAY_MS = 620;
  const FLASK_LIFETIME_MS = 700;
  const RANDOM_HIT_LIFETIME_MS = 540;
  const SYRINGE_LIFETIME_MS = 760;

  function actionReplacement({ actorName, actorSide, targetName, targetSide, makeLogEffect }) {
    const resolvedName = targetName || actorName;
    const resolvedSide = targetSide || actorSide;
    return makeLogEffect(
      "happyrin-madness-swirl",
      resolvedName,
      actorName || resolvedName,
      null,
      resolvedSide,
      actorSide || resolvedSide,
    );
  }

  function statEffect({ actionName, actorName, actorSide, targetName, targetSide, stat, makeLogEffect }) {
    if (actionName !== OVERDOSE_ACTION_NAME || stat !== "atk") return undefined;
    return makeLogEffect(
      "happyrin-overdose-syringe",
      targetName || actorName,
      actorName,
      null,
      targetSide || actorSide,
      actorSide,
    );
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage: rawDamage, makeLogEffect }) {
    const damage = Number(rawDamage);
    if (![REACTION_FLASK_ACTION_NAME, MADNESS_INFECTION_ACTION_NAME, CRAZED_BEATING_ACTION_NAME].includes(actionName)) {
      return undefined;
    }
    if (!(damage > 0)) return null;

    if (actionName === REACTION_FLASK_ACTION_NAME) {
      const effect = makeLogEffect(
        "happyrin-reaction-flask-cast",
        targetName,
        actorName,
        null,
        targetSide,
        actorSide,
      );
      return effect ? {
        ...effect,
        damageValue: false,
        impactDelayMs: FLASK_IMPACT_DELAY_MS,
        impactValue: damage,
        impactDamageValue: true,
      } : null;
    }

    const type = actionName === MADNESS_INFECTION_ACTION_NAME
      ? "happyrin-madness-smile-burst"
      : "happyrin-random-hit-impact";
    const effect = makeLogEffect(type, targetName, actorName, damage, targetSide, actorSide);
    return effect ? { ...effect, damageValue: true } : null;
  }

  function scheduleImpact(effect, type, delayMs, registerTimeout, playLogEffect) {
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
    }), delayMs));
  }

  function mountMadnessSwirl(effect, stageForSide, appendEffectElement, registerTimeout) {
    const targetStage = stageForSide(effect.side);
    if (!targetStage) return;
    const swirl = document.createElement("span");
    swirl.className = "battle-fx-happyrin-madness-swirl";
    swirl.dataset.characterBattleEffect = CHARACTER_ID;
    swirl.dataset.targetSide = effect.side;
    const mountedSwirl = appendEffectElement(targetStage, swirl);
    registerTimeout(window.setTimeout(() => mountedSwirl.remove(), MADNESS_SWIRL_LIFETIME_MS));
  }

  function mountReactionFlask(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);
    if (!arena || !sourceStage || !targetStage) return;
    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const sourceBodyY = registry.stagePercent(sourceStage, "--fx-body-y", 0.5);
    const targetGroundY = registry.stagePercent(targetStage, "--fx-ground-y", 0.96);
    const startX = sourceRect.left + sourceRect.width * 0.5 - arenaRect.left;
    const startY = sourceRect.top + sourceRect.height * sourceBodyY - arenaRect.top;
    const endX = targetRect.left + targetRect.width * 0.5 - arenaRect.left;
    const endY = targetRect.top + targetRect.height * targetGroundY - arenaRect.top;
    const direction = endX >= startX ? 1 : -1;
    const distance = Math.abs(endX - startX);
    const midX = (startX + endX) * 0.5;
    const midY = Math.min(startY, endY) - Math.max(110, Math.min(210, distance * 0.34));

    const flask = document.createElement("span");
    flask.className = "battle-fx-happyrin-reaction-flask";
    flask.dataset.characterBattleEffect = CHARACTER_ID;
    flask.dataset.sourceSide = effect.sourceSide;
    flask.dataset.targetSide = effect.side;
    flask.style.setProperty("--happyrin-flask-start-x", `${startX}px`);
    flask.style.setProperty("--happyrin-flask-start-y", `${startY}px`);
    flask.style.setProperty("--happyrin-flask-mid-x", `${midX}px`);
    flask.style.setProperty("--happyrin-flask-mid-y", `${midY}px`);
    flask.style.setProperty("--happyrin-flask-end-x", `${endX}px`);
    flask.style.setProperty("--happyrin-flask-end-y", `${endY}px`);
    flask.style.setProperty("--happyrin-flask-direction", direction);
    flask.style.setProperty("--happyrin-flask-start-angle", `${-18 * direction}deg`);
    flask.style.setProperty("--happyrin-flask-mid-angle", `${170 * direction}deg`);
    flask.style.setProperty("--happyrin-flask-end-angle", `${72 * direction}deg`);
    const mountedFlask = appendEffectElement(arena, flask);
    registerTimeout(window.setTimeout(() => mountedFlask.remove(), FLASK_LIFETIME_MS));
  }

  function mountRandomHit(effect, stageForSide, appendEffectElement, registerTimeout) {
    const targetStage = stageForSide(effect.side);
    if (!targetStage) return;
    const direction = effect.sourceSide === "ai" ? -1 : 1;
    const baseScale = 0.72 + Math.random() * 0.42;
    const hit = document.createElement("span");
    hit.className = "battle-fx-happyrin-random-hit-burst";
    hit.dataset.characterBattleEffect = CHARACTER_ID;
    hit.dataset.sourceSide = effect.sourceSide;
    hit.dataset.targetSide = effect.side;
    hit.style.setProperty("--happyrin-hit-x", `${(30 + Math.random() * 40).toFixed(2)}%`);
    hit.style.setProperty("--happyrin-hit-y", `${(30 + Math.random() * 40).toFixed(2)}%`);
    hit.style.setProperty("--happyrin-hit-angle", `${(-180 + Math.random() * 360).toFixed(2)}deg`);
    hit.style.setProperty("--happyrin-hit-scale-start", `${(baseScale * 0.22).toFixed(3)}`);
    hit.style.setProperty("--happyrin-hit-scale-pop", `${(baseScale * 1.12).toFixed(3)}`);
    hit.style.setProperty("--happyrin-hit-scale", `${baseScale.toFixed(3)}`);
    hit.style.setProperty("--happyrin-hit-scale-end", `${(baseScale * 1.18).toFixed(3)}`);
    hit.style.setProperty("--happyrin-hit-flip", direction);
    const mountedHit = appendEffectElement(targetStage, hit);
    registerTimeout(window.setTimeout(() => mountedHit.remove(), RANDOM_HIT_LIFETIME_MS));
  }

  function mountOverdoseSyringe(effect, stageForSide, appendEffectElement, registerTimeout) {
    const targetStage = stageForSide(effect.side);
    if (!targetStage) return;
    const syringe = document.createElement("span");
    syringe.className = "battle-fx-happyrin-overdose-syringe";
    syringe.dataset.characterBattleEffect = CHARACTER_ID;
    syringe.dataset.targetSide = effect.side;
    const isPlayerSide = effect.side === "player";
    syringe.style.setProperty("--happyrin-syringe-x", isPlayerSide ? "64%" : "36%");
    syringe.style.setProperty("--happyrin-syringe-flip", isPlayerSide ? 1 : -1);
    syringe.style.setProperty("--happyrin-syringe-start-x", isPlayerSide ? "18%" : "-18%");
    syringe.style.setProperty("--happyrin-syringe-approach-x", isPlayerSide ? "14%" : "-14%");
    syringe.style.setProperty("--happyrin-syringe-impact-x", isPlayerSide ? "-13%" : "13%");
    syringe.style.setProperty("--happyrin-syringe-settle-x", isPlayerSide ? "-15%" : "15%");
    const mountedSyringe = appendEffectElement(targetStage, syringe);
    registerTimeout(window.setTimeout(() => mountedSyringe.remove(), SYRINGE_LIFETIME_MS));
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type === "happyrin-madness-swirl") {
      mountMadnessSwirl(effect, stageForSide, appendEffectElement, registerTimeout);
      return true;
    }
    if (effect.type === "happyrin-reaction-flask-cast") {
      mountReactionFlask(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(
        effect,
        "happyrin-reaction-flask-impact",
        FLASK_IMPACT_DELAY_MS,
        registerTimeout,
        playLogEffect,
      );
      return true;
    }
    if (effect.type === "happyrin-random-hit-impact") {
      mountRandomHit(effect, stageForSide, appendEffectElement, registerTimeout);
      return false;
    }
    if (effect.type === "happyrin-overdose-syringe") {
      mountOverdoseSyringe(effect, stageForSide, appendEffectElement, registerTimeout);
      return true;
    }
    return false;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: [MADNESS_STATUS_NAME],
    effectTypes: [
      "happyrin-madness-swirl",
      "happyrin-reaction-flask-cast",
      "happyrin-reaction-flask-impact",
      "happyrin-madness-smile-burst",
      "happyrin-random-hit-impact",
      "happyrin-overdose-syringe",
    ],
    sfx: {
      "happyrin-madness-swirl": "/assets/sfx/debuff.wav",
      "happyrin-reaction-flask-impact": "/assets/sfx/hit.wav",
      "happyrin-madness-smile-burst": "/assets/sfx/hit.wav",
      "happyrin-random-hit-impact": "/assets/sfx/hit.wav",
      "happyrin-overdose-syringe": "/assets/sfx/buff.wav",
    },
    actionReplacement,
    statEffect,
    damage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
