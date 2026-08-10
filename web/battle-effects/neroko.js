"use strict";

(function registerNerokoBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before neroko effects.");

  const CHARACTER_ID = "neroko";
  const CAT_GRUDGE_ACTION_NAME = "고양이의 한";
  const DESPERATE_ACTION_NAME = "죽을 힘을 다해";
  const COMPANION_ACTION_NAME = "길동무";

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName === DESPERATE_ACTION_NAME) {
      return makeLogEffect("desperate-heart", actorName, actorName, null, actorSide, actorSide);
    }
    if (actionName === COMPANION_ACTION_NAME) {
      return makeLogEffect("companion-smoke", actorName, actorName, null, actorSide, actorSide);
    }
    return undefined;
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (actionName !== CAT_GRUDGE_ACTION_NAME) return undefined;
    const effect = makeLogEffect("cat-grudge", targetName, actorName, damage, targetSide, actorSide);
    return effect ? { ...effect, damageValue: damage > 0 } : null;
  }

  function counterChange({ statusName, targetName, targetSide, before, after, makeLogEffect }) {
    if (statusName !== "잔기" || before === after) return undefined;
    const type = after < before ? "life-flame-extinguish" : "life-flame-ignite";
    return makeLogEffect(type, targetName, targetName, null, targetSide, targetSide);
  }

  registry.register(CHARACTER_ID, {
    statusEffects: ["잔기"],
    effectTypes: [
      "life-flame-extinguish",
      "life-flame-ignite",
      "cat-grudge",
      "desperate-heart",
      "companion-smoke",
    ],
    sfx: {
      "life-flame-extinguish": "/assets/sfx/debuff.wav",
      "life-flame-ignite": "/assets/sfx/buff.wav",
      "cat-grudge": "/assets/sfx/hit.wav",
      "desperate-heart": "/assets/sfx/buff.wav",
      "companion-smoke": "/assets/sfx/debuff.wav",
    },
    success,
    damage,
    counterChange,
  });
})(window.VersusCharacterBattleEffects);
