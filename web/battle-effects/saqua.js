"use strict";

(function registerSaquaBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before saqua effects.");

  const CHARACTER_ID = "saqua";
  const FLOW_LOCK_LOG = "정류 2/2를 모두 소모해 명중 판정을 통과한다.";
  const TORRENT_ARROW_ACTION_NAME = "급류 화살";
  const FLOWING_BARRIER_ACTION_NAME = "흐르는 수막";
  const SERMON_ARROW_ACTION_NAME = "강연사";
  const RAIN_ARROW_ACTION_NAME = "비의 화살";
  const FLOW_LOCK_LIFETIME_MS = 840;
  const TORRENT_IMPACT_DELAY_MS = 280;
  const TORRENT_PROJECTILE_LIFETIME_MS = 390;
  const SERMON_IMPACT_DELAY_MS = 470;
  const SERMON_PROJECTILE_LIFETIME_MS = 580;
  const RAIN_ASCENT_MS = 300;
  const RAIN_IMPACT_DELAY_MS = 820;
  const RAIN_PROJECTILE_LIFETIME_MS = 720;
  const RAIN_OFFSETS = Object.freeze([-0.64, -0.48, -0.32, -0.16, 0, 0.16, 0.32, 0.48, 0.64]);

  function action({ actionName }) {
    return actionName === FLOWING_BARRIER_ACTION_NAME ? null : undefined;
  }

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== FLOWING_BARRIER_ACTION_NAME) return undefined;
    return makeLogEffect(
      "flowing-water-barrier",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  function log({ line, actorName, actorSide, battle, makeLogEffect, oppositeSide }) {
    if (line !== FLOW_LOCK_LOG || !actorSide) return undefined;
    const targetSide = oppositeSide(actorSide);
    const targetName = battle?.[targetSide]?.name || actorName;
    return makeLogEffect(
      "flow-target-lock",
      targetName,
      actorName,
      null,
      targetSide,
      actorSide,
    );
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage: rawDamage, makeLogEffect }) {
    const damageValue = Number(rawDamage);
    if (![TORRENT_ARROW_ACTION_NAME, SERMON_ARROW_ACTION_NAME, RAIN_ARROW_ACTION_NAME].includes(actionName)) {
      return undefined;
    }
    if (!(damageValue > 0)) return null;

    let type;
    let impactDelayMs;
    if (actionName === TORRENT_ARROW_ACTION_NAME) {
      type = "torrent-arrow-flight";
      impactDelayMs = TORRENT_IMPACT_DELAY_MS;
    } else if (actionName === SERMON_ARROW_ACTION_NAME) {
      type = "sermon-arrow-flight";
      impactDelayMs = SERMON_IMPACT_DELAY_MS;
    } else {
      type = "rain-arrow-cast";
      impactDelayMs = RAIN_IMPACT_DELAY_MS;
    }

    const effect = makeLogEffect(type, targetName, actorName, null, targetSide, actorSide);
    return effect ? {
      ...effect,
      damageValue: false,
      impactDelayMs,
      impactValue: damageValue,
      impactDamageValue: true,
    } : null;
  }

  function arenaGeometry(effect, arena, stageForSide) {
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);
    if (!arena || !sourceStage || !targetStage) return null;
    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const sourceBodyY = registry.stagePercent(sourceStage, "--fx-body-y", 0.5);
    const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
    return {
      arenaRect,
      sourceStage,
      targetStage,
      sourceRect,
      targetRect,
      startX: sourceRect.left + sourceRect.width * 0.5 - arenaRect.left,
      startY: sourceRect.top + sourceRect.height * sourceBodyY - arenaRect.top,
      endX: targetRect.left + targetRect.width * 0.5 - arenaRect.left,
      endY: targetRect.top + targetRect.height * targetBodyY - arenaRect.top,
    };
  }

  function mountFlowLock(effect, stageForSide, appendEffectElement, registerTimeout) {
    const targetStage = stageForSide(effect.side);
    if (!targetStage) return;
    for (const size of ["outer", "inner"]) {
      const ring = document.createElement("span");
      ring.className = `battle-fx-saqua-flow-ring battle-fx-saqua-flow-ring-${size}`;
      ring.dataset.characterBattleEffect = CHARACTER_ID;
      ring.dataset.sourceSide = effect.sourceSide;
      ring.dataset.targetSide = effect.side;
      const mountedRing = appendEffectElement(targetStage, ring);
      registerTimeout(window.setTimeout(() => mountedRing.remove(), FLOW_LOCK_LIFETIME_MS));
    }
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

  function mountTorrentArrow(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const geometry = arenaGeometry(effect, arena, stageForSide);
    if (!geometry) return;
    const { startX, startY, endX, endY } = geometry;
    const horizontalDirection = endX >= startX ? 1 : -1;
    const angle = Math.atan2(endY - startY, Math.abs(endX - startX)) * horizontalDirection;
    const projectile = document.createElement("span");
    projectile.className = "battle-fx-saqua-torrent-arrow-projectile";
    projectile.dataset.characterBattleEffect = CHARACTER_ID;
    projectile.dataset.sourceSide = effect.sourceSide;
    projectile.dataset.targetSide = effect.side;
    projectile.style.setProperty("--saqua-start-x", `${startX}px`);
    projectile.style.setProperty("--saqua-start-y", `${startY}px`);
    projectile.style.setProperty("--saqua-end-x", `${endX}px`);
    projectile.style.setProperty("--saqua-end-y", `${endY}px`);
    projectile.style.setProperty("--saqua-projectile-angle", `${angle}rad`);
    projectile.style.setProperty("--saqua-projectile-flip", horizontalDirection);
    const mountedProjectile = appendEffectElement(arena, projectile);
    registerTimeout(window.setTimeout(() => mountedProjectile.remove(), TORRENT_PROJECTILE_LIFETIME_MS));
  }

  function mountSermonArrow(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const geometry = arenaGeometry(effect, arena, stageForSide);
    if (!geometry) return;
    const { startX, startY, endX, endY } = geometry;
    const horizontalDirection = endX >= startX ? 1 : -1;
    const distance = Math.abs(endX - startX);
    const midX = (startX + endX) * 0.5;
    const midY = Math.min(startY, endY) - Math.max(100, Math.min(190, distance * 0.3));
    const projectile = document.createElement("span");
    projectile.className = "battle-fx-saqua-sermon-arrow-projectile";
    projectile.dataset.characterBattleEffect = CHARACTER_ID;
    projectile.dataset.sourceSide = effect.sourceSide;
    projectile.dataset.targetSide = effect.side;
    projectile.style.setProperty("--saqua-start-x", `${startX}px`);
    projectile.style.setProperty("--saqua-start-y", `${startY}px`);
    projectile.style.setProperty("--saqua-mid-x", `${midX}px`);
    projectile.style.setProperty("--saqua-mid-y", `${midY}px`);
    projectile.style.setProperty("--saqua-end-x", `${endX}px`);
    projectile.style.setProperty("--saqua-end-y", `${endY}px`);
    projectile.style.setProperty("--saqua-projectile-flip", horizontalDirection);
    projectile.style.setProperty("--saqua-sermon-start-angle", `${-24 * horizontalDirection}deg`);
    projectile.style.setProperty("--saqua-sermon-mid-angle", "0deg");
    projectile.style.setProperty("--saqua-sermon-end-angle", `${28 * horizontalDirection}deg`);
    const mountedProjectile = appendEffectElement(arena, projectile);
    registerTimeout(window.setTimeout(() => mountedProjectile.remove(), SERMON_PROJECTILE_LIFETIME_MS));
  }

  function mountRainArrows(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const geometry = arenaGeometry(effect, arena, stageForSide);
    if (!geometry) return;
    const { arenaRect, targetRect, targetStage, startX, startY, endX } = geometry;
    const horizontalDirection = endX >= startX ? 1 : -1;
    const skyX = endX - horizontalDirection * Math.max(36, targetRect.width * 0.18);
    const skyY = Math.max(18, targetRect.top - arenaRect.top - Math.max(110, targetRect.height * 0.3));
    const ascentAngle = Math.atan2(skyY - startY, Math.abs(skyX - startX)) * horizontalDirection;
    const ascent = document.createElement("span");
    ascent.className = "battle-fx-saqua-rain-arrow-ascent";
    ascent.dataset.characterBattleEffect = CHARACTER_ID;
    ascent.dataset.sourceSide = effect.sourceSide;
    ascent.dataset.targetSide = effect.side;
    ascent.style.setProperty("--saqua-start-x", `${startX}px`);
    ascent.style.setProperty("--saqua-start-y", `${startY}px`);
    ascent.style.setProperty("--saqua-end-x", `${skyX}px`);
    ascent.style.setProperty("--saqua-end-y", `${skyY}px`);
    ascent.style.setProperty("--saqua-projectile-angle", `${ascentAngle}rad`);
    ascent.style.setProperty("--saqua-projectile-flip", horizontalDirection);
    const mountedAscent = appendEffectElement(arena, ascent);
    registerTimeout(window.setTimeout(() => mountedAscent.remove(), RAIN_ASCENT_MS + 100));

    registerTimeout(window.setTimeout(() => {
      const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
      const targetCenterX = targetRect.left + targetRect.width * 0.5 - arenaRect.left;
      const targetCenterY = targetRect.top + targetRect.height * targetBodyY - arenaRect.top;
      const startRainY = Math.max(-64, targetRect.top - arenaRect.top - 190);
      const endRainY = targetCenterY + targetRect.height * 0.18;
      const rainDriftX = horizontalDirection * targetRect.width * 0.22;
      const rainAngle = Math.atan2(endRainY - startRainY, rainDriftX);
      RAIN_OFFSETS.forEach((offset, index) => {
        const startRainX = targetCenterX + offset * targetRect.width * 1.05;
        const endRainX = startRainX + rainDriftX;
        const arrow = document.createElement("span");
        arrow.className = "battle-fx-saqua-rain-arrow-fall";
        arrow.dataset.characterBattleEffect = CHARACTER_ID;
        arrow.dataset.sourceSide = effect.sourceSide;
        arrow.dataset.targetSide = effect.side;
        arrow.style.setProperty("--saqua-rain-start-x", `${startRainX}px`);
        arrow.style.setProperty("--saqua-rain-start-y", `${startRainY}px`);
        arrow.style.setProperty("--saqua-rain-end-x", `${endRainX}px`);
        arrow.style.setProperty("--saqua-rain-end-y", `${endRainY}px`);
        arrow.style.setProperty("--saqua-rain-angle", `${rainAngle}rad`);
        arrow.style.setProperty("--saqua-rain-delay", `${index * 34}ms`);
        const mountedArrow = appendEffectElement(arena, arrow);
        registerTimeout(window.setTimeout(() => mountedArrow.remove(), RAIN_PROJECTILE_LIFETIME_MS));
      });
    }, RAIN_ASCENT_MS - 20));
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type === "flow-target-lock") {
      mountFlowLock(effect, stageForSide, appendEffectElement, registerTimeout);
      return true;
    }
    if (effect.type === "torrent-arrow-flight") {
      mountTorrentArrow(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(effect, "torrent-arrow-impact", TORRENT_IMPACT_DELAY_MS, registerTimeout, playLogEffect);
      return true;
    }
    if (effect.type === "sermon-arrow-flight") {
      mountSermonArrow(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(effect, "sermon-arrow-impact", SERMON_IMPACT_DELAY_MS, registerTimeout, playLogEffect);
      return true;
    }
    if (effect.type === "rain-arrow-cast") {
      mountRainArrows(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      scheduleImpact(effect, "rain-arrow-impact", RAIN_IMPACT_DELAY_MS, registerTimeout, playLogEffect);
      return true;
    }
    return false;
  }

  registry.register(CHARACTER_ID, {
    effectTypes: [
      "flow-target-lock",
      "flowing-water-barrier",
      "torrent-arrow-flight",
      "torrent-arrow-impact",
      "sermon-arrow-flight",
      "sermon-arrow-impact",
      "rain-arrow-cast",
      "rain-arrow-impact",
    ],
    sfx: {
      "flow-target-lock": "/assets/sfx/buff.wav",
      "flowing-water-barrier": "/assets/sfx/defense.wav",
      "torrent-arrow-impact": "/assets/sfx/hit.wav",
      "sermon-arrow-impact": "/assets/sfx/hit.wav",
      "rain-arrow-impact": "/assets/sfx/hit.wav",
    },
    action,
    success,
    log,
    damage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
