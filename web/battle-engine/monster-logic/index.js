"use strict";

const LOGICS = Object.assign(Object.create(null), {
  demon_scout_kain: require("./demon_scout_kain"),
  demon_warrior_luke: require("./demon_warrior_luke"),
  demon_mage_zero: require("./demon_mage_zero"),
  demon_archer_robin: require("./demon_archer_robin"),
  demon_priest_sara: require("./demon_priest_sara"),
  demon_fighter_gran: require("./demon_fighter_gran"),
  demon_pawn_opawn: require("./demon_pawn_opawn"),
  demon_rook_chatrang: require("./demon_rook_chatrang"),
  demon_knight_kaighton: require("./demon_knight_kaighton"),
  demon_bishop_eveque: require("./demon_bishop_eveque"),
  demon_king_monochrem: require("./demon_king_monochrem"),
});

const LEGACY_OFFICER_ID_ALIASES = Object.freeze({
  opawn: "demon_pawn_opawn",
  chartrang: "demon_rook_chatrang",
  kaighton: "demon_knight_kaighton",
  eveque: "demon_bishop_eveque",
});

function canonicalMonsterId(id) {
  return id ? LEGACY_OFFICER_ID_ALIASES[id] || id : id;
}

function logicFor(id) {
  const canonicalId = canonicalMonsterId(id);
  return canonicalId ? LOGICS[canonicalId] || null : null;
}

function hasLogic(id) {
  const canonicalId = canonicalMonsterId(id);
  return Boolean(canonicalId && LOGICS[canonicalId]);
}

module.exports = { hasLogic, logicFor };
