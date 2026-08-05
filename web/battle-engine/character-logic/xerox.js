"use strict";

const CHARACTER_ID = "xerox";
const ORBIT = "궤도";
const METEOR_MP = "유성 낙하 예정 MP";
const METEOR_POWER = "유성 낙하 예정 위력";
const ATTACK_WAIT = "공격 대기";
const DEFENSE_LOCK = "방어 선택 불가";
const METEOR_SLOT = "meteor";
const METEOR_KEY = `${CHARACTER_ID}:${METEOR_SLOT}`;
const BASE_METEOR_MP = 20;
const BASE_METEOR_POWER = 30;

function floorInt(value) {
  return Math.floor(Number(value));
}

function nonnegativeInt(value) {
  return Math.max(0, floorInt(value || 0));
}

function orbit(fighter) {
  return nonnegativeInt(fighter.counters[ORBIT]);
}

function meteorMp(fighter) {
  return nonnegativeInt(fighter.counters[METEOR_MP] ?? BASE_METEOR_MP);
}

function meteorPower(fighter) {
  return nonnegativeInt(fighter.counters[METEOR_POWER] ?? BASE_METEOR_POWER);
}

function attackWait(fighter) {
  return nonnegativeInt(fighter.counters[ATTACK_WAIT]);
}

function meteorActionDefinition(fighter = null) {
  return {
    number: 8,
    name: "유성 낙하",
    target: "상대",
    mp: fighter ? meteorMp(fighter) : BASE_METEOR_MP,
    power: fighter ? meteorPower(fighter) : BASE_METEOR_POWER,
    accuracy: 100,
    priority: 0,
    description: "효과 없음.",
    common: false,
    characterId: CHARACTER_ID,
    slot: METEOR_SLOT,
  };
}

function isMeteor(action) {
  return action?.isSkill?.(CHARACTER_ID, METEOR_SLOT) === true;
}

function setCounter(battle, fighter, name, value) {
  const before = nonnegativeInt(fighter.counters[name]);
  const after = nonnegativeInt(value);
  fighter.counters[name] = after;
  if (before !== after) battle.logs.push(`${fighter.name}의 ${name} ${before} -> ${after}`);
}

function addOrbit(battle, fighter, amount) {
  setCounter(battle, fighter, ORBIT, orbit(fighter) + Number(amount));
}

function setMeteorMp(battle, fighter, value) {
  setCounter(battle, fighter, METEOR_MP, value);
}

function setMeteorPower(battle, fighter, value) {
  setCounter(battle, fighter, METEOR_POWER, value);
}

function resetMeteor(battle, fighter) {
  setMeteorMp(battle, fighter, BASE_METEOR_MP);
  setMeteorPower(battle, fighter, BASE_METEOR_POWER);
}

function multiplierText(value) {
  const rounded = Math.round(Number(value) * 100) / 100;
  return Number.isInteger(rounded) ? String(Math.trunc(rounded)) : String(rounded);
}

module.exports = {
  HIDDEN_COUNTERS: new Set([METEOR_MP, METEOR_POWER, ATTACK_WAIT]),

  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has(ORBIT)) fighter.counters[ORBIT] = 0;
    fighter.counters[METEOR_MP] = BASE_METEOR_MP;
    fighter.counters[METEOR_POWER] = BASE_METEOR_POWER;
    fighter.counters[ATTACK_WAIT] = 0;
  },

  actionDefinitionForKey(actionKey) {
    return actionKey === METEOR_KEY ? meteorActionDefinition() : null;
  },

  isLegalChoiceStatus(_battle, fighter, action) {
    if (Number(fighter.statuses[DEFENSE_LOCK]?.remaining || 0) > 0 && action.isDefense) return false;
    return null;
  },

  counterStateText(fighter, name, value) {
    if (name !== ORBIT) return undefined;
    return `${ORBIT} ${nonnegativeInt(value)} · 유성 낙하 MP ${meteorMp(fighter)} / 위력 ${meteorPower(fighter)}`;
  },

  extraStateParts(_battle, fighter) {
    const waiting = attackWait(fighter);
    return [`공격 대기 ${waiting}턴 · 공격 피해 ×${multiplierText(1 + waiting * 0.05)}`];
  },

  counterResourceValue(fighter, name) {
    if (name === ORBIT) {
      const count = orbit(fighter);
      if (count === 1) return Math.min(2600, meteorPower(fighter) * 18);
      return Math.min(900, count * 80);
    }
    if (name === METEOR_POWER) return Math.min(2400, Math.max(0, meteorPower(fighter) - BASE_METEOR_POWER) * 16);
    if (name === METEOR_MP) return (BASE_METEOR_MP - meteorMp(fighter)) * 28;
    if (name === ATTACK_WAIT) return Math.min(500, attackWait(fighter) * 45);
    return undefined;
  },

  isLegalChoice(_battle, fighter, action) {
    if (orbit(fighter) === 1) return !isMeteor(action);
    if (isMeteor(action)) return false;
    return null;
  },

  onMakeChoice(battle, fighter, action, choice) {
    if (orbit(fighter) !== 1 || isMeteor(action)) return;
    const replacement = battle.actionFromKey(METEOR_KEY);
    replacement.mp = meteorMp(fighter);
    replacement.power = meteorPower(fighter);
    replacement.ownerCharacterId = fighter.characterId;
    replacement.transformed = fighter.characterId !== CHARACTER_ID;
    choice.action = replacement;
    choice.cost = replacement.mp;
    choice.priority = replacement.priority;
    choice.power = replacement.power;
    choice.accuracy = replacement.accuracy;
    choice.hitCount = 1;
    choice.selectedActionKey = replacement.key;
    choice.actionReplacementLocked = true;
  },

  attackDamageMultipliers(_battle, choice) {
    return choice.action.isAttack ? [1 + attackWait(choice.actor) * 0.05] : [];
  },

  estimatedDamageMultipliers(_battle, actor, _target, action) {
    return action.isAttack ? [1 + attackWait(actor) * 0.05] : [];
  },

  estimatedPower(_battle, actor, _target, action, power) {
    if (!action.isSkill(CHARACTER_ID, 2)) return power;
    return power + floorInt(meteorPower(actor) * 0.4);
  },

  applyConditionEffects(battle, choice) {
    const actor = choice.actor;
    if (choice.action.isSkill(CHARACTER_ID, 2)) {
      const transferredPower = floorInt(meteorPower(actor) * 0.4);
      setMeteorPower(battle, actor, meteorPower(actor) - transferredPower);
      choice.power = Number(choice.power || 0) + transferredPower;
    }
    if (choice.action.isSkill(CHARACTER_ID, 3) && orbit(actor) < 2) return false;
    return true;
  },

  applyNonAttackEffects(battle, choice) {
    const actor = choice.actor;
    const action = choice.action;
    if (action.isSkill(CHARACTER_ID, 1)) {
      const previousOrbit = orbit(actor);
      if (previousOrbit > 0) setMeteorMp(battle, actor, meteorMp(actor) - previousOrbit * 2);
      addOrbit(battle, actor, 3);
      return true;
    }
    if (action.isSkill(CHARACTER_ID, 3)) {
      battle.applyDefense(actor, action.name);
      return true;
    }
    return false;
  },

  onDefenseHit(battle, choice) {
    const defender = battle.opponent(choice.actor);
    if (defender.defenseName !== "막을 수 없는 운명") return;
    battle.addStatus(choice.actor, DEFENSE_LOCK, 2, 1, defender.name);
    setCounter(battle, defender, ORBIT, 2);
  },

  onHitAfterDefenseAsActor(battle, choice) {
    const actor = choice.actor;
    if (choice.action.isSkill(CHARACTER_ID, 0)) {
      const previousOrbit = orbit(actor);
      if (previousOrbit > 0) setMeteorPower(battle, actor, meteorPower(actor) + previousOrbit * 8);
      addOrbit(battle, actor, 2);
    } else if (choice.action.isSkill(CHARACTER_ID, 2)) {
      addOrbit(battle, actor, 4);
    }
  },

  finishAction(battle, choice) {
    if (isMeteor(choice.action)) resetMeteor(battle, choice.actor);
  },

  onTurnEnd(battle, fighter) {
    const selectedKind = battle.record.selectedKind[fighter.side];
    const next = battle.kindIsAttack(selectedKind) ? 0 : attackWait(fighter) + 1;
    setCounter(battle, fighter, ATTACK_WAIT, next);
  },

  decrementCounters(fighter) {
    fighter.counters[ORBIT] = Math.max(0, orbit(fighter) - 1);
  },

  setupValue(battle, actor, target, action) {
    const currentOrbit = orbit(actor);
    if (action.isSkill(CHARACTER_ID, 0)) {
      const gain = currentOrbit * 8;
      let value = currentOrbit === 0 ? 820 : 420 + Math.min(1800, gain * 18);
      if (currentOrbit >= 6) value -= (currentOrbit - 5) * 180;
      return value;
    }
    if (action.isSkill(CHARACTER_ID, 1)) {
      const reduction = Math.min(meteorMp(actor), currentOrbit * 2);
      let value = 480 + reduction * 70 + Math.min(600, currentOrbit * 55);
      if (currentOrbit >= 8) value -= (currentOrbit - 7) * 180;
      return value;
    }
    if (action.isSkill(CHARACTER_ID, 3)) {
      if (currentOrbit < 2) return -4000;
      const incoming = battle.estimateBestIncomingDamage(target, actor);
      const recent = battle.recentKindCounts(target, 4);
      let value = 520 + incoming * 0.65 + recent.attack * 180;
      if (currentOrbit === 2) value += 520;
      if (actor.hp <= incoming) value += 1600;
      return value;
    }
    return 0;
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    const currentOrbit = orbit(actor);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    let value = 0;

    if (isMeteor(action)) {
      value += expectedDamage * 2.4;
      if (expectedDamage >= target.hp) value += 5200;
      if (actor.mp < meteorMp(actor)) value -= 3200;
      return value;
    }
    if (action.isSkill(CHARACTER_ID, 0)) {
      value += expectedDamage * 0.8 + (currentOrbit === 0 ? 680 : Math.min(1800, currentOrbit * 8 * 15)) * hitRate;
      if (currentOrbit >= 7) value -= (currentOrbit - 6) * 260;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      const reduction = Math.min(meteorMp(actor), currentOrbit * 2);
      value += 420 + reduction * 65 + Math.min(720, currentOrbit * 70);
      if (currentOrbit >= 8) value -= (currentOrbit - 7) * 220;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      value += expectedDamage * 1.25 + 360 * hitRate;
      if (expectedDamage >= target.hp) value += 3200;
      if (currentOrbit >= 7) value -= 500;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      const recent = battle.recentKindCounts(target, 4);
      value += incoming * 0.7 + recent.attack * 180;
      if (currentOrbit === 2) value += 520;
      if (actor.hp <= incoming * 1.15) value += 1400;
    } else if (action.isCommonAction("meditation")) {
      if (actor.mp < 45) value += 520 + (45 - actor.mp) * 16;
      if (currentOrbit === 2 && actor.mp >= meteorMp(actor)) value -= 420;
    } else if (action.isAttack && attackWait(actor) >= 3) {
      value += expectedDamage * 0.65;
    }
    return value;
  },

  wouldConditionFail(_battle, actor, _target, action) {
    return action.isSkill(CHARACTER_ID, 3) && orbit(actor) < 2;
  },
};

module.exports.borrowedEffects = {
  extraStateParts: module.exports.extraStateParts,
  onTurnEnd: module.exports.onTurnEnd,
  decrementCounters: module.exports.decrementCounters,
  attackDamageMultipliers: module.exports.attackDamageMultipliers,
  estimatedDamageMultipliers: module.exports.estimatedDamageMultipliers,
};
