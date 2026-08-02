"use strict";

const CHARACTER_ID = "fimit";
const IMITATION = "모조";
const MAX_IMITATION = 15;
const FATE_THROW_PENDING = "운명 투척 대기";
const TRANSFORM_REMAINING = "변신 지속";
const TRANSFORM_TARGET = "변신 대상";
const BORROWED_STATE_RECORD = "변신 고유 상태 기록";
const BORROWED_EFFECT_IDS = "변신 효과 처리 대상";
const DEF_COPY_VALUE = "위작 보호 DEF";
const DEF_COPY_REMAINING = "위작 보호 지속";

function floorInt(value) {
  return Math.floor(value);
}

function imitation(fighter) {
  return Math.max(0, Number(fighter.counters[IMITATION] || 0));
}

function copiedValue(fighter, name) {
  const value = Number(fighter.counters[name] || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function copiedRemaining(fighter, name) {
  return Math.max(0, Number(fighter.counters[name] || 0));
}

function commonActionKind(action) {
  if (action?.isCommonAction?.("normal_attack")) return "normal_attack";
  if (action?.isCommonAction?.("defense")) return "defense";
  if (action?.isCommonAction?.("meditation")) return "meditation";
  return null;
}

function selectedCommonKind(battle, fighter) {
  const key = battle.record.selectedKey[fighter.side];
  if (key === battle.commonActionKey("normal_attack")) return "normal_attack";
  if (key === battle.commonActionKey("defense")) return "defense";
  if (key === battle.commonActionKey("meditation")) return "meditation";
  return null;
}

function activeSelected(battle, fighter) {
  return String(battle.record.selectedKind[fighter.side] || "").startsWith("액티브");
}

function selectedActiveOriginalMp(battle, fighter) {
  if (!activeSelected(battle, fighter)) return 0;
  const action = battle.actionFromKey?.(battle.record.selectedKey[fighter.side]);
  return action?.isActive ? Math.max(0, Number(action.mp || 0)) : 0;
}

function addImitation(battle, fighter, amount) {
  const before = imitation(fighter);
  const after = Math.min(MAX_IMITATION, before + Number(amount || 0));
  fighter.counters[IMITATION] = after;
  if (after !== before) battle.logs.push(`${fighter.name}의 ${IMITATION} ${before}/${MAX_IMITATION} -> ${after}/${MAX_IMITATION}`);
}

function highestOpponentStat(battle, actor) {
  const target = battle.opponent(actor);
  const [atk, defense, spd] = battle.currentStats(target);
  return floorInt(Math.max(atk, defense, spd));
}

function setCopiedStat(battle, actor, valueName, remainingName, statName, turns) {
  const value = highestOpponentStat(battle, actor);
  actor.counters[valueName] = value;
  actor.counters[remainingName] = Number(turns);
  battle.logs.push(`${actor.name}의 ${statName}이 ${turns}턴 동안 ${value}가 된다.`);
}

function decrementTimedCopy(fighter, valueName, remainingName) {
  const remaining = copiedRemaining(fighter, remainingName);
  if (remaining <= 0) return;
  if (remaining <= 1) {
    delete fighter.counters[valueName];
    delete fighter.counters[remainingName];
  } else fighter.counters[remainingName] = remaining - 1;
}

function activeTransformTarget(battle, fighter) {
  const remaining = copiedRemaining(fighter, TRANSFORM_REMAINING);
  const targetId = fighter.counters[TRANSFORM_TARGET];
  if (remaining <= 0 || !targetId) return null;
  return battle?.characterDataById?.(targetId)?.id || null;
}

function rawDamage(expectedDamage, hitRate) {
  return hitRate > 0 ? expectedDamage / hitRate : 0;
}

module.exports = {
  HIDDEN_COUNTERS: new Set([
    FATE_THROW_PENDING,
    TRANSFORM_REMAINING,
    TRANSFORM_TARGET,
    BORROWED_STATE_RECORD,
    BORROWED_EFFECT_IDS,
    DEF_COPY_VALUE,
    DEF_COPY_REMAINING,
  ]),

  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has(IMITATION)) fighter.counters[IMITATION] = 0;
  },

  activeCharacterId(battle, fighter) {
    return activeTransformTarget(battle, fighter);
  },

  counterStateText(_fighter, name, value) {
    return name === IMITATION ? `${IMITATION} ${Number(value)}/${MAX_IMITATION}` : null;
  },

  extraStateParts(battle, fighter) {
    const parts = [];
    const transformId = activeTransformTarget(battle, fighter);
    if (transformId) {
      const name = battle.characterDataById(transformId)?.name || transformId;
      parts.push(`변신: ${name}(${copiedRemaining(fighter, TRANSFORM_REMAINING)}턴)`);
    }
    const defense = copiedValue(fighter, DEF_COPY_VALUE);
    if (defense != null) parts.push(`위작 보호: DEF ${defense}(${copiedRemaining(fighter, DEF_COPY_REMAINING)}턴)`);
    return parts;
  },

  counterResourceValue(_fighter, name, raw) {
    if (name === IMITATION && Number.isInteger(raw)) return raw * 180;
    if (name === TRANSFORM_REMAINING && Number.isInteger(raw)) return raw * 260;
    if (name === DEF_COPY_VALUE && Number.isFinite(raw)) return Math.max(0, raw - 70) * 12;
    return null;
  },

  targetEvasion(_battle, target, choice, evasion) {
    return choice.action.isAttack ? evasion + imitation(target) * 3 : evasion;
  },

  modifyStats(_battle, fighter, atk, defense, spd) {
    const copiedDef = copiedValue(fighter, DEF_COPY_VALUE);
    return [atk, copiedDef == null ? defense : copiedDef, spd];
  },

  onActionStart(battle, choice) {
    const actor = choice.actor;
    const kind = commonActionKind(choice.action);
    if (!kind || battle.isActorFirst(choice)) return false;
    choice.fimitFlashyCommon = kind;
    if (kind === "defense") {
      choice.defenseBonusReduction = Number(choice.defenseBonusReduction || 0) + 0.1;
      battle.logs.push("더 화려하게: 이번 [방어] 행동의 피해 경감률이 10%p 증가한다.");
    } else if (kind === "meditation") {
      choice.meditationRecoveryOverride = 18;
      battle.logs.push("더 화려하게: 이번 명상의 MP 회복량이 18이 된다.");
    } else if (kind === "normal_attack") {
      battle.logs.push("더 화려하게: 이번 일반 공격 명중 시 고정 피해를 추가한다.");
    }
    return false;
  },

  applyConditionEffects(battle, choice) {
    if (choice.action.isSkill(CHARACTER_ID, 2)) {
      const target = battle.opponent(choice.actor);
      const bonus = selectedActiveOriginalMp(battle, target);
      if (activeSelected(battle, target)) {
        choice.power = Number(choice.power || 0) + bonus;
        const selectedName = battle.displayActionName(target, battle.record.selectedKey[target.side]);
        battle.logs.push(`${selectedName}의 원래 소모 MP ${bonus}만큼 간단한 속임수의 위력이 증가했다.`);
      }
    }
    return true;
  },

  onHitAfterDefenseAsActor(battle, choice, totalDamage) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    if (choice.action.isCommonAction("normal_attack") && choice.fimitFlashyCommon === "normal_attack") {
      battle.fixedDamage(target, 2, "더 화려하게", actor);
    }
    if (choice.action.isSkill(CHARACTER_ID, 0) && totalDamage > 0) {
      actor.counters[FATE_THROW_PENDING] = 1;
    }
  },

  applyNonAttackEffects(battle, choice) {
    const actor = choice.actor;
    if (choice.action.isSkill(CHARACTER_ID, 1)) {
      setCopiedStat(battle, actor, DEF_COPY_VALUE, DEF_COPY_REMAINING, "DEF", 1);
      battle.applyDefense(actor, choice.action.name, choice.defenseBonusReduction);
      return true;
    }
    if (choice.action.isSkill(CHARACTER_ID, 3)) {
      const target = battle.opponent(actor);
      const targetId = target.characterId;
      const turns = imitation(actor) + 4;
      const borrowedState = battle.initializeBorrowedCharacterState?.(actor, targetId);
      if (borrowedState) actor.counters[BORROWED_STATE_RECORD] = borrowedState;
      const effectIds = Array.isArray(actor.counters[BORROWED_EFFECT_IDS])
        ? actor.counters[BORROWED_EFFECT_IDS]
        : [];
      actor.counters[BORROWED_EFFECT_IDS] = [...new Set([...effectIds, targetId])];
      actor.counters[TRANSFORM_TARGET] = targetId;
      actor.counters[TRANSFORM_REMAINING] = turns;
      battle.logs.push(`${actor.name}은 ${turns}턴 동안 ${target.name}처럼 움직인다.`);
      return true;
    }
    return false;
  },

  onTurnEnd(battle, fighter) {
    const opponent = battle.opponent(fighter);
    const ownCommon = selectedCommonKind(battle, fighter);
    if (ownCommon && ownCommon === selectedCommonKind(battle, opponent)) addImitation(battle, fighter, 1);
    if (Number(fighter.counters[FATE_THROW_PENDING] || 0) > 0 && activeSelected(battle, opponent)) {
      addImitation(battle, fighter, 1);
    }
    delete fighter.counters[FATE_THROW_PENDING];
  },

  decrementCounters(fighter, battle) {
    decrementTimedCopy(fighter, DEF_COPY_VALUE, DEF_COPY_REMAINING);
    const remaining = copiedRemaining(fighter, TRANSFORM_REMAINING);
    if (remaining <= 0) return;
    if (remaining <= 1) {
      battle?.clearBorrowedCharacterState?.(fighter, fighter.counters[BORROWED_STATE_RECORD]);
      delete fighter.counters[BORROWED_STATE_RECORD];
      delete fighter.counters[TRANSFORM_REMAINING];
      delete fighter.counters[TRANSFORM_TARGET];
    } else fighter.counters[TRANSFORM_REMAINING] = remaining - 1;
  },

  setupValue(battle, actor, target, action) {
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const highest = highestOpponentStat(battle, actor);
    if (action.isSkill(CHARACTER_ID, 1)) {
      return Math.min(incoming, Math.max(0, highest - battle.currentStats(actor)[1])) * 18
        + (incoming >= actor.hp ? 1800 : incoming >= actor.hp * 0.55 ? 620 : 120);
    }
    if (action.isSkill(CHARACTER_ID, 3)) {
      if (copiedRemaining(actor, TRANSFORM_REMAINING) > 0) return -2400;
      return 900 + imitation(actor) * 210 + Math.max(0, target.mp - actor.mp) * 6;
    }
    return 0;
  },

  estimatedPower(battle, _actor, target, action, power) {
    if (!action.isSkill(CHARACTER_ID, 2)) return power;
    return power + selectedActiveOriginalMp(battle, target);
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const stacks = imitation(actor);
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const damage = rawDamage(expectedDamage, hitRate);
    const highest = highestOpponentStat(battle, actor);
    const ownDef = battle.currentStats(actor)[1];

    if (action.isCommonAction("normal_attack")) {
      value += stacks * 18;
      if (actor.mp < 45) value += 120;
    } else if (action.isCommonAction("defense")) {
      value += Math.min(incoming, actor.hp) * 0.9 + stacks * 8;
    } else if (action.isCommonAction("meditation")) {
      if (actor.mp < 50) value += 260 + Math.max(0, 50 - actor.mp) * 9;
    } else if (action.isSkill(CHARACTER_ID, 0)) {
      value += 180 + damage * 0.5;
      if (String(battle.record.selectedKind[target.side] || "").startsWith("액티브")) value += 420;
      if (stacks < 8) value += 220;
    } else if (action.isSkill(CHARACTER_ID, 1)) {
      value += Math.max(0, highest - ownDef) * 20 + incoming * 1.1;
      if (incoming >= actor.hp) value += 2200;
      else if (incoming < actor.hp * 0.25) value -= 360;
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      const selectedMp = selectedActiveOriginalMp(battle, target);
      const affordableActives = battle.availableActions(target).filter(
        (candidate) => candidate.isActive && battle.effectiveCost(target, candidate) <= target.mp,
      );
      const averageMp = affordableActives.length
        ? affordableActives.reduce((sum, candidate) => sum + Number(candidate.mp || 0), 0) / affordableActives.length
        : 0;
      value += damage * 0.7 + (selectedMp > 0 ? selectedMp * 32 : averageMp * 8);
      if (expectedDamage >= target.hp) value += 3200;
      if (!affordableActives.length && selectedMp <= 0) value -= 900;
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      if (copiedRemaining(actor, TRANSFORM_REMAINING) > 0) value -= 4200;
      else {
        value += 1000 + stacks * 260;
        if (target.mp >= 60 || target.hp <= target.maxHp * 0.55) value += 420;
        if (incoming >= actor.hp) value -= 850;
      }
    }
    return value;
  },
};
