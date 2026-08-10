"use strict";

(function registerDemonWarriorLukeBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before Luke effects.");

  const CHARACTER_ID = "demon_warrior_luke";
  const ATTACK_ACTION_NAME = "흑철의 파쇄";
  const UTILITY_ACTION_NAME = "회철의 전투태세";

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (actionName !== ATTACK_ACTION_NAME) return undefined;
    if (!(damage > 0)) return null;
    const effect = makeLogEffect("luke-black-iron-smash", targetName, actorName, damage, targetSide, actorSide);
    return effect ? { ...effect, damageValue: true } : null;
  }

  function statEffect({ actionName, actorName, actorSide, stat, makeLogEffect }) {
    if (actionName !== UTILITY_ACTION_NAME || stat !== "atk") return undefined;
    return makeLogEffect("luke-gray-iron-stance", actorName, actorName, null, actorSide, actorSide);
  }

  registry.register(CHARACTER_ID, {
    effectTypes: ["luke-black-iron-smash", "luke-gray-iron-stance"],
    sfx: {
      "luke-black-iron-smash": "/assets/sfx/hit.wav",
      "luke-gray-iron-stance": "/assets/sfx/buff.wav",
    },
    damage,
    statEffect,
  });
})(window.VersusCharacterBattleEffects);
