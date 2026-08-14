"use strict";

(function registerZetovenBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before zetoven effects.");

  const CHARACTER_ID = "zetoven";
  const CURSE_CANNON_ACTION_NAME = "저주포";
  const REQUIEM_ACTION_NAME = "포열 진혼";
  const SOUL_BARRAGE_ACTION_NAME = "원혼 연살";
  const CANNON_EVOCATION_ACTION_NAME = "거포 강령";
  const CANNON_EVOCATION_SUCCESS_LOG = "4턴 동안 과령 폭주 피해가 억제된다.";
  const OVERHEAT_REASONS = Object.freeze(["과령 폭주", "거포 강령 종료"]);
  const CURSE_CANNON_FLIGHT_MS = 320;
  const CURSE_CANNON_IMPACT_DELAY_MS = 280;
  const REQUIEM_GHOST_LIFETIME_MS = 1050;

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (![CURSE_CANNON_ACTION_NAME, SOUL_BARRAGE_ACTION_NAME].includes(actionName)) return undefined;
    if (!(damage > 0)) return null;
    if (actionName === SOUL_BARRAGE_ACTION_NAME) {
      const effect = makeLogEffect(
        "zetoven-soul-barrage-impact",
        targetName,
        actorName,
        damage,
        targetSide,
        actorSide,
      );
      return effect ? { ...effect, damageValue: true } : null;
    }
    const effect = makeLogEffect(
      "zetoven-curse-cannon-flight",
      targetName,
      actorName,
      null,
      targetSide,
      actorSide,
    );
    return effect ? { ...effect, damageValue: false, impactValue: damage } : null;
  }

  function heal({ actionName, actorName, actorSide, targetName, targetSide, amount, makeLogEffect }) {
    if (actionName !== REQUIEM_ACTION_NAME) return undefined;
    const effect = makeLogEffect(
      "zetoven-requiem-ascension",
      targetName,
      actorName,
      amount > 0 ? amount : null,
      targetSide,
      actorSide,
    );
    return effect ? { ...effect, valueKind: amount > 0 ? "hp-gain" : null } : null;
  }

  function log({ line, actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== CANNON_EVOCATION_ACTION_NAME || line !== CANNON_EVOCATION_SUCCESS_LOG) {
      return undefined;
    }
    return makeLogEffect(
      "zetoven-cannon-evocation-circle",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  function statusDamage({ statusName, targetName, targetSide, damage, makeLogEffect }) {
    if (!OVERHEAT_REASONS.includes(statusName)) return undefined;
    if (!(damage > 0)) return null;
    const effect = makeLogEffect(
      "zetoven-vengeance-overheat",
      targetName,
      targetName,
      damage,
      targetSide,
      targetSide,
    );
    return effect ? { ...effect, damageValue: true } : null;
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type === "zetoven-requiem-ascension") {
      const targetStage = stageForSide(effect.side);
      if (!targetStage) return false;
      const ghostSettings = [
        { x: "38%", driftMid: "-10px", drift: "-22px", delay: "0ms", scale: "0.78" },
        { x: "62%", driftMid: "9px", drift: "20px", delay: "100ms", scale: "0.9" },
        { x: "50%", driftMid: "-2px", drift: "-4px", delay: "200ms", scale: "0.84" },
      ];
      for (const settings of ghostSettings) {
        const ghost = document.createElement("span");
        ghost.className = "battle-fx-zetoven-requiem-ghost";
        ghost.dataset.characterBattleEffect = CHARACTER_ID;
        ghost.style.setProperty("--zetoven-requiem-x", settings.x);
        ghost.style.setProperty("--zetoven-requiem-drift-mid", settings.driftMid);
        ghost.style.setProperty("--zetoven-requiem-drift", settings.drift);
        ghost.style.setProperty("--zetoven-requiem-delay", settings.delay);
        ghost.style.setProperty("--zetoven-requiem-scale", settings.scale);
        const mountedGhost = appendEffectElement(targetStage, ghost);
        registerTimeout(window.setTimeout(
          () => mountedGhost.remove(),
          REQUIEM_GHOST_LIFETIME_MS + Number.parseInt(settings.delay, 10) + 40,
        ));
      }
      return false;
    }
    if (effect.type !== "zetoven-curse-cannon-flight") return false;
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);
    if (!arena || !sourceStage || !targetStage) return true;

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

    const projectile = document.createElement("span");
    projectile.className = "battle-fx-zetoven-curse-cannon-projectile";
    projectile.dataset.characterBattleEffect = CHARACTER_ID;
    projectile.dataset.sourceSide = effect.sourceSide;
    projectile.dataset.targetSide = effect.side;
    projectile.style.setProperty("--zetoven-curse-start-x", `${startX}px`);
    projectile.style.setProperty("--zetoven-curse-start-y", `${startY}px`);
    projectile.style.setProperty("--zetoven-curse-end-x", `${endX}px`);
    projectile.style.setProperty("--zetoven-curse-end-y", `${endY}px`);
    projectile.style.setProperty("--zetoven-curse-angle", `${angle}rad`);
    projectile.style.setProperty("--zetoven-curse-direction", direction);
    const mountedProjectile = appendEffectElement(arena, projectile);
    registerTimeout(window.setTimeout(() => mountedProjectile.remove(), CURSE_CANNON_FLIGHT_MS + 40));

    const { impactValue, ...baseEffect } = effect;
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type: "zetoven-curse-cannon-impact",
      value: impactValue,
      damageValue: true,
    }), CURSE_CANNON_IMPACT_DELAY_MS));
    return true;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: OVERHEAT_REASONS,
    effectTypes: [
      "zetoven-curse-cannon-flight",
      "zetoven-curse-cannon-impact",
      "zetoven-requiem-ascension",
      "zetoven-soul-barrage-impact",
      "zetoven-cannon-evocation-circle",
      "zetoven-vengeance-overheat",
    ],
    sfx: {
      "zetoven-curse-cannon-impact": "/assets/sfx/hit.wav",
      "zetoven-requiem-ascension": "/assets/sfx/heal.wav",
      "zetoven-soul-barrage-impact": "/assets/sfx/hit.wav",
      "zetoven-cannon-evocation-circle": "/assets/sfx/buff.wav",
      "zetoven-vengeance-overheat": "/assets/sfx/hit.wav",
    },
    damage,
    heal,
    log,
    statusDamage,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
