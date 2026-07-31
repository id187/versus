"use strict";

const CHARACTER_ID = "revesha";

function floorInt(value) {
  return Math.floor(value);
}

function actionFromKey(fighter, key) {
  if (!key) return null;
  if (key === "common:normal_attack") return { name: "일반 공격", isAttack: true };
  if (key === "common:defense") return { name: "일반 방어", isAttack: false };
  if (key === "common:meditation") return { name: "명상", isAttack: false };
  const [id, slotText] = String(key).split(":");
  const slot = Number(slotText);
  if (id !== fighter.characterId || !Number.isInteger(slot)) return { name: String(key), isAttack: false };
  const skill = fighter.data.skills?.[slot];
  return skill ? { name: skill.name, isAttack: skill.power != null } : { name: String(key), isAttack: false };
}

function addCounter(battle, fighter, name, amount) {
  if (typeof battle.addCounter === "function") {
    battle.addCounter(fighter, name, amount);
    return;
  }
  const before = Number(fighter.counters[name] || 0);
  fighter.counters[name] = before + Number(amount);
  battle.logs.push(`${fighter.name}의 ${name} ${before} -> ${fighter.counters[name]}`);
}

function actionKindForKey(fighter, key) {
  if (key === "common:normal_attack") return "attack";
  if (key === "common:defense") return "defense";
  if (key === "common:meditation") return "meditation";
  const action = actionFromKey(fighter, key);
  if (!action) return null;
  if (action.isAttack) return "attack";
  const [, slotText] = String(key).split(":");
  const skill = fighter.data.skills?.[Number(slotText)];
  return String(skill?.description || "").includes("자신이 이 턴에 입는 공격 피해를 경감") ? "defense" : null;
}

function recentKindCounts(battle, fighter, limit = 4) {
  const counts = { attack: 0, defense: 0, meditation: 0 };
  let history = fighter.selectedHistory;
  if (Object.prototype.hasOwnProperty.call(battle.record.selected, fighter.side)) history = history.slice(0, -1);
  for (const key of history.slice(-limit)) {
    const kind = actionKindForKey(fighter, key);
    if (kind) counts[kind] += 1;
  }
  return counts;
}

module.exports = {
  initUniqueState(fighter, uniqueNames) {
    if (uniqueNames.has("통찰")) fighter.counters["통찰"] = 0;
  },

  needsBattleLog() {
    return true;
  },

  renderBattleLog(_battle, fighter, lines) {
    const opponent = _battle.opponent(fighter);
    const last = actionFromKey(opponent, opponent.lastSuccessfulActionKey);
    lines.push(`상대 마지막 성공 행동: ${last?.name || "없음"}`);
  },

  counterResourceValue(_fighter, name, raw) {
    return name === "통찰" && Number.isInteger(raw) ? raw * 135 : undefined;
  },

  modifyStats(_battle, fighter, atk, defense, spd) {
    const mult = 1 + Number(fighter.counters["통찰"] || 0) * 0.05;
    return [atk * mult, defense * mult, spd * mult];
  },

  onHitAfterDefenseAsActor(battle, choice) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    const action = choice.action;
    if (action.isSkill(CHARACTER_ID, 0)) {
      battle.heal(actor, Number(actor.counters["통찰"] || 0) * 2, "날이 뒤집힌 검");
    } else if (action.isSkill(CHARACTER_ID, 2)) {
      const forbiddenKey = target.lastSuccessfulActionKey;
      if (forbiddenKey) {
        const forbidden = actionFromKey(target, forbiddenKey)?.name || forbiddenKey;
        target.forbiddenActionKey = forbiddenKey;
        target.forbiddenRemaining = 3;
        battle.logs.push(`${target.name}은 3턴 동안 ${forbidden}을 선택할 수 없다.`);
      }
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      const insight = Number(actor.counters["통찰"] || 0);
      battle.fixedDamage(target, floorInt((target.maxHp - target.hp) * (insight * 0.07)), "예견된 종말", actor);
    }
  },

  applyNonAttackEffects(battle, choice) {
    if (!choice.action.isSkill(CHARACTER_ID, 1)) return false;
    battle.applyDefense(choice.actor, choice.action.name);
    return true;
  },

  onDefenseHit(battle, choice, totalDamage) {
    const actor = choice.actor;
    const target = battle.opponent(actor);
    if (target.defenseName === "깨져버린 거울") {
      battle.fixedDamage(actor, floorInt(totalDamage * 1.3), "깨져버린 거울", target);
    }
  },

  onTurnEnd(battle, fighter) {
    const opponent = battle.opponent(fighter);
    const own = battle.record.selectedKind[fighter.side];
    const opposing = battle.record.selectedKind[opponent.side];
    const gained =
      (opposing === "명상" && battle.kindIsAttack(own)) ||
      (battle.kindIsAttack(opposing) && own === "방어") ||
      (opposing === "방어" && own === "명상");
    if (gained) {
      addCounter(battle, fighter, "통찰", 1);
      battle.record.gainedInsight[fighter.side] = true;
      return;
    }
    battle.fixedDamage(fighter, floorInt(fighter.maxHp * 0.02), "끝은 필연적이니", fighter);
    if (!battle.gameOver) battle.fixedDamage(opponent, floorInt(opponent.maxHp * 0.02), "끝은 필연적이니", fighter);
  },

  aiScore(battle, actor, target, action, expectedDamage, hitRate) {
    let value = 0;
    const insight = Number(actor.counters["통찰"] || 0);
    const counts = recentKindCounts(battle, target);
    const insightWeight = 1 + Math.max(0, 6 - insight) * 0.18;
    const incoming = battle.estimateBestIncomingDamage(target, actor);
    const history = Object.prototype.hasOwnProperty.call(battle.record.selected, target.side)
      ? target.selectedHistory.slice(0, -1)
      : target.selectedHistory;

    if (action.isAttack) {
      value += counts.meditation * 430 * insightWeight;
      if (target.mp < 35) value += 180 * insightWeight;
    }
    if (action.isDefense) {
      value += counts.attack * 440 * insightWeight;
      value += incoming * (0.95 + 0.1 * Math.max(0, 4 - insight));
      if (action.isSkill(CHARACTER_ID, 1)) {
        value += incoming * 1.45 + 240;
        if (counts.attack >= Math.max(counts.defense, counts.meditation) + 1) value += 500;
      }
    }
    if (action.isCommonAction("meditation")) {
      value += counts.defense * 430 * insightWeight;
      if (actor.mp < 55) value += 180;
    }
    if (action.isSkill(CHARACTER_ID, 0) && insight > 0) {
      value += Math.min(actor.maxHp - actor.hp, insight * 2) * 36;
    }
    if (action.isSkill(CHARACTER_ID, 2) && target.lastSuccessfulActionKey) {
      const repeated = history.slice(-3).filter((key) => key === target.lastSuccessfulActionKey).length;
      const lastKind = actionKindForKey(target, target.lastSuccessfulActionKey);
      value += 420 + repeated * 260;
      if (lastKind === "attack") value += 160;
      else if (lastKind === "defense") value += 220;
    }
    if (action.isSkill(CHARACTER_ID, 3) && insight > 0) {
      const missing = target.maxHp - target.hp;
      const fixed = floorInt(missing * (insight * 0.07));
      value += fixed * hitRate * 3.2;
      if (expectedDamage + fixed * hitRate >= target.hp) value += 3000;
      else if (insight < 3) value -= 1800;
      else {
        value += (insight - 2) * 620;
        if (insight >= 5) value += 720;
      }
    } else if (action.isSkill(CHARACTER_ID, 3)) {
      value -= 2600;
    }
    return value;
  },
};
