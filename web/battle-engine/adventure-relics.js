"use strict";

function normalizeAdventureRelics(relics) {
  if (!Array.isArray(relics)) return [];
  const ids = new Set();
  return relics.map((relic) => {
    const id = String(relic?.id || "").trim();
    if (!id || ids.has(id)) throw new Error(`Adventure 유물 ID가 올바르지 않습니다: ${id || "(없음)"}`);
    ids.add(id);
    const pool = String(relic.pool || "shop");
    if (!['shop', 'event'].includes(pool)) throw new Error(`Adventure 유물 풀을 알 수 없습니다: ${id}`);
    return {
      id,
      name: String(relic.name || id),
      pool,
      price: Math.max(0, Math.trunc(Number(relic.price || 0))),
      symbol: String(relic.symbol || "◆"),
      description: String(relic.description || ""),
      effects: Array.isArray(relic.effects)
        ? relic.effects.map((effect) => ({ ...effect, type: String(effect?.type || "") })).filter((effect) => effect.type)
        : [],
    };
  });
}

function adventureRelicsForPool(catalog, pool) {
  return (catalog || []).filter((relic) => relic?.pool === pool);
}

function adventureRelicById(catalog, relicId) {
  return (catalog || []).find((relic) => relic?.id === String(relicId || "")) || null;
}

function fighterAdventureRelics(fighter) {
  return Array.isArray(fighter?.adventureRelics) ? fighter.adventureRelics : [];
}

function hasAdventureRelic(fighter, relicId) {
  return fighterAdventureRelics(fighter).some((relic) => relic?.id === String(relicId || "") && !relic.destroyed);
}

function adventureRelicEffects(fighter, type) {
  const effects = [];
  for (const relic of fighterAdventureRelics(fighter)) {
    if (relic?.destroyed) continue;
    for (const effect of relic.effects || []) {
      if (!type || effect?.type === type) effects.push({ ...effect, relicId: relic.id, relicName: relic.name });
    }
  }
  return effects;
}

function adventureRelicEffectSum(fighter, type, field = "amount") {
  return adventureRelicEffects(fighter, type)
    .reduce((sum, effect) => sum + (Number.isFinite(Number(effect[field])) ? Number(effect[field]) : 0), 0);
}

function adventureRelicEffectProduct(fighter, type, field = "multiplier") {
  return adventureRelicEffects(fighter, type)
    .reduce((product, effect) => product * (Number.isFinite(Number(effect[field])) ? Number(effect[field]) : 1), 1);
}

function grantAdventureRelic(adventure, fighter, relic) {
  if (!relic?.id) throw new Error("획득할 Adventure 유물이 없습니다.");
  const current = Array.isArray(adventure.playerRelics) ? adventure.playerRelics : [];
  if (current.some((owned) => owned?.id === relic.id && !owned.destroyed)) {
    throw new Error("이미 보유한 유물입니다.");
  }
  const owned = clone({ ...relic, destroyed: false });
  adventure.playerRelics = [...current.filter((item) => item?.id !== relic.id), owned];
  adventure.achievementStats = adventure.achievementStats || {};
  adventure.achievementStats.relicsAcquired = Math.max(
    0,
    Math.trunc(Number(adventure.achievementStats.relicsAcquired || 0)),
  ) + 1;
  if (fighter) fighter.adventureRelics = clone(adventure.playerRelics);
  return owned;
}

function destroyAdventureRelic(fighter, relicId) {
  const relic = fighterAdventureRelics(fighter).find((item) => item?.id === String(relicId || "") && !item.destroyed);
  if (!relic) return null;
  relic.destroyed = true;
  return relic;
}

function syncAdventureRelicsFromFighter(adventure, fighter) {
  adventure.playerRelics = clone(fighterAdventureRelics(fighter));
  return adventure.playerRelics;
}

function clone(value) {
  return globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
}

module.exports = {
  adventureRelicById,
  adventureRelicEffectProduct,
  adventureRelicEffectSum,
  adventureRelicEffects,
  adventureRelicsForPool,
  destroyAdventureRelic,
  fighterAdventureRelics,
  grantAdventureRelic,
  hasAdventureRelic,
  normalizeAdventureRelics,
  syncAdventureRelicsFromFighter,
};
