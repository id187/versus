"use strict";

(function registerDemonKnightKaightonBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before Kaighton effects.");

  const CHARACTER_ID = "demon_knight_kaighton";
  const DUEL_ACTION_NAME = "회색의 일기토";
  const COURTESY_ACTION_NAME = "백은의 예우";
  const FORK_ACTION_NAME = "흑마의 양공";

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    const isDuel = actionName === DUEL_ACTION_NAME;
    const isFork = actionName === FORK_ACTION_NAME;
    if (!isDuel && !isFork) return undefined;
    if (!(damage > 0)) return null;
    const effect = makeLogEffect(
      isDuel ? "kaighton-gray-duel-slash" : "kaighton-black-horse-fork",
      targetName,
      actorName,
      damage,
      targetSide,
      actorSide,
    );
    return effect ? { ...effect, damageValue: true } : null;
  }

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== COURTESY_ACTION_NAME) return undefined;
    return makeLogEffect(
      "kaighton-silver-courtesy",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  registry.register(CHARACTER_ID, {
    effectTypes: [
      "kaighton-gray-duel-slash",
      "kaighton-silver-courtesy",
      "kaighton-black-horse-fork",
    ],
    sfx: {
      "kaighton-gray-duel-slash": "/assets/sfx/hit.wav",
      "kaighton-silver-courtesy": "/assets/sfx/defense.wav",
      "kaighton-black-horse-fork": "/assets/sfx/hit.wav",
    },
    damage,
    success,
  });
})(window.VersusCharacterBattleEffects);
