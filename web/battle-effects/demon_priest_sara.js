"use strict";

(function registerDemonPriestSaraBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before Sara effects.");

  const CHARACTER_ID = "demon_priest_sara";
  const ATTACK_ACTION_NAME = "흑혈의 성찬";
  const UTILITY_ACTION_NAME = "빛바랜 저주";

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    if (actionName !== ATTACK_ACTION_NAME) return undefined;
    if (!(damage > 0)) return null;
    const effect = makeLogEffect("sara-black-blood-sacrament", targetName, actorName, damage, targetSide, actorSide);
    return effect ? { ...effect, damageValue: true } : null;
  }

  function statEffect({ actionName, actorName, actorSide, targetName, targetSide, stat, makeLogEffect }) {
    if (actionName !== UTILITY_ACTION_NAME || stat !== "atk") return undefined;
    return makeLogEffect("sara-faded-curse", targetName, actorName, null, targetSide, actorSide);
  }

  registry.register(CHARACTER_ID, {
    effectTypes: ["sara-black-blood-sacrament", "sara-faded-curse"],
    sfx: {
      "sara-black-blood-sacrament": "/assets/sfx/hit.wav",
      "sara-faded-curse": "/assets/sfx/debuff.wav",
    },
    damage,
    statEffect,
  });
})(window.VersusCharacterBattleEffects);
