"use strict";

(function registerDracleBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before dracle effects.");

  const CHARACTER_ID = "dracle";
  const DRAGON_STATUS_NAME = "혁룡";
  const DRAGON_BREATH_ACTION_NAME = "용의 숨결";
  const DRAGON_SCALE_ACTION_NAME = "용의 비늘";
  const DRAGON_CLAW_ACTION_NAME = "용의 발톱";
  const DRAGON_AWAKENING_ACTION_NAME = "혁룡 각성";
  const BREATH_IMPACT_DELAY_MS = 230;
  const BREATH_LIFETIME_MS = 310;
  const CLAW_IMPACT_DELAY_MS = 90;
  const CLAW_LIFETIME_MS = 650;
  const SCALE_LIFETIME_MS = 760;
  const AWAKENING_LIFETIME_MS = 980;

  function stateDragonStacks(battle, side) {
    const fighter = side ? battle?.[side] : null;
    const stateText = String(fighter?.stateText || fighter?.state_text || "");
    const match = stateText.match(/(?:^|\s|,)혁룡\s+(\d+)(?:\/\d+)?/);
    return match ? Number(match[1]) : 0;
  }

  function stackScale(stacks) {
    const amount = Math.max(0, Math.min(15, Number(stacks) || 0));
    return 1 + amount * (14 / 225);
  }

  function setStackPresentation(element, stacks) {
    const amount = Math.max(0, Math.min(15, Number(stacks) || 0));
    const scale = stackScale(amount);
    element.style.setProperty("--dracle-stack-scale", scale.toFixed(2));
    for (const factor of [0.35, 0.48, 0.58, 0.78, 0.82, 1.02, 1.04, 1.1]) {
      element.style.setProperty(
        `--dracle-stack-scale-${String(factor).replace(".", "")}`,
        (scale * factor).toFixed(3),
      );
    }
    element.dataset.dragonStacks = String(amount);
    if (amount >= 5) element.classList.add("is-dracle-glowing");
    if (amount >= 10) element.classList.add("is-dracle-high-stack");
    if (amount >= 15) element.classList.add("is-dracle-max-stack");
  }

  function counterChange({
    actionName,
    line,
    targetName,
    targetSide,
    before,
    after,
    makeLogEffect,
  }) {
    if (after <= before) return undefined;
    const gain = makeLogEffect(
      "dragon-stack-gain",
      targetName,
      targetName,
      `${DRAGON_STATUS_NAME}+${after - before}`,
      targetSide,
      targetSide,
    );
    if (!gain) return null;
    const result = { ...gain, valueKind: "stack-gain", dragonStacks: after };
    if (actionName !== DRAGON_AWAKENING_ACTION_NAME || String(line || "").includes("/")) return result;
    const awakening = makeLogEffect(
      "dragon-awakening",
      targetName,
      targetName,
      null,
      targetSide,
      targetSide,
    );
    return awakening ? { ...result, concurrentEffects: [awakening] } : result;
  }

  function damage({
    actionName,
    actorName,
    actorSide,
    targetName,
    targetSide,
    damage: rawDamage,
    battle,
    makeLogEffect,
  }) {
    const damageValue = Number(rawDamage);
    if (![DRAGON_BREATH_ACTION_NAME, DRAGON_CLAW_ACTION_NAME].includes(actionName)) return undefined;
    if (!(damageValue > 0)) return null;
    const effect = makeLogEffect(
      actionName === DRAGON_BREATH_ACTION_NAME ? "dragon-breath-flight" : "dragon-claw",
      targetName,
      actorName,
      null,
      targetSide,
      actorSide,
    );
    return effect ? {
      ...effect,
      dragonStacks: stateDragonStacks(battle, actorSide),
      impactValue: damageValue,
      impactDamageValue: true,
    } : null;
  }

  function log({ line, actionName, actorName, actorSide, battle, makeLogEffect }) {
    if (
      actionName !== DRAGON_SCALE_ACTION_NAME
      || !String(line || "").startsWith("이번 턴 동안 공격 피해가 ")
    ) return undefined;
    const effect = makeLogEffect(
      "dragon-scale-guard",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
    return effect ? { ...effect, dragonStacks: stateDragonStacks(battle, actorSide) } : null;
  }

  function scheduleImpact(effect, delayMs, registerTimeout, playLogEffect) {
    const {
      characterEffectId: _characterEffectId,
      dragonStacks: _dragonStacks,
      impactValue,
      impactDamageValue,
      ...baseEffect
    } = effect;
    registerTimeout(window.setTimeout(() => playLogEffect({
      ...baseEffect,
      type: "hit",
      value: impactValue,
      damageValue: Boolean(impactDamageValue),
    }), delayMs));
  }

  function mountStageEffect(effect, stage, className, lifetimeMs, appendEffectElement, registerTimeout) {
    if (!stage) return null;
    const element = document.createElement("span");
    element.className = `battle-fx-effect ${className}`;
    element.dataset.characterBattleEffect = CHARACTER_ID;
    setStackPresentation(element, effect.dragonStacks);
    const mounted = appendEffectElement(stage, element);
    registerTimeout(window.setTimeout(() => mounted.remove(), lifetimeMs));
    return mounted;
  }

  function mountBreath(effect, arena, stageForSide, appendEffectElement, registerTimeout) {
    const sourceStage = stageForSide(effect.sourceSide);
    const targetStage = stageForSide(effect.side);
    if (!arena || !sourceStage || !targetStage) return false;

    const arenaRect = arena.getBoundingClientRect();
    const sourceRect = sourceStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    const sourceBodyY = registry.stagePercent(sourceStage, "--fx-body-y", 0.5);
    const targetBodyY = registry.stagePercent(targetStage, "--fx-body-y", 0.5);
    const startX = sourceRect.left + sourceRect.width * 0.5 - arenaRect.left;
    const startY = sourceRect.top + sourceRect.height * sourceBodyY - arenaRect.top;
    const endX = targetRect.left + targetRect.width * 0.5 - arenaRect.left;
    const endY = targetRect.top + targetRect.height * targetBodyY - arenaRect.top;
    const direction = endX >= startX ? 1 : -1;
    const angle = Math.atan2(endY - startY, Math.abs(endX - startX)) * direction;

    const projectile = document.createElement("span");
    projectile.className = "battle-fx-dragon-breath-flight";
    projectile.dataset.characterBattleEffect = CHARACTER_ID;
    projectile.style.setProperty("--dracle-breath-start-x", `${startX}px`);
    projectile.style.setProperty("--dracle-breath-start-y", `${startY}px`);
    projectile.style.setProperty("--dracle-breath-end-x", `${endX}px`);
    projectile.style.setProperty("--dracle-breath-end-y", `${endY}px`);
    projectile.style.setProperty("--dracle-breath-angle", `${angle}rad`);
    projectile.style.setProperty("--dracle-breath-flip", direction);
    setStackPresentation(projectile, effect.dragonStacks);
    const mounted = appendEffectElement(arena, projectile);
    registerTimeout(window.setTimeout(() => mounted.remove(), BREATH_LIFETIME_MS));
    return true;
  }

  function playEffect(effect, {
    arena,
    stageForSide,
    appendEffectElement = (parent, element) => { parent.append(element); return element; },
    registerTimeout,
    playLogEffect,
  }) {
    if (effect.type === "dragon-breath-flight") {
      const mounted = mountBreath(effect, arena, stageForSide, appendEffectElement, registerTimeout);
      if (mounted) {
        const {
          impactValue,
          impactDamageValue,
          ...baseEffect
        } = effect;
        registerTimeout(window.setTimeout(() => playLogEffect({
          ...baseEffect,
          type: "dragon-breath-impact",
          value: impactValue,
          damageValue: Boolean(impactDamageValue),
        }), BREATH_IMPACT_DELAY_MS));
      }
      return mounted;
    }
    if (effect.type === "dragon-breath-impact") {
      const targetStage = stageForSide(effect.side);
      if (!targetStage) return false;
      const amount = Math.max(0, Math.min(15, Number(effect.dragonStacks) || 0));
      const scale = stackScale(amount);
      for (const factor of [0.35, 0.78, 1.02, 1.1]) {
        targetStage.style.setProperty(
          `--dracle-stack-scale-${String(factor).replace(".", "")}`,
          (scale * factor).toFixed(3),
        );
      }
      targetStage.classList.toggle("is-dracle-glowing", amount >= 5);
      targetStage.classList.toggle("is-dracle-high-stack", amount >= 10);
      targetStage.classList.toggle("is-dracle-max-stack", amount >= 15);
      registerTimeout(window.setTimeout(() => {
        targetStage.classList.remove("is-dracle-glowing", "is-dracle-high-stack", "is-dracle-max-stack");
      }, 760));
      return false;
    }
    if (effect.type === "dragon-claw") {
      const targetStage = stageForSide(effect.side);
      const mounted = mountStageEffect(
        effect,
        targetStage,
        "battle-fx-dragon-claw",
        CLAW_LIFETIME_MS,
        appendEffectElement,
        registerTimeout,
      );
      if (mounted) {
        const element = mounted.matches?.(".battle-fx-dragon-claw")
          ? mounted
          : mounted.querySelector?.(".battle-fx-dragon-claw");
        element?.style.setProperty("--dracle-claw-flip", effect.sourceSide === "ai" ? -1 : 1);
        scheduleImpact(effect, CLAW_IMPACT_DELAY_MS, registerTimeout, playLogEffect);
      }
      return Boolean(mounted);
    }
    if (effect.type === "dragon-scale-guard") {
      return Boolean(mountStageEffect(
        effect,
        stageForSide(effect.side),
        "battle-fx-dragon-scale-guard",
        SCALE_LIFETIME_MS,
        appendEffectElement,
        registerTimeout,
      ));
    }
    if (effect.type === "dragon-awakening") {
      const mounted = mountStageEffect(
        effect,
        stageForSide(effect.side),
        "battle-fx-dragon-awakening",
        AWAKENING_LIFETIME_MS,
        appendEffectElement,
        registerTimeout,
      );
      if (mounted && !mounted.matches?.(".battle-fx-dragon-awakening")) mounted.style.zIndex = "0";
      return Boolean(mounted);
    }
    return false;
  }

  registry.register(CHARACTER_ID, {
    statusEffects: [DRAGON_STATUS_NAME],
    effectTypes: [
      "dragon-stack-gain",
      "dragon-breath-flight",
      "dragon-breath-impact",
      "dragon-scale-guard",
      "dragon-claw",
      "dragon-awakening",
    ],
    sfx: {
      "dragon-stack-gain": "/assets/sfx/stack-gain.wav",
      "dragon-breath-impact": "/assets/sfx/hit.wav",
      "dragon-scale-guard": "/assets/sfx/defense.wav",
      "dragon-awakening": "/assets/sfx/buff.wav",
    },
    counterChange,
    damage,
    log,
    playEffect,
  });
})(window.VersusCharacterBattleEffects);
