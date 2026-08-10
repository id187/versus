"use strict";

(function registerDemonFighterGranBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before Gran effects.");

  const CHARACTER_ID = "demon_fighter_gran";
  const ATTACK_ACTION_NAME = "흑권쇄도";
  const UTILITY_ACTION_NAME = "무채의 투혼";

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (actionName !== ATTACK_ACTION_NAME) return undefined;
    if (!(damage > 0)) return null;
    const effect = makeLogEffect("gran-black-fist-barrage", targetName, actorName, damage, targetSide, actorSide);
    return effect ? { ...effect, damageValue: true } : null;
  }

  function statEffect({ actionName, actorName, actorSide, stat, makeLogEffect }) {
    if (actionName !== UTILITY_ACTION_NAME || stat !== "atk") return undefined;
    return makeLogEffect("gran-colorless-fighting-spirit", actorName, actorName, null, actorSide, actorSide);
  }

  registry.register(CHARACTER_ID, {
    effectTypes: ["gran-black-fist-barrage", "gran-colorless-fighting-spirit"],
    sfx: {
      "gran-black-fist-barrage": "/assets/sfx/hit.wav",
      "gran-colorless-fighting-spirit": "/assets/sfx/buff.wav",
    },
    damage,
    statEffect,
  });
})(window.VersusCharacterBattleEffects);
