"use strict";

const DEFAULT_INSCRIPTION_ID = "gray";
const RANDOM_INSCRIPTION_ID = "random";

const DEFAULT_INSCRIPTIONS = [
  { id: "gray", name: "Gray", color: "#aeb4bd", description: "효과 없음" },
];

function normalizeInscriptions(items = DEFAULT_INSCRIPTIONS) {
  const result = [];
  const seen = new Set();
  for (const item of items || []) {
    const id = String(item?.id || "").trim().toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      name: String(item?.name || titleCase(id)),
      color: String(item?.color || "#aeb4bd"),
      description: String(item?.description || item?.detail || "효과 없음"),
    });
  }
  if (!result.some((item) => item.id === DEFAULT_INSCRIPTION_ID)) {
    result.unshift({ ...DEFAULT_INSCRIPTIONS[0] });
  }
  return result;
}

function inscriptionById(inscriptions, value) {
  const requested = String(value || DEFAULT_INSCRIPTION_ID).trim().toLowerCase();
  return {
    ...(inscriptions.find((item) => item.id === requested) ||
      inscriptions.find((item) => item.id === DEFAULT_INSCRIPTION_ID) ||
      DEFAULT_INSCRIPTIONS[0]),
  };
}

function hasInscription(fighter, id) {
  return fighter?.inscriptionId === id;
}

function randomInscriptionPool(inscriptions) {
  const pool = inscriptions.filter((item) => item.id !== RANDOM_INSCRIPTION_ID);
  return pool.length ? pool : inscriptions.filter((item) => item.id === DEFAULT_INSCRIPTION_ID);
}

function resolveInscriptionId(inscriptions, value, rng) {
  const requested = String(value || DEFAULT_INSCRIPTION_ID).trim().toLowerCase();
  const ids = new Set(inscriptions.map((item) => String(item.id).toLowerCase()));
  if (requested === "0" || requested === "random" || requested === RANDOM_INSCRIPTION_ID) {
    return randomInscriptionId(inscriptions, rng);
  }
  return ids.has(requested) ? requested : DEFAULT_INSCRIPTION_ID;
}

function randomInscriptionId(inscriptions, rng) {
  const pool = randomInscriptionPool(inscriptions);
  return String((rng.choice(pool) || inscriptions[0] || DEFAULT_INSCRIPTIONS[0]).id || DEFAULT_INSCRIPTION_ID).toLowerCase();
}

function whitePowerPenalty(action) {
  if (!action?.isActive || !action?.isAttack) return 0;
  return String(action.description || "").includes("[연격]") ? 1 : 2;
}

function redPowerBonus(action) {
  if (!action?.isActive || !action?.isAttack) return 0;
  return String(action.description || "").includes("[연격]") ? 1 : 3;
}

function titleCase(value) {
  return String(value).replace(/(^|[-_ ])(\w)/g, (_, prefix, char) => `${prefix}${char.toUpperCase()}`);
}

module.exports = {
  DEFAULT_INSCRIPTION_ID,
  RANDOM_INSCRIPTION_ID,
  normalizeInscriptions,
  inscriptionById,
  hasInscription,
  randomInscriptionPool,
  resolveInscriptionId,
  randomInscriptionId,
  whitePowerPenalty,
  redPowerBonus,
};
