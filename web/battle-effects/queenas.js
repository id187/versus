"use strict";

(function registerQueenasBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before queenas effects.");

  const CHARACTER_ID = "queenas";
  const SHADOW_SPEAR_ACTION_NAME = "그림자 투창";
  const SHADOW_SOLDIER_ACTION_NAME = "그림자 병사";
  const CHARGE_ACTION_NAME = "그림자여 돌격하라";
  const WARNING_ACTION_NAME = "그림자를 조심하라";
  const SHADOW_STAB_ACTION_NAME = "그림자 찌르기";
  const SELF_STAB_ACTION_NAME = "자신 찌르기";
  const SPEAR_IMPACT_DELAY_MS = 360;
  const CHARGE_IMPACT_DELAY_MS = 430;

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (actionName === SHADOW_SPEAR_ACTION_NAME) {
      const effect = makeLogEffect("queenas-shadow-spear-cast", targetName, actorName, null, targetSide, actorSide);
      return effect ? {
        ...effect,
        damageValue: false,
        impactDelayMs: SPEAR_IMPACT_DELAY_MS,
        impactValue: damage,
        impactDamageValue: damage > 0,
      } : null;
    }
    if (actionName === CHARGE_ACTION_NAME) {
      const effect = makeLogEffect("queenas-shadow-charge", targetName, actorName, null, targetSide, actorSide);
      return effect ? {
        ...effect,
        damageValue: false,
        impactDelayMs: CHARGE_IMPACT_DELAY_MS,
        impactValue: damage,
        impactDamageValue: damage > 0,
      } : null;
    }
    if (![SHADOW_STAB_ACTION_NAME, SELF_STAB_ACTION_NAME].includes(actionName)) return undefined;
    const effect = makeLogEffect(
      actionName === SELF_STAB_ACTION_NAME ? "queenas-self-stab-impact" : "queenas-shadow-stab-impact",
      targetName,
      actorName,
      damage,
      targetSide,
      actorSide,
    );
    return effect ? { ...effect, damageValue: damage > 0 } : null;
  }

  function soldierDamaged({ targetName, targetSide, soldierNumber, damage, makeLogEffect }) {
    if (!(damage > 0)) return null;
    const effect = makeLogEffect(
      "queenas-soldier-damaged",
      targetName,
      targetName,
      null,
      targetSide,
      targetSide,
    );
    return effect ? { ...effect, soldierNumber, soldierDamage: damage } : null;
  }

  function shadowSoldierAction({ actorName, actorSide, soldierNumber, makeLogEffect }) {
    const effect = makeLogEffect(
      "queenas-soldier-attack",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
    return effect ? { ...effect, soldierNumber } : null;
  }

  function log({ line, actionName, actorName, actorSide, makeLogEffect }) {
    let match = String(line || "").match(/^(.+?)(?:은|는) 그림자 병사 (\d+)을 소환했다\. \(HP ([\d.]+) \/ ATK/);
    if (match) {
      const effect = makeLogEffect(
        actionName === WARNING_ACTION_NAME ? "queenas-warning-summon" : "queenas-shadow-summon",
        actorName,
        actorName,
        null,
        actorSide,
        actorSide,
      );
      return effect ? {
        ...effect,
        soldierNumber: Number(match[2]),
        soldierHp: Number(match[3]),
        soldierMaxHp: Number(match[3]),
        specialSoldier: actionName === WARNING_ACTION_NAME,
      } : null;
    }
    match = String(line || "").match(/^(.+?)(?:은|는) 그림자 병사 (\d+)을 돌격시켜 제거했다\.$/);
    if (match) {
      const effect = makeLogEffect("queenas-soldier-charge-start", actorName, actorName, null, actorSide, actorSide);
      return effect ? { ...effect, soldierNumber: Number(match[2]) } : null;
    }
    match = String(line || "").match(/^그림자 병사 (\d+)이 사라졌다\.$/);
    if (match) {
      const effect = makeLogEffect("queenas-soldier-vanish", actorName, actorName, null, actorSide, actorSide);
      return effect ? { ...effect, soldierNumber: Number(match[1]) } : null;
    }
    return undefined;
  }

  function persistentRoot(arena) {
    let root = arena?.querySelector(':scope > [data-queenas-persistent="true"]');
    if (!root && arena) {
      root = document.createElement("span");
      root.className = "queenas-shadow-army-layer";
      root.dataset.queenasPersistent = "true";
      arena.append(root);
    }
    return root;
  }

  function soldierElement(root, side, number) {
    return root?.querySelector(`[data-queenas-side="${side}"][data-soldier-number="${number}"]`) || null;
  }

  function positionSoldier(element, side, index, total, arena, stage) {
    const arenaRect = arena.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const groundY = registry.stagePercent(stage, "--fx-ground-y", 0.96);
    const direction = side === "player" ? 1 : -1;
    const baseX = stageRect.left - arenaRect.left + stageRect.width * (side === "player" ? 0.72 : 0.28);
    const spread = Math.min(54, stageRect.width * 0.18);
    const offset = (index - (total - 1) / 2) * spread * direction;
    const depth = index % 2 ? 8 : 0;
    element.style.left = `${baseX + offset}px`;
    element.style.top = `${stageRect.top - arenaRect.top + stageRect.height * groundY + depth}px`;
    element.style.setProperty("--queenas-soldier-flip", side === "player" ? 1 : -1);
    element.style.zIndex = String(8 + index);
  }

  function createSoldier(root, side, soldier, opponentSpriteUrl) {
    const element = document.createElement("span");
    element.className = `queenas-shadow-soldier${soldier.special ? " is-special" : ""} is-materializing`;
    element.dataset.queenasPersistentSoldier = "true";
    element.dataset.queenasSide = side;
    element.dataset.soldierNumber = String(soldier.number);
    element.innerHTML = `
      <span class="queenas-shadow-soldier-hp"><span></span></span>
      <span class="queenas-shadow-soldier-number">${soldier.number}</span>
      <span class="queenas-shadow-soldier-art"></span>
    `;
    if (soldier.special && opponentSpriteUrl) {
      const art = element.querySelector(".queenas-shadow-soldier-art");
      art.style.webkitMaskImage = `url("${opponentSpriteUrl}")`;
      art.style.maskImage = `url("${opponentSpriteUrl}")`;
    }
    root.append(element);
    window.setTimeout(() => element.classList.remove("is-materializing"), 700);
    return element;
  }

  function renderPersistent(battle, { arena, stageForSide }) {
    if (!arena) return;
    const root = persistentRoot(arena);
    const wanted = new Set();
    for (const side of ["player", "ai"]) {
      const fighter = battle?.[side];
      const list = fighter?.id === CHARACTER_ID && Array.isArray(fighter.characterEffectState?.shadowSoldiers)
        ? fighter.characterEffectState.shadowSoldiers
        : [];
      const stage = stageForSide(side);
      const opponentStage = stageForSide(side === "player" ? "ai" : "player");
      const opponentSprite = opponentStage?.querySelector(".battle-sprite-side");
      const opponentSpriteUrl = opponentSprite?.currentSrc || opponentSprite?.src || "";
      list.forEach((soldier, index) => {
        const key = `${side}:${soldier.number}`;
        wanted.add(key);
        let element = soldierElement(root, side, soldier.number);
        if (!element) element = createSoldier(root, side, soldier, opponentSpriteUrl);
        element.classList.toggle("is-special", Boolean(soldier.special));
        element.style.setProperty("--queenas-soldier-hp", `${Math.max(0, Math.min(100, soldier.hp / soldier.maxHp * 100))}%`);
        element.dataset.hp = String(soldier.hp);
        element.dataset.maxHp = String(soldier.maxHp);
        positionSoldier(element, side, index, list.length, arena, stage);
      });
    }
    root.querySelectorAll("[data-queenas-persistent-soldier]").forEach((element) => {
      const key = `${element.dataset.queenasSide}:${element.dataset.soldierNumber}`;
      if (!wanted.has(key) && !element.classList.contains("is-charging")) element.remove();
    });
  }

  function scheduleImpact(effect, type, delay, registerTimeout, playLogEffect) {
    const { impactValue, impactDamageValue, impactDelayMs: _impactDelayMs, delayMs: _delayMs, ...baseEffect } = effect;
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type,
      value: impactValue,
      damageValue: Boolean(impactDamageValue),
    }), delay));
  }

  function mountProjectile(effect, arena, stageForSide, appendEffectElement, registerTimeout, className, duration) {
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);
    if (!arena || !sourceStage || !targetStage) return;
    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const sourceBodyY = registry.stagePercent(sourceStage, "--fx-body-y", 0.5);
    const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
    const chargingSoldiers = [...(arena.querySelectorAll(`[data-queenas-side="${effect.sourceSide}"][data-queenas-persistent-soldier]`) || [])]
      .sort((left, right) => Number(left.dataset.soldierNumber) - Number(right.dataset.soldierNumber));
    const chargingSoldier = className.includes("charge") ? chargingSoldiers[0] : null;
    const chargingRect = chargingSoldier?.getBoundingClientRect();
    const startX = chargingRect
      ? chargingRect.left + chargingRect.width / 2 - arenaRect.left
      : sourceRect.left + sourceRect.width * 0.52 - arenaRect.left;
    const startY = chargingRect
      ? chargingRect.top + chargingRect.height * 0.55 - arenaRect.top
      : sourceRect.top + sourceRect.height * sourceBodyY - arenaRect.top;
    const endX = targetRect.left + targetRect.width * 0.5 - arenaRect.left;
    const endY = targetRect.top + targetRect.height * targetBodyY - arenaRect.top;
    const element = document.createElement("span");
    element.className = className;
    if (chargingSoldier?.classList.contains("is-special")) {
      element.classList.add("is-special");
      const art = chargingSoldier.querySelector(".queenas-shadow-soldier-art");
      element.style.webkitMaskImage = art?.style.webkitMaskImage || "";
      element.style.maskImage = art?.style.maskImage || "";
    }
    element.dataset.characterBattleEffect = CHARACTER_ID;
    element.style.setProperty("--queenas-start-x", `${startX}px`);
    element.style.setProperty("--queenas-start-y", `${startY}px`);
    element.style.setProperty("--queenas-end-x", `${endX}px`);
    element.style.setProperty("--queenas-end-y", `${endY}px`);
    element.style.setProperty("--queenas-direction", endX >= startX ? 1 : -1);
    const mounted = appendEffectElement(arena, element);
    if (chargingSoldier) chargingSoldier.classList.add("is-charging");
    registerTimeout(window.setTimeout(() => mounted.remove(), duration));
  }

  function mountPersistentSummon(effect, arena, stageForSide) {
    const stage = stageForSide(effect.side);
    if (!arena || !stage || !effect.soldierNumber) return;
    const root = persistentRoot(arena);
    const opponentStage = stageForSide(effect.side === "player" ? "ai" : "player");
    const opponentSprite = opponentStage?.querySelector(".battle-sprite-side");
    const opponentSpriteUrl = opponentSprite?.currentSrc || opponentSprite?.src || "";
    let element = soldierElement(root, effect.side, effect.soldierNumber);
    if (!element) {
      element = createSoldier(root, effect.side, {
        number: effect.soldierNumber,
        hp: effect.soldierHp,
        maxHp: effect.soldierMaxHp,
        special: Boolean(effect.specialSoldier),
      }, opponentSpriteUrl);
    }
    element.dataset.hp = String(effect.soldierHp || 0);
    element.dataset.maxHp = String(effect.soldierMaxHp || 1);
    element.style.setProperty("--queenas-soldier-hp", "100%");
    const sideSoldiers = [...root.querySelectorAll(`[data-queenas-side="${effect.side}"][data-queenas-persistent-soldier]`)]
      .sort((left, right) => Number(left.dataset.soldierNumber) - Number(right.dataset.soldierNumber));
    sideSoldiers.forEach((soldierElement, index) => {
      positionSoldier(soldierElement, effect.side, index, sideSoldiers.length, arena, stage);
    });
  }

  function playEffect(effect, helpers) {
    const { arena, stageForSide, appendEffectElement, registerTimeout, playLogEffect } = helpers;
    if (effect.type === "queenas-shadow-spear-cast") {
      mountProjectile(effect, arena, stageForSide, appendEffectElement, registerTimeout, "battle-fx-queenas-shadow-spear", 440);
      scheduleImpact(effect, "queenas-shadow-spear-impact", SPEAR_IMPACT_DELAY_MS, registerTimeout, playLogEffect);
      return true;
    }
    if (effect.type === "queenas-shadow-charge") {
      mountProjectile(effect, arena, stageForSide, appendEffectElement, registerTimeout, "battle-fx-queenas-shadow-charge-runner", 500);
      scheduleImpact(effect, "queenas-shadow-charge-explosion", CHARGE_IMPACT_DELAY_MS, registerTimeout, playLogEffect);
      return true;
    }
    if (["queenas-shadow-summon", "queenas-warning-summon"].includes(effect.type)) {
      mountPersistentSummon(effect, arena, stageForSide);
      return true;
    }
    if (effect.type === "queenas-soldier-attack") {
      const element = arena?.querySelector(
        `[data-queenas-side="${effect.side}"][data-soldier-number="${effect.soldierNumber}"]`,
      );
      if (element) {
        element.classList.remove("is-attacking");
        void element.offsetWidth;
        element.classList.add("is-attacking");
        registerTimeout(window.setTimeout(() => element.classList.remove("is-attacking"), 520));
      }
      return true;
    }
    if (effect.type === "queenas-soldier-damaged") {
      const element = soldierElement(arena, effect.side, effect.soldierNumber);
      if (element) {
        const currentHp = Math.max(0, Number(element.dataset.hp || 0));
        const maxHp = Math.max(1, Number(element.dataset.maxHp || 1));
        const nextHp = Math.max(0, currentHp - Number(effect.soldierDamage || 0));
        element.dataset.hp = String(nextHp);
        element.style.setProperty("--queenas-soldier-hp", `${nextHp / maxHp * 100}%`);
        element.classList.remove("is-hit");
        void element.offsetWidth;
        element.classList.add("is-hit");
        registerTimeout(window.setTimeout(() => element.classList.remove("is-hit"), 460));
        if (nextHp <= 0) {
          registerTimeout(window.setTimeout(() => element.classList.add("is-vanishing"), 250));
          registerTimeout(window.setTimeout(() => element.remove(), 760));
        }
      }
      return true;
    }
    if (effect.type === "queenas-soldier-vanish") {
      const element = soldierElement(arena, effect.side, effect.soldierNumber);
      if (element) {
        element.classList.add("is-vanishing");
        registerTimeout(window.setTimeout(() => element.remove(), 520));
      }
      return true;
    }
    if (effect.type === "queenas-soldier-charge-start") {
      const element = soldierElement(arena, effect.side, effect.soldierNumber);
      if (element) element.classList.add("is-charging");
      return true;
    }
    return false;
  }

  registry.register(CHARACTER_ID, {
    effectTypes: [
      "queenas-shadow-spear-cast", "queenas-shadow-spear-impact",
      "queenas-shadow-summon", "queenas-warning-summon",
      "queenas-shadow-charge", "queenas-shadow-charge-explosion",
      "queenas-shadow-stab-impact", "queenas-self-stab-impact",
      "queenas-soldier-attack", "queenas-soldier-damaged",
      "queenas-soldier-vanish", "queenas-soldier-charge-start",
    ],
    sfx: {
      "queenas-shadow-spear-impact": "/assets/sfx/hit.wav",
      "queenas-shadow-summon": "/assets/sfx/buff.wav",
      "queenas-warning-summon": "/assets/sfx/debuff.wav",
      "queenas-shadow-charge-explosion": "/assets/sfx/hit.wav",
      "queenas-shadow-stab-impact": "/assets/sfx/hit.wav",
      "queenas-self-stab-impact": "/assets/sfx/hit.wav",
      "queenas-soldier-damaged": "/assets/sfx/hit.wav",
    },
    damage,
    shadowSoldierAction,
    soldierDamaged,
    log,
    playEffect,
    renderPersistent,
  });
})(window.VersusCharacterBattleEffects);
