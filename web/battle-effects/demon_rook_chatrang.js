"use strict";

(function registerDemonRookChatrangBattleEffects(registry) {
  if (!registry) throw new Error("VersusCharacterBattleEffects must load before Chatrang effects.");

  const CHARACTER_ID = "demon_rook_chatrang";
  const BARRAGE_ACTION_NAME = "백철의 난타";
  const SWAP_ACTION_NAME = "전략적 위치 변경";
  const WALLBREAKER_ACTION_NAME = "무채의 파성";
  let barrageHitIndex = 0;

  function action({ actionName }) {
    if (actionName === BARRAGE_ACTION_NAME) barrageHitIndex = 0;
    return undefined;
  }

  function damage({ actionName, actorName, actorSide, targetName, targetSide, damage, makeLogEffect }) {
    const isBarrage = actionName === BARRAGE_ACTION_NAME;
    const isWallbreaker = actionName === WALLBREAKER_ACTION_NAME;
    if (!isBarrage && !isWallbreaker) return undefined;
    if (!(damage > 0)) return null;
    const effectType = isBarrage
      ? `chatrang-white-iron-barrage-${(barrageHitIndex++ % 2) + 1}`
      : "chatrang-colorless-wallbreaker";
    const effect = makeLogEffect(effectType, targetName, actorName, damage, targetSide, actorSide);
    return effect ? { ...effect, damageValue: true } : null;
  }

  function success({ actionName, actorName, actorSide, makeLogEffect }) {
    if (actionName !== SWAP_ACTION_NAME) return undefined;
    return makeLogEffect(
      "chatrang-strategic-position-change",
      actorName,
      actorName,
      null,
      actorSide,
      actorSide,
    );
  }

  registry.register(CHARACTER_ID, {
    effectTypes: [
      "chatrang-white-iron-barrage-1",
      "chatrang-white-iron-barrage-2",
      "chatrang-strategic-position-change",
      "chatrang-colorless-wallbreaker",
    ],
    sfx: {
      "chatrang-white-iron-barrage-1": "/assets/sfx/hit.wav",
      "chatrang-white-iron-barrage-2": "/assets/sfx/hit.wav",
      "chatrang-strategic-position-change": "/assets/sfx/defense.wav",
      "chatrang-colorless-wallbreaker": "/assets/sfx/hit.wav",
    },
    action,
    damage,
    success,
  });
})(window.VersusCharacterBattleEffects);
