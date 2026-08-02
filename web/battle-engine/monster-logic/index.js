"use strict";

const LOGICS = Object.assign(Object.create(null), {
  demon_scout_kain: require("./demon_scout_kain"),
  demon_warrior_luke: require("./demon_warrior_luke"),
  demon_mage_zero: require("./demon_mage_zero"),
  demon_archer_robin: require("./demon_archer_robin"),
  demon_priest_sara: require("./demon_priest_sara"),
  demon_fighter_gran: require("./demon_fighter_gran"),
  demon_king_monochrem: require("./demon_king_monochrem"),
});

function logicFor(id) {
  return id ? LOGICS[id] || null : null;
}

function hasLogic(id) {
  return Boolean(id && LOGICS[id]);
}

module.exports = { hasLogic, logicFor };
