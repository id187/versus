"use strict";

const characterLogic = require("./character-logic");
const { selectSearchAction } = require("./ai-search");
const {
  DEFAULT_INSCRIPTION_ID,
  RANDOM_INSCRIPTION_ID,
  normalizeInscriptions,
  inscriptionById,
  hasInscription,
  resolveInscriptionId,
  randomInscriptionId,
  whitePowerPenalty,
  redPowerBonus,
} = require("./inscriptions");
const { Mulberry32 } = require("./rng");
const {
  adventureRelicEffectProduct,
  adventureRelicEffectSum,
  adventureRelicEffects,
  destroyAdventureRelic,
  hasAdventureRelic,
} = require("./adventure-relics");

const MAX_MP = 100;
const START_MP = 30;
const DEFENSE_MULTIPLIERS = [0.5, 0.6, 0.7, 0.8, 0.9];
const ADVENTURE_RHYTHM_LABELS = Object.freeze({
  rush: "속공",
  wall: "철벽",
  late: "후반",
});
const AI_PERSONALITY_TUNING = {
  R: { temperature: 35, topGap: 120, exploration: 0.02, repeatPenalty: 45 },
  C: { temperature: 60, topGap: 220, exploration: 0.05, repeatPenalty: 30 },
  D: { temperature: 30, topGap: 100, exploration: 0.015, repeatPenalty: 25 },
  M: { temperature: 180, topGap: 650, exploration: 0.18, repeatPenalty: 12 },
  G: { temperature: 110, topGap: 420, exploration: 0.12, repeatPenalty: 20 },
  E: { temperature: 55, topGap: 180, exploration: 0.04, repeatPenalty: 35 },
  J: { temperature: 85, topGap: 280, exploration: 0.08, repeatPenalty: 80 },
  A: { temperature: 105, topGap: 360, exploration: 0.08, repeatPenalty: 125 },
};
const AI_SEARCH_TUNING = {
  R: { depth: 6, timeLimitMs: 1200, maxNodes: 50000, fullOrderMinDepth: 4 },
  C: { depth: 6, timeLimitMs: 1200, maxNodes: 50000, fullOrderMinDepth: 4 },
  D: { depth: 6, timeLimitMs: 1200, maxNodes: 50000, fullOrderMinDepth: 4 },
  M: { depth: 6, timeLimitMs: 1200, maxNodes: 50000, fullOrderMinDepth: 4 },
  G: { depth: 6, timeLimitMs: 1200, maxNodes: 50000, fullOrderMinDepth: 4 },
  E: { depth: 6, timeLimitMs: 1200, maxNodes: 50000, fullOrderMinDepth: 5 },
  J: { depth: 6, timeLimitMs: 1200, maxNodes: 50000, fullOrderMinDepth: 3 },
  A: { depth: 6, timeLimitMs: 1200, maxNodes: 50000, fullOrderMinDepth: 4 },
};

const AI_PERSONALITIES = [
  { id: "R", name: "합리" },
  { id: "C", name: "돌격" },
  { id: "D", name: "방어" },
  { id: "M", name: "광기" },
  { id: "G", name: "도박" },
  { id: "E", name: "인내" },
  { id: "J", name: "방해" },
  { id: "A", name: "교란" },
];

const SEARCH_LOG_SINK = Object.freeze({
  length: 0,
  push() { return 0; },
  slice() { return []; },
});

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function floorInt(value) {
  return Math.floor(value);
}

function roundStat(value) {
  if (typeof value !== "number") return value;
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? Math.trunc(rounded) : rounded;
}

function pct(value) {
  return `${Number(value).toFixed(1)}%`;
}

function defenseMultiplierForStreak(streak, bonusReduction = 0) {
  const base = streak >= 1 && streak <= DEFENSE_MULTIPLIERS.length ? DEFENSE_MULTIPLIERS[streak - 1] : 1;
  const reduction = clamp(1 - base + bonusReduction, 0, 1);
  return 1 - reduction;
}

function defenseReductionPercentForStreak(streak, bonusReduction = 0) {
  return Math.round((1 - defenseMultiplierForStreak(streak, bonusReduction)) * 100);
}

function skillKey(characterId, slot) {
  return `${characterId}:${slot}`;
}

function fighterLogLine(fighter, text) {
  return `[@${fighter.side}]${text}`;
}

function withParticle(value, consonantParticle, vowelParticle) {
  const text = String(value || "");
  const last = text.codePointAt(text.length - 1);
  const finalConsonant = last >= 0xac00 && last <= 0xd7a3 ? (last - 0xac00) % 28 : 0;
  const rieulException = consonantParticle === "으로" && vowelParticle === "로" && finalConsonant === 8;
  return `${text}${finalConsonant && !rieulException ? consonantParticle : vowelParticle}`;
}

function commonActionKey(kind) {
  return `common:${kind}`;
}

function usesAdventurePowerMultiplier(action) {
  return Boolean(action?.isActive || action?.isCommonAction?.("normal_attack"));
}

function adventureRhythmAttackMultiplier(fighter, turn, direction) {
  const rhythm = fighter?.adventureBattleRhythm;
  const kind = String(rhythm?.kind || "");
  const currentTurn = Math.max(1, Math.trunc(Number(turn || 1)));
  const earlyTurnEnd = Math.max(1, Math.trunc(Number(rhythm?.earlyTurnEnd || (kind === "late" ? 3 : 2))));
  const isEarly = currentTurn <= earlyTurnEnd;
  if (direction === "outgoing") {
    const multiplier = Number(isEarly
      ? rhythm?.earlyOutgoingDamageMultiplier
      : rhythm?.lateOutgoingDamageMultiplier);
    if (Number.isFinite(multiplier) && multiplier >= 0) return multiplier;
  }
  if (direction === "incoming") {
    const multiplier = Number(isEarly
      ? rhythm?.earlyIncomingDamageMultiplier
      : rhythm?.lateIncomingDamageMultiplier);
    if (Number.isFinite(multiplier) && multiplier >= 0) return multiplier;
  }
  return 1;
}

class Action {
  constructor({
    number,
    name,
    target,
    mp,
    power = null,
    accuracy = null,
    priority,
    description,
    common = false,
    kind = "skill",
    characterId = null,
    slot = null,
    ownerCharacterId = null,
    transformed = false,
  }) {
    this.number = Number(number);
    this.name = String(name);
    this.target = String(target);
    this.mp = Number(mp || 0);
    this.power = power == null ? null : Number(power);
    this.accuracy = accuracy == null ? null : Number(accuracy);
    this.priority = Number(priority || 0);
    this.description = String(description || "");
    this.common = Boolean(common);
    this.kind = kind;
    this.characterId = characterId;
    this.slot = slot;
    this.ownerCharacterId = ownerCharacterId || characterId;
    this.transformed = Boolean(transformed);
  }

  get isAttack() {
    return this.power !== null;
  }

  get isActive() {
    return !this.common;
  }

  get isDefense() {
    return this.kind === "defense" || this.name === "일반 방어" || this.description.includes("자신이 이 턴에 입는 공격 피해를 경감");
  }

  get key() {
    if (this.common) return commonActionKey(this.kind);
    if (this.characterId != null && this.slot != null) return skillKey(this.characterId, this.slot);
    return this.name;
  }

  isCommonAction(kind) {
    return this.common && this.kind === kind;
  }

  isSkill(characterId, slot) {
    return this.characterId === characterId && this.slot === slot;
  }
}

class Choice {
  constructor(actor, action, cost, priority) {
    this.actor = actor;
    this.action = action;
    this.cost = Number(cost || 0);
    this.priority = Number(priority || 0);
    this.power = action.power;
    this.accuracy = action.accuracy;
    this.hitCount = 1;
    this.selectedBullets = null;
    this.prevAttackActive = null;
    this.copiedFrom = null;
    this.consumedMpExtra = 0;
    this.selectedActionKey = action.key;
    this.madnessReplaced = false;
    this.madnessOriginalActionKey = null;
    this.guaranteedHit = false;
    this.defenseBonusReduction = 0;
  }

  get totalCost() {
    return this.cost + this.consumedMpExtra;
  }
}

class TurnRecord {
  constructor() {
    this.selected = {};
    this.selectedKey = {};
    this.selectedKind = {};
    this.actionSuccess = {};
    this.attackHit = {};
    this.attackDamageTaken = {};
    this.activeAttackMpSpent = {};
    this.freezeRemoved = {};
    this.defenseReduced = {};
    this.gainedInsight = {};
    this.madnessDecided = {};
  }
}

class Fighter {
  constructor(side, data, inscription, inscriptions) {
    this.side = side;
    this.data = structuredCloneCompat(data);
    this.inscription = inscriptionById(normalizeInscriptions([inscription]), inscription?.id);
    this.inscriptionId = this.inscription.id;
    this.maxHp = Number(this.data.stats.hp);
    this.hp = this.maxHp;
    this.maxMp = MAX_MP;
    this.mp = START_MP;
    if (hasInscription(this, "blue")) this.mp += 10;
    this.mp = Math.min(this.maxMp, this.mp);
    this.baseAtk = Number(this.data.stats.atk);
    this.baseDef = Number(this.data.stats.def);
    this.baseSpd = Number(this.data.stats.spd);
    this.adventureMpRecoveryBonus = 0;
    this.adventureTurnEndHpRecovery = 0;
    this.adventureSkillCostMultipliers = {};
    this.adventureSkillPowerMultipliers = {};
    this.adventureSkillAccuracyModifiers = {};
    this.adventureSkillPriorityModifiers = {};
    this.adventureAllSkillCostMultiplier = 1;
    this.adventureDamageMultiplier = 1;
    this.adventureCommonAttackPowerBonus = 0;
    this.adventureCommonDefenseReductionBonus = 0;
    this.adventureMeditationRecoveryBonus = 0;
    this.adventureBattleRhythm = null;
    this.debugAccuracyOverride = null;
    this.adventureRelics = [];
    this.adventureTurnEndFixedDamage = 0;
    this.adventureSurviveDefeatCount = 0;
    this.adventureSkipNextAction = false;
    this.adventureSkipNextActionLabel = "";
    clearFighterCombatState(this);
    characterLogic.adjustInitialStats(this);
    initializeFighterUniqueState(this);
    this.inscriptions = inscriptions;
  }

  get name() {
    return this.data.name;
  }

  get title() {
    return this.data.title;
  }

  get characterId() {
    return String(this.data.id || "");
  }

  get label() {
    return `${this.name} - ${this.title}`;
  }

  get inscriptionName() {
    return this.inscription.name || titleCase(this.inscriptionId);
  }

  get inscriptionDescription() {
    return this.inscription.description || "효과 없음";
  }
}

class Battle {
  constructor({
    characters,
    inscriptions,
    playerIndex,
    aiIndex,
    personalityId = "R",
    seed = null,
    rng = null,
    playerInscriptionId = DEFAULT_INSCRIPTION_ID,
    aiInscriptionId = DEFAULT_INSCRIPTION_ID,
    hidePersonalityUntilGameOver = false,
    maxTurns = 200,
  }) {
    this.characters = characters;
    this.inscriptions = normalizeInscriptions(inscriptions);
    this.rng = rng || new Mulberry32(seed);
    this.aiRng = new Mulberry32(`${seed ?? this.rng.state ?? "versus"}:ai:${playerIndex}:${aiIndex}:${personalityId}`);
    this.player = new Fighter("PLAYER", characters[playerIndex], inscriptionById(this.inscriptions, playerInscriptionId), this.inscriptions);
    this.ai = new Fighter("AI", characters[aiIndex], inscriptionById(this.inscriptions, aiInscriptionId), this.inscriptions);
    this.personality = findPersonality(personalityId);
    this.turn = 1;
    this.record = new TurnRecord();
    this.logs = [];
    this.maxTurns = Number(maxTurns || 200);
    this.hidePersonalityUntilGameOver = Boolean(hidePersonalityUntilGameOver);
    this.gameOver = false;
    this.winner = null;
    this.loser = null;
    this.turnOrder = {};
    this.lastAiSearch = null;
    this.lastAiSearchStats = null;
  }

  visiblePersonality() {
    if (this.hidePersonalityUntilGameOver && !this.gameOver) {
      return { id: "random", name: "RANDOM" };
    }
    return this.personality;
  }

  startTurn() {
    this.record = new TurnRecord();
    this.turnOrder = {};
    for (const fighter of [this.player, this.ai]) {
      fighter.defenseMult = null;
      fighter.defenseName = null;
      fighter.evasionChance = 0;
      fighter.guaranteedEvasion = false;
      characterLogic.resetTurnFlags(this, fighter);
      this.record.attackDamageTaken[fighter.side] = 0;
      this.record.freezeRemoved[fighter.side] = false;
      this.record.defenseReduced[fighter.side] = 0;
      this.record.gainedInsight[fighter.side] = false;
    }
  }

  resetFighterCombatState(fighter) {
    clearFighterCombatState(fighter);
    initializeFighterUniqueState(fighter);
  }

  opponent(fighter) {
    return fighter === this.player ? this.ai : this.player;
  }

  characterDataById(id) {
    return this.characters.find((character) => character.id === id) || null;
  }

  activeCharacterId(fighter) {
    return characterLogic.activeCharacterId(this, fighter) || fighter.characterId;
  }

  activeCharacterData(fighter) {
    return activeCharacterDataForFighter(fighter, this);
  }

  initializeBorrowedCharacterState(fighter, characterId) {
    return characterLogic.initializeBorrowedState(this, fighter, characterId);
  }

  clearBorrowedCharacterState(fighter, state) {
    characterLogic.clearBorrowedState(fighter, state);
  }

  availableActions(fighter) {
    return availableActions(fighter, this);
  }

  kindIsAttack(kind) {
    return kind === "공격" || kind === "액티브 공격";
  }

  skillKey(characterId, slot) {
    return skillKey(characterId, slot);
  }

  commonActionKey(kind) {
    return commonActionKey(kind);
  }

  actionFromKey(actionKey) {
    if (!actionKey) return null;
    const common = normalActions().find((action) => action.key === actionKey);
    if (common) return common;
    const specialDefinition = characterLogic.actionDefinitionForKey(actionKey);
    if (specialDefinition) return new Action(specialDefinition);
    const match = /^([^:]+):(\d+)$/.exec(String(actionKey));
    if (!match) return null;
    const data = this.characterDataById(match[1]);
    const slot = Number(match[2]);
    const skill = data?.skills?.[slot];
    return skill ? actionFromSkill(slot + 4, skill, data.id) : null;
  }

  displayActionName(fighter, actionKey) {
    if (!actionKey) return "";
    return this.availableActions(fighter).find((action) => action.key === actionKey)?.name
      || this.actionFromKey(actionKey)?.name
      || actionKey;
  }

  actionKeyIsAttack(fighter, actionKey) {
    return Boolean((this.availableActions(fighter).find((action) => action.key === actionKey) || this.actionFromKey(actionKey))?.isAttack);
  }

  actionKeyIsDefense(fighter, actionKey) {
    return Boolean((this.availableActions(fighter).find((action) => action.key === actionKey) || this.actionFromKey(actionKey))?.isDefense);
  }

  recentKindCounts(fighter, limit = 4) {
    const counts = { attack: 0, defense: 0, meditation: 0 };
    let history = fighter.selectedHistory;
    if (Object.hasOwn(this.record.selected, fighter.side)) history = history.slice(0, -1);
    for (const actionKey of history.slice(-limit)) {
      if (actionKey === commonActionKey("meditation")) counts.meditation += 1;
      else if (this.actionKeyIsDefense(fighter, actionKey)) counts.defense += 1;
      else if (this.actionKeyIsAttack(fighter, actionKey)) counts.attack += 1;
    }
    return counts;
  }

  isActorFirst(choice) {
    return this.turnOrder[choice.actor.side] === 0;
  }

  findActionByInput(fighter, raw) {
    const value = String(raw || "").trim();
    return this.availableActions(fighter).find((action) => String(action.number) === value || action.key === value || action.name === value) || null;
  }

  makeChoice(fighter, action, searchMetrics = null) {
    const cost = searchMetrics ? searchMetrics.cost : this.effectiveCost(fighter, action);
    const priority = searchMetrics ? searchMetrics.priority : this.effectivePriority(fighter, action);
    const choice = new Choice(fighter, action, cost, priority);
    characterLogic.onMakeChoice(this, fighter, action, choice);
    const selectedAction = choice.action || action;
    if (selectedAction.isCommonAction("defense")) {
      choice.defenseBonusReduction = Number(choice.defenseBonusReduction || 0)
        + adventureCommonDefenseBonus(this, fighter);
    }
    this.record.selected[fighter.side] = selectedAction.name;
    this.record.selectedKey[fighter.side] = selectedAction.key;
    this.record.selectedKind[fighter.side] = actionKind(selectedAction);
    fighter.selectedHistory.push(selectedAction.key);
    return choice;
  }

  isLegalChoice(fighter, action, knownCost = undefined) {
    if (fighter.forbiddenActionKey === action.key && fighter.forbiddenRemaining > 0) return false;
    if (Number(fighter.forbiddenActionKeys?.[action.key] || 0) > 0) return false;
    const characterResult = characterLogic.isLegalChoice(this, fighter, action);
    if (characterResult !== null && characterResult !== undefined) return Boolean(characterResult);
    return fighter.mp >= (knownCost === undefined ? this.effectiveCost(fighter, action) : knownCost);
  }

  effectiveCost(fighter, action) {
    let cost = Number(action.mp || 0);
    if (action.isActive) {
      cost = characterLogic.modifyCost(this, fighter, action, cost);
      const adventureMultiplier = Number(fighter.adventureSkillCostMultipliers?.[action.key] ?? 1);
      if (Number.isFinite(adventureMultiplier) && adventureMultiplier > 0) {
        cost = floorInt(cost * adventureMultiplier);
      }
      const adventureAllMultiplier = Number(fighter.adventureAllSkillCostMultiplier ?? 1);
      if (Number.isFinite(adventureAllMultiplier) && adventureAllMultiplier > 0) {
        cost = floorInt(cost * adventureAllMultiplier);
      }
      for (const effect of fighter.costEffects) cost = floorInt(cost * effect.multiplier);
      if (hasInscription(fighter, "red") && action.isAttack) cost += 3;
      cost = floorInt(cost * adventureRelicEffectProduct(fighter, "active_cost_multiplier"));
      for (const effect of adventureRelicEffects(fighter, "low_cost_flat_reduction")) {
        if (Number(action.mp || 0) <= Number(effect.threshold || 0)) cost -= Number(effect.amount || 0);
      }
      if (fighter.adventureMeditationRelicReady) {
        cost -= adventureRelicEffectSum(fighter, "after_meditation_cost_reduction");
      }
    }
    let history = fighter.selectedHistory;
    if (Object.hasOwn(this.record.selected, fighter.side)) history = history.slice(0, -1);
    if (history.at(-1) === action.key) {
      if (hasInscription(fighter, "indigo")) cost += 2;
      if (hasInscription(this.opponent(fighter), "indigo")) cost += 5;
    }
    return Math.max(0, Number(cost));
  }

  effectivePriority(fighter, action) {
    let priority = characterLogic.modifyPriority(this, fighter, action, Number(action.priority || 0));
    if (action.isActive) {
      const adventureModifier = Number(fighter.adventureSkillPriorityModifiers?.[action.key] ?? 0);
      if (Number.isFinite(adventureModifier)) priority += adventureModifier;
      priority += adventureRelicEffectSum(fighter, "active_priority_bonus");
    }
    return priority;
  }

  selectAiAction(actor = this.ai, target = this.player, personality = this.personality) {
    const legal = this.searchLegalActions(actor, target);
    if (!legal.length) return this.availableActions(actor)[0];
    const tuning = AI_SEARCH_TUNING[personality.id] || AI_SEARCH_TUNING.R;
    const result = selectSearchAction({
      battle: this,
      actor,
      target,
      personalityId: personality.id,
      tuning,
      legal,
      rootScoreGap: (AI_PERSONALITY_TUNING[personality.id] || AI_PERSONALITY_TUNING.R).topGap,
    });
    this.lastAiSearch = result.diagnostics;
    this.lastAiSearchStats = result.diagnostics;
    return this.weightedPersonalityChoice(result.scored, personality.id);
  }

  searchLegalActions(actor, target = this.opponent(actor), costForAction = null) {
    const legal = this.availableActions(actor).filter((action) => this.isLegalChoice(
      actor,
      action,
      costForAction ? costForAction(action) : undefined,
    ));
    const viable = legal.filter((action) => !characterLogic.wouldConditionFail(this, actor, target, action));
    return viable.length ? viable : legal;
  }

  scoreAction(actor, target, action, personalityId, knownCost = undefined) {
    const baseDamage = this.estimateActionDamage(actor, target, action, false);
    const maxDamage = this.estimateActionDamage(actor, target, action, true);
    const hitRate = this.estimateHitRate(actor, target, action) / 100;
    const expectedDamage = baseDamage * hitRate;
    const conditionFails = characterLogic.wouldConditionFail(this, actor, target, action);
    const cost = knownCost === undefined ? this.effectiveCost(actor, action) : knownCost;
    let score = expectedDamage * 3;

    if (!conditionFails && maxDamage >= target.hp && action.isAttack) score += 10000 + maxDamage - target.hp;
    else if (!conditionFails && expectedDamage >= target.hp && action.isAttack) score += 7000;
    if (action.isDefense) {
      const incoming = this.estimateBestIncomingDamage(target, actor);
      const mult = defenseMultiplierForStreak(
        actor.defenseStreak + 1,
        characterLogic.defenseScoreBonusReduction(this, actor, action)
          + (action.isCommonAction("defense") ? adventureCommonDefenseBonus(this, actor) : 0),
      );
      const prevented = incoming * (1 - mult);
      score += prevented * 1.8;
      if (actor.hp <= incoming && actor.hp > incoming * mult) score += 2500;
    }
    if (action.isCommonAction("meditation")) {
      score += Math.min(this.meditationRecovery(actor), actor.maxMp - actor.mp) * 8;
      if (actor.mp < 40) score += 80;
    }
    if (!action.isAttack && action.isActive) score += this.setupValue(actor, target, action);
    if (["마비", "빙결", "회진"].some((word) => action.description.includes(word))) score += 120 * hitRate;
    if (["ATK", "DEF", "SPD"].some((word) => action.description.includes(word))) score += 80;
    if (action.isDefense && action.isActive) score += 60;
    if (action.description.includes("[연격]")) score += maxDamage * 0.5;
    if (action.description.includes("고정 피해")) score += 70;
    score += characterLogic.aiScore(this, actor, target, action, expectedDamage, hitRate);
    score += this.adaptiveBonus(actor, target, action) * 0.65;
    score -= cost * 1.2;
      if (cost > actor.mp && !this.isLegalChoice(actor, action, cost)) score -= 9999;
    if (conditionFails) score -= 12000;
    score -= this.repetitionPenalty(actor, action, personalityId);

    if (personalityId === "C") {
      score += expectedDamage * 1.4 + maxDamage + (action.isAttack ? 120 : 0);
    } else if (personalityId === "D") {
      if (actor.hp < actor.maxHp * 0.45 && (action.isDefense || action.description.includes("회복") || action.isCommonAction("meditation"))) score += 350;
      score -= cost * 0.4;
    } else if (personalityId === "G") {
      score += maxDamage * 2;
      if (action.accuracy !== null && action.accuracy < 85) score += 160;
    } else if (personalityId === "E") {
      if (!action.isAttack) score += 230;
      if (["중첩", "4턴", "3턴", "MP"].some((word) => action.description.includes(word))) score += 160;
    } else if (personalityId === "J") {
      if (["실패", "선택할 수 없", "회피", "감소", "상태"].some((word) => action.description.includes(word))) score += 260;
    } else if (personalityId === "A") {
      score += this.deceptionBonus(actor, action);
    }
    return score;
  }

  weightedPersonalityChoice(scored, personalityId) {
    const tuning = AI_PERSONALITY_TUNING[personalityId] || AI_PERSONALITY_TUNING.R;
    const best = Math.max(...scored.map((item) => item.score));
    const candidates = scored.filter((item) => best - item.score <= tuning.topGap);
    if (candidates.length === 1) return candidates[0].action;
    if (this.aiRng.next() < tuning.exploration) return this.aiRng.choice(candidates).action;
    const weights = candidates.map((item) => Math.exp((item.score - best) / Math.max(1, tuning.temperature)));
    const total = weights.reduce((sum, value) => sum + value, 0);
    let point = this.aiRng.next() * total;
    for (let index = 0; index < candidates.length; index += 1) {
      point -= weights[index];
      if (point <= 0) return candidates[index].action;
    }
    return candidates[candidates.length - 1].action;
  }

  setupValue(actor, target, action) {
    let value = 0;
    const description = action.description;
    if (description.includes("ATK")) value += 120;
    if (description.includes("DEF")) value += 70;
    if (description.includes("SPD") || description.includes("우선도")) value += 80;
    if (description.includes("회복")) value += 70;
    if (description.includes("중첩")) value += 90;
    value += characterLogic.setupValue(this, actor, target, action);
    if (target.hp < this.estimateBestIncomingDamage(actor, target)) value -= 150;
    return value;
  }

  repetitionPenalty(actor, action, personalityId) {
    let history = actor.selectedHistory;
    if (Object.hasOwn(this.record.selected, actor.side)) history = history.slice(0, -1);
    let streak = 0;
    for (let index = history.length - 1; index >= 0 && history[index] === action.key; index -= 1) streak += 1;
    if (!streak) return 0;
    const tuning = AI_PERSONALITY_TUNING[personalityId] || AI_PERSONALITY_TUNING.R;
    let penalty = tuning.repeatPenalty * (1 + (streak - 1) * 1.4);
    if (personalityId === "D" && action.isDefense) penalty *= 0.45;
    if (personalityId === "C" && action.isAttack) penalty *= 0.65;
    if (personalityId === "E" && ["중첩", "4턴", "3턴", "MP"].some((word) => action.description.includes(word))) penalty *= 0.55;
    if (personalityId === "J") penalty *= 1.25;
    if (action.isCommonAction("meditation") && actor.mp >= 70) penalty *= 1.8;
    return penalty;
  }

  adaptiveBonus(actor, target, action) {
    let history = target.selectedHistory;
    if (Object.hasOwn(this.record.selected, target.side)) history = history.slice(0, -1);
    const recent = history.slice(-3);
    const attacks = recent.filter((key) => this.actionKeyIsAttack(target, key)).length;
    const defenses = recent.filter((key) => this.actionKeyIsDefense(target, key)).length;
    const meditations = recent.filter((key) => key === commonActionKey("meditation")).length;
    let bonus = 0;
    if (attacks >= 2 && action.isDefense) bonus += 350;
    if (defenses >= 2 && (action.isDefense || action.priority >= 1)) bonus += 120;
    if (meditations >= 1 && action.isAttack) bonus += 180;
    return bonus;
  }

  deceptionBonus(actor, action) {
    let history = actor.selectedHistory;
    if (Object.hasOwn(this.record.selected, actor.side)) history = history.slice(0, -1);
    const recent = history.slice(-6);
    const sameAction = recent.filter((key) => key === action.key).length;
    const kind = actionKind(action);
    const sameKind = recent.filter((key) => {
      const previous = this.availableActions(actor).find((candidate) => candidate.key === key) || this.actionFromKey(key);
      return previous && actionKind(previous) === kind;
    }).length;
    const repeatedLast = recent.at(-1) === action.key;
    return 220 - sameAction * 95 - sameKind * 28 - (repeatedLast ? 180 : 0);
  }

  simulateActionPair(actorSide, actorAction, targetAction, options = {}) {
    const normalizedOptions = typeof options === "number" ? { rngState: options } : options;
    const simulation = this.cloneForSimulation(normalizedOptions);
    const actor = simulation.fighterBySide(actorSide);
    const target = simulation.opponent(actor);
    const ownAction = normalizedOptions.canonicalActions
      ? actorAction
      : simulation.matchAction(actor, actorAction);
    const response = normalizedOptions.canonicalActions
      ? targetAction
      : simulation.matchAction(target, targetAction);
    const ownChoice = simulation.makeChoice(actor, ownAction, normalizedOptions.actorChoiceMetrics || null);
    const targetChoice = simulation.makeChoice(target, response, normalizedOptions.targetChoiceMetrics || null);
    if (actor === simulation.player) simulation.resolveTurn(ownChoice, targetChoice);
    else simulation.resolveTurn(targetChoice, ownChoice);
    return simulation;
  }

  cloneForSimulation(options = {}) {
    const normalizedOptions = typeof options === "number" ? { rngState: options } : options;
    const requestedRngState = normalizedOptions.rngState ?? normalizedOptions.rngSeed;
    const silent = Boolean(normalizedOptions.silent || normalizedOptions.suppressLogs);
    const clone = Object.create(Battle.prototype);
    clone.characters = this.characters;
    clone.inscriptions = this.inscriptions;
    clone.rng = new Mulberry32(0);
    clone.rng.state = Number.isFinite(Number(requestedRngState))
      ? Number(requestedRngState) >>> 0
      : this.rng.state;
    clone.aiRng = new Mulberry32(0);
    clone.aiRng.state = this.aiRng?.state ?? ((clone.rng.state ^ 0xa511e9b3) >>> 0);
    clone.player = cloneFighter(this.player);
    clone.ai = cloneFighter(this.ai);
    clone.personality = { ...this.personality };
    clone.turn = this.turn;
    clone.record = cloneTurnRecord(this.record);
    clone.logs = silent ? SEARCH_LOG_SINK : [];
    clone.suppressLogs = silent;
    clone.maxTurns = this.maxTurns;
    clone.hidePersonalityUntilGameOver = this.hidePersonalityUntilGameOver;
    clone.gameOver = this.gameOver;
    clone.winner = this.winner ? clone.fighterBySide(this.winner.side) : null;
    clone.loser = this.loser ? clone.fighterBySide(this.loser.side) : null;
    clone.turnOrder = { ...this.turnOrder };
    clone.lastAiSearch = null;
    clone.lastAiSearchStats = null;
    return clone;
  }

  fighterBySide(side) {
    return this.player.side === side ? this.player : this.ai;
  }

  matchAction(fighter, action) {
    const actions = this.availableActions(fighter);
    return actions.find((candidate) => candidate.number === action.number && candidate.name === action.name)
      || actions.find((candidate) => candidate.name === action.name)
      || normalActions()[0];
  }

  evaluatePosition(actorSide, personalityId, searchLeaf = false) {
    const me = this.fighterBySide(actorSide);
    const opponent = this.opponent(me);
    if (this.gameOver) {
      if (this.winner?.side === actorSide) return 240000 - this.turn * 250;
      if (this.loser?.side === actorSide) return -240000 + this.turn * 250;
      return 0;
    }
    const statusScore = this.statusPressureValue(opponent) - this.statusPressureValue(me) * 1.15;
    let value = (me.hp / me.maxHp - opponent.hp / opponent.maxHp) * 6200
      + (me.mp - opponent.mp) * 14
      + this.statAdvantageValue(me, opponent)
      + statusScore
      + this.resourceValue(me) - this.resourceValue(opponent) * 0.85
      + this.patternReadValue(me, opponent) * 120;
    if (personalityId === "C") value += (opponent.maxHp - opponent.hp) * 32 - (me.maxHp - me.hp) * 10;
    else if (personalityId === "D") value += (me.hp / me.maxHp) * 2600 - this.estimateBestIncomingDamage(opponent, me) * 42;
    else if (personalityId === "G") value += (opponent.maxHp - opponent.hp) * 18 + Math.max(...this.availableActions(me).map((action) => this.estimateActionDamage(me, opponent, action, true))) * 40;
    else if (personalityId === "E") {
      value += me.mp * 24 + this.resourceValue(me) * 1.7;
      if (!searchLeaf) value += this.futurePotentialScore(me.side) * 0.5;
    }
    else if (personalityId === "J") value += this.statusPressureValue(opponent) * 1.9 - this.statusPressureValue(me) * 0.55;
    else if (personalityId === "A") value += this.deceptionStateValue(me);
    return value;
  }

  statAdvantageValue(me, opponent) {
    const [myAtk, myDef, mySpd] = this.currentStats(me);
    const [opAtk, opDef, opSpd] = this.currentStats(opponent);
    return (myAtk - opAtk) * 10 + (myDef - opDef) * 7 + (mySpd - opSpd) * 4;
  }

  statusPressureValue(fighter) {
    let value = 0;
    for (const status of Object.values(fighter.statuses)) {
      let base = 60 + status.remaining * 24 + status.stacks * 36;
      if (["마비", "빙결"].includes(status.name)) base *= 1.8;
      else if (["화상", "역병", "갈증"].includes(status.name)) base *= 1.35;
      value += base;
    }
    return value;
  }

  resourceValue(fighter) {
    let value = 0;
    for (const [name, raw] of Object.entries(fighter.counters)) {
      const handled = characterLogic.counterResourceValue(this, fighter, name, raw);
      if (handled !== null && handled !== undefined) value += Number(handled);
      else if (typeof raw === "number" && Number.isInteger(raw)) value += raw * (["탄환", "집광", "과령", "권의", "통찰"].includes(name) ? 70 : 35);
      else if (typeof raw === "string") value += 45;
    }
    return value;
  }

  disruptionBonus(action, response) {
    let bonus = ["실패", "선택할 수 없다", "MP", "감소", "회피", "상태"].some((word) => action.description.includes(word)) ? 260 : 0;
    bonus += this.matchupBonus(actionKind(action), actionKind(response)) * 180;
    return bonus;
  }

  matchupBonus(ownKind, opponentKind) {
    if (opponentKind === "명상" && this.kindIsAttack(ownKind)) return 1;
    if (this.kindIsAttack(opponentKind) && ownKind === "방어") return 1;
    if (opponentKind === "방어" && ownKind === "명상") return 1;
    return 0;
  }

  futurePotentialScore(actorSide) {
    if (this.gameOver) return 0;
    const actor = this.fighterBySide(actorSide);
    const target = this.opponent(actor);
    const actorScores = this.searchLegalActions(actor, target).map((action) => this.scoreAction(actor, target, action, "E"));
    const targetScores = this.searchLegalActions(target, actor).map((action) => this.scoreAction(target, actor, action, "R"));
    const actorBest = actorScores.length ? Math.max(...actorScores) : 0;
    const targetBest = targetScores.length ? Math.max(...targetScores) : 0;
    return actorBest - targetBest * 0.45
      + (this.resourceValue(actor) - this.resourceValue(target) * 0.85) * 1.2
      + (actor.mp - target.mp) * 14
      + (this.statusPressureValue(target) - this.statusPressureValue(actor)) * 0.6;
  }

  patternReadValue(actor, target) {
    let targetHistory = target.selectedHistory;
    if (Object.hasOwn(this.record.selected, target.side)) targetHistory = targetHistory.slice(0, -1);
    let actorHistory = actor.selectedHistory;
    if (Object.hasOwn(this.record.selected, actor.side)) actorHistory = actorHistory.slice(0, -1);
    const recent = targetHistory.slice(-4);
    const attacks = recent.filter((key) => this.actionKeyIsAttack(target, key)).length;
    const defenses = recent.filter((key) => this.actionKeyIsDefense(target, key)).length;
    let repeats = 0;
    for (let index = 1; index < recent.length; index += 1) if (recent[index - 1] === recent[index]) repeats += 1;
    let value = attacks * 0.35 + defenses * 0.18 + repeats * 0.45;
    if (actorHistory.length && targetHistory.at(-1) === actorHistory.at(-1)) value -= 0.15;
    return value;
  }

  deceptionStateValue(actor) {
    let history = actor.selectedHistory;
    if (Object.hasOwn(this.record.selected, actor.side)) history = history.slice(0, -1);
    const recent = history.slice(-6);
    if (!recent.length) return 0;
    const unique = new Set(recent).size;
    let repeats = 0;
    for (let index = 1; index < recent.length; index += 1) {
      if (recent[index] === recent[index - 1]) repeats += 1;
    }
    return unique * 85 - repeats * 140;
  }

  resolveTurn(playerChoice, aiChoice) {
    const order = this.actionOrder(playerChoice, aiChoice);
    for (const choice of order) {
      this.logs.push(`${choice.actor.name} 선택: ${choice.action.name}`);
    }
    for (const [index, choice] of order.entries()) {
      if (this.gameOver) break;
      this.turnOrder[choice.actor.side] = index;
      this.executeAction(choice);
    }
    if (!this.gameOver) characterLogic.afterActionPhase(this);
    if (!this.gameOver) this.endTurn();
    if (this.gameOver) this.appendGameOverLogs();
  }

  actionOrder(a, b) {
    if (a.priority !== b.priority) return a.priority > b.priority ? [a, b] : [b, a];
    const aSpd = this.currentStats(a.actor)[2];
    const bSpd = this.currentStats(b.actor)[2];
    const total = aSpd + bSpd;
    const aProb = total <= 0 ? 50 : (aSpd / total) * 100;
    return this.roll("turn order") < aProb ? [a, b] : [b, a];
  }

  executeAction(choice) {
    const actor = choice.actor;
    const target = this.opponent(actor);
    const action = choice.action;
    if (actor.hp <= 0) return;
    this.logs.push(fighterLogLine(actor, `[${actor.name} 행동]`));
    this.logs.push(fighterLogLine(
      actor,
      `${withParticle(actor.name, "은", "는")} ${withParticle(action.name, "을", "를")} 사용했다.`,
    ));
    if (this.applyActionStartEffects(choice)) {
      this.finishAction(choice, false, false);
      return;
    }
    const resolvedAction = choice.action;
    const characterPayment = characterLogic.payActionMpCost(this, choice);
    if (characterPayment === false) {
      this.logs.push(`MP 부족으로 행동에 실패했다. MP ${actor.mp}/${choice.totalCost}`);
      this.finishAction(choice, false, false);
      return;
    }
    if (characterPayment !== true) {
      if (actor.mp < choice.totalCost) {
        this.logs.push(`MP 부족으로 행동에 실패했다. MP ${actor.mp}/${choice.totalCost}`);
        this.finishAction(choice, false, false);
        return;
      }
      const beforeMp = actor.mp;
      actor.mp -= choice.totalCost;
      if (choice.totalCost) this.logs.push(fighterLogLine(actor, `MP ${beforeMp} -> ${actor.mp}`));
    }
    if (resolvedAction.isActive && choice.totalCost > 0) {
      if (resolvedAction.isAttack) {
      this.record.activeAttackMpSpent[actor.side] = choice.cost;
      }
      characterLogic.onActiveMpSpent(this, actor, resolvedAction);
      if ((actor.data.unique_statuses || []).some((status) => status.name === "잔류")) {
        actor.counters["잔류"] = Math.min(4, Number(actor.counters["잔류"] || 0) + 1);
      }
    }
    if (resolvedAction.isActive) {
      if (actor.adventureMeditationRelicReady) actor.adventureMeditationRelicReady = false;
      for (const effect of adventureRelicEffects(actor, "high_cost_mp_recovery")) {
        if (choice.totalCost >= Number(effect.threshold || 0)) {
          this.restoreMp(actor, Number(effect.amount || 0), effect.relicName);
        }
      }
      if (actor.mp === 0) {
        const zeroRecovery = adventureRelicEffectSum(actor, "zero_mp_recovery");
        if (zeroRecovery > 0) this.restoreMp(actor, zeroRecovery, "빈 약병");
      }
    }
    if (characterLogic.consumeForcedConditionFailure(this, choice)) {
      this.finishAction(choice, false, false);
      return;
    }
    let hit = true;
    if (resolvedAction.accuracy !== null) {
      hit = this.accuracyCheck(choice);
      if (!hit) {
        this.finishAction(choice, false, false, true);
        return;
      }
    }
    if (!this.applyConditionEffects(choice)) {
      this.logs.push("조건을 만족하지 못해 행동에 실패했다.");
      this.finishAction(choice, false, hit);
      return;
    }
    if (resolvedAction.isAttack) {
      const totalDamage = this.applyAttackDamage(choice);
      if (this.gameOver) return;
      this.applyOnHitEffects(choice, totalDamage);
      if (this.gameOver) return;
      this.finishAction(choice, true, true);
    } else {
      this.applyNonAttackEffects(choice);
      if (this.gameOver) return;
      this.finishAction(choice, true, hit);
    }
  }

  applyActionStartEffects(choice) {
    const actor = choice.actor;
    if (actor.adventureSkipNextAction) {
      const label = String(actor.adventureSkipNextActionLabel || "행동 불가 효과");
      actor.adventureSkipNextAction = false;
      actor.adventureSkipNextActionLabel = "";
      this.logs.push(fighterLogLine(actor, `${withParticle(actor.name, "은", "는")} ${label} 때문에 행동할 수 없다.`));
      return true;
    }
    if (characterLogic.onActionStartBeforeCommon(this, choice)) return true;
    if (actor.statuses["마비"]) {
      const roll = this.roll("마비");
      this.logs.push(`마비 판정 20% / 판정값 ${roll.toFixed(2)}`);
      if (roll < 20) {
        this.logs.push("마비로 행동에 실패했다.");
        return true;
      }
    }
    if (characterLogic.onActionStartAfterParalysis(this, choice)) return true;
    return characterLogic.onActionStartAfterCommon(this, choice);
  }

  accuracyCheck(choice, allowAdventureRelic = true) {
    const target = this.opponent(choice.actor);
    const accuracy = this.modifiedAccuracy(choice);
    if (accuracy >= 100) {
      this.logs.push(`명중률 ${pct(accuracy)} - 명중 판정 성공.`);
    } else {
      const roll = this.roll("명중");
      this.logs.push(`명중률 ${pct(accuracy)} / 판정값 ${roll.toFixed(2)}`);
      if (roll >= accuracy) {
        this.logs.push("명중 판정 실패. 공격이 빗나갔다.");
        if (allowAdventureRelic && hasAdventureRelic(choice.actor, "glass_eye")) {
          this.logs.push(fighterLogLine(choice.actor, `${choice.actor.name}의 유리 눈이 발동해 명중과 회피를 다시 판정한다.`));
          return this.accuracyCheck(choice, false);
        }
        return false;
      }
      this.logs.push("명중 판정 성공.");
    }
    if (choice.guaranteedHit && choice.action.isAttack) {
      this.logs.push("필중 효과로 회피 판정을 통과한다.");
      return true;
    }
    const evasion = this.targetEvasion(target, choice);
    if (target.guaranteedEvasion && choice.action.isAttack) {
      this.logs.push("공격을 회피했다.");
      if (allowAdventureRelic && hasAdventureRelic(choice.actor, "glass_eye")) {
        this.logs.push(fighterLogLine(choice.actor, `${choice.actor.name}의 유리 눈이 발동해 명중과 회피를 다시 판정한다.`));
        return this.accuracyCheck(choice, false);
      }
      return false;
    }
    if (evasion > 0) {
      const roll = this.roll("회피");
      this.logs.push(`${target.name} 회피 확률 ${pct(evasion)} / 판정값 ${roll.toFixed(2)}`);
      if (roll < evasion) {
        this.logs.push("공격을 회피했다.");
        if (allowAdventureRelic && hasAdventureRelic(choice.actor, "glass_eye")) {
          this.logs.push(fighterLogLine(choice.actor, `${choice.actor.name}의 유리 눈이 발동해 명중과 회피를 다시 판정한다.`));
          return this.accuracyCheck(choice, false);
        }
        return false;
      }
      this.logs.push("회피 판정 실패.");
    }
    return true;
  }

  modifiedAccuracy(choice) {
    if (choice.action.accuracy === null) return 100;
    let accuracy = Number(choice.action.accuracy);
    accuracy = characterLogic.modifyAccuracy(this, choice, this.opponent(choice.actor), accuracy);
    if (choice.action.isActive) {
      const adventureModifier = Number(choice.actor.adventureSkillAccuracyModifiers?.[choice.action.key] ?? 0);
      if (Number.isFinite(adventureModifier)) accuracy += adventureModifier;
      if (choice.action.isAttack) accuracy += adventureRelicEffectSum(choice.actor, "active_accuracy_bonus");
    }
    if (hasInscription(choice.actor, "orange")) accuracy += 10;
    if (hasInscription(choice.actor, "violet")) accuracy -= 5;
    const debugOverride = choice.actor.debugAccuracyOverride == null
      ? null
      : Number(choice.actor.debugAccuracyOverride);
    if (Number.isFinite(debugOverride)) return clamp(debugOverride, 0, 100);
    return clamp(accuracy, 0, 100);
  }

  targetEvasion(target, choice) {
    let evasion = Number(target.evasionChance || 0);
    if (hasInscription(target, "yellow") && target.hp < target.maxHp * 0.3 && choice.action.isAttack) evasion += 10;
    evasion = characterLogic.targetEvasion(this, target, choice, evasion);
    return clamp(evasion, 0, 100);
  }

  applyConditionEffects(choice) {
    choice.power = choice.action.power;
    const success = characterLogic.applyConditionEffects(this, choice);
    if (success && choice.action.isAttack) applyAdventureRelicAttackPower(this, choice);
    return success;
  }

  applyAttackDamage(choice) {
    const actor = choice.actor;
    const target = this.opponent(actor);
    const hits = Math.max(1, Number(choice.hitCount || 1));
    let total = 0;
    for (let index = 1; index <= hits; index += 1) {
      const damage = this.calculateAttackDamage(choice);
      const before = target.hp;
      const canReorderLogs = typeof this.logs.splice === "function";
      const nestedLogStart = canReorderLogs ? this.logs.length : 0;
      const result = this.damage(target, damage, `${choice.action.name} 공격 피해`, true, actor);
      const nestedLogs = canReorderLogs ? this.logs.splice(nestedLogStart) : [];
      const applied = result.amount;
      total += applied;
      this.logs.push(fighterLogLine(target, `${target.name}에게 ${applied}의 피해. HP ${before} -> ${target.hp}`));
      if (nestedLogs.length) this.logs.push(...nestedLogs);
      if (result.revived) characterLogic.printDefeatEscape(this, target, result.revived);
      if (this.gameOver) break;
    }
    this.record.attackHit[actor.side] = true;
    const lifestealRate = adventureRelicEffectSum(actor, "attack_lifesteal", "rate");
    if (total > 0 && lifestealRate > 0 && actor.hp > 0) {
      this.heal(actor, Math.max(1, Math.trunc(total * lifestealRate)), "피에 젖은 성배");
    }
    return total;
  }

  applyOnHitEffects(choice, totalDamage) {
    characterLogic.onHitPreDefense(this, choice, totalDamage);
    if (this.gameOver) return;
    characterLogic.onDefenseHit(this, choice, totalDamage);
    if (this.gameOver) return;
    characterLogic.onHitAfterDefense(this, choice, totalDamage);
  }

  calculateAttackDamage(choice) {
    const actor = choice.actor;
    const target = this.opponent(actor);
    let targetDef = this.currentStats(target)[1];
    targetDef = characterLogic.targetDefenseForAttack(this, choice, target, targetDef);
    let power = Math.max(0, Number(choice.power || 0));
    power = characterLogic.modifyAttackPower(this, choice, power);
    if (choice.action.isCommonAction("normal_attack")) {
      power += Number(actor.adventureCommonAttackPowerBonus || 0);
    }
    if (usesAdventurePowerMultiplier(choice.action)) {
      const adventurePowerMultiplier = Number(actor.adventureSkillPowerMultipliers?.[choice.action.key] ?? 1);
      if (Number.isFinite(adventurePowerMultiplier) && adventurePowerMultiplier >= 0) {
        power *= adventurePowerMultiplier;
      }
    }
    if (hasInscription(actor, "white")) power = Math.max(0, power - whitePowerPenalty(choice.action));
    if (hasInscription(actor, "red")) power += redPowerBonus(choice.action);
    const atk = choice.attackAtkOverride == null ? this.currentStats(actor)[0] : Number(choice.attackAtkOverride);
    let mult = 1;
    for (const value of characterLogic.attackDamageMultipliers(this, choice)) mult *= Number(value || 1);
    const adventureDamageMultiplier = Number(actor.adventureDamageMultiplier ?? 1);
    if (Number.isFinite(adventureDamageMultiplier) && adventureDamageMultiplier >= 0) {
      mult *= adventureDamageMultiplier;
    }
    mult *= adventureRhythmAttackMultiplier(actor, this.turn, "outgoing");
    mult *= adventureRhythmAttackMultiplier(target, this.turn, "incoming");
    let damage = Math.max(1, floorInt((power * (atk + 50)) / (targetDef + 50) * mult));
    damage = characterLogic.modifyAttackDamage(this, choice, target, damage);
    if (hasInscription(actor, "white") && choice.action.isCommonAction("normal_attack")) damage += 1;
    return Math.max(1, Math.trunc(damage));
  }

  applyNonAttackEffects(choice) {
    const actor = choice.actor;
    const action = choice.action;
    if (action.isCommonAction("defense")) {
      this.applyDefense(actor, action.name, choice.defenseBonusReduction);
      return;
    }
    if (action.isCommonAction("meditation")) {
      const adventureBonus = Number(actor.adventureMeditationRecoveryBonus || 0);
      const recovery = choice.meditationRecoveryOverride == null
        ? this.meditationRecovery(actor)
        : Number(choice.meditationRecoveryOverride) + adventureBonus;
      this.restoreMp(actor, recovery, "명상");
      const meditationHeal = adventureRelicEffectSum(actor, "meditation_hp_recovery");
      if (meditationHeal > 0) this.heal(actor, meditationHeal, "기도 구슬");
      if (adventureRelicEffects(actor, "after_meditation_cost_reduction").length > 0) {
        actor.adventureMeditationRelicReady = true;
      }
      characterLogic.onMeditationEffect(this, choice);
      return;
    }
    if (!characterLogic.applyNonAttackEffects(this, choice)) {
      this.logs.push("효과를 처리했다.");
    }
  }

  meditationRecovery(fighter) {
    return 15
      + (hasInscription(fighter, "white") ? 1 : 0)
      + Number(fighter.adventureMeditationRecoveryBonus || 0)
      + adventureRelicEffectSum(fighter, "meditation_bonus");
  }

  finishAction(choice, success, hit, missNotFailure = false) {
    const actor = choice.actor;
    const action = choice.action;
    const failed = !success && !missNotFailure;
    this.record.actionSuccess[actor.side] = Boolean(success);
    if (success) actor.lastSuccessfulActionKey = action.key;
    if (action.isDefense && success) actor.defenseStreak += 1;
    else if (!failed) actor.defenseStreak = 0;
    characterLogic.finishAction(this, choice, success, hit, missNotFailure);
  }

  applyDefense(actor, name, bonusReduction = 0) {
    actor.defenseName = name;
    actor.defenseMult = defenseMultiplierForStreak(actor.defenseStreak + 1, bonusReduction);
    this.logs.push(`[방어] 성공. 이번 턴 공격 피해를 ${defenseReductionPercentForStreak(actor.defenseStreak + 1, bonusReduction)}% 경감한다.`);
  }

  endTurn() {
    this.logs.push("[턴 종료]");
    for (const fighter of [this.player, this.ai]) {
      if (this.gameOver) return;
      characterLogic.applyPreMpTurnEnd(this, fighter);
    }
    for (const fighter of [this.player, this.ai]) {
      if (this.gameOver) return;
      const recovery = this.turnEndMpRecovery(fighter);
      this.restoreMp(fighter, characterLogic.applyTurnEndMpRecovery(this, fighter, recovery), "턴 종료 기본 회복");
    }
    for (const fighter of [this.player, this.ai]) {
      if (this.gameOver) return;
      if (hasInscription(fighter, "green") && fighter.hp < fighter.maxHp) this.heal(fighter, 2, "Green");
    }
    for (const fighter of [this.player, this.ai]) {
      if (this.gameOver) return;
      const adventureRecovery = Number(fighter.adventureTurnEndHpRecovery || 0)
        + adventureRelicEffectSum(fighter, "turn_end_hp_recovery");
      if (adventureRecovery > 0 && fighter.hp < fighter.maxHp) {
        this.heal(fighter, adventureRecovery, "Adventure 지속 회복");
      }
    }
    for (const fighter of [this.player, this.ai]) {
      if (this.gameOver) return;
      characterLogic.applyOtherTurnEnd(this, fighter);
    }
    for (const fighter of [this.player, this.ai]) {
      const fixedDamage = Math.max(0, Math.trunc(Number(fighter.adventureTurnEndFixedDamage || 0)));
      if (fixedDamage <= 0) continue;
      const before = fighter.hp;
      const canReorderLogs = typeof this.logs.splice === "function";
      const nestedLogStart = canReorderLogs ? this.logs.length : 0;
      const result = this.damage(fighter, fixedDamage, "Adventure 턴 종료 효과", false, this.opponent(fighter));
      const nestedLogs = canReorderLogs ? this.logs.splice(nestedLogStart) : [];
      this.logs.push(fighterLogLine(
        fighter,
        `${withParticle(fighter.name, "은", "는")} Adventure 턴 종료 효과로 ${result.amount}의 고정 피해를 입었다. HP ${before} -> ${fighter.hp}`,
      ));
      if (nestedLogs.length) this.logs.push(...nestedLogs);
    }
    if (!this.gameOver) {
      for (const fighter of [this.player, this.ai]) this.decrementDurations(fighter);
    }
  }

  turnEndMpRecovery(fighter) {
    let base = 10;
    if (hasInscription(fighter, "green")) base -= 4;
    if (hasInscription(fighter, "blue")) base += 1;
    base += Number(fighter.adventureMpRecoveryBonus || 0);
    const recovery = Math.max(0, base + characterLogic.turnEndMpBonus(this, fighter));
    return Math.max(0, characterLogic.modifyTurnEndMpRecovery(this, fighter, recovery));
  }

  decrementDurations(fighter) {
    for (const [name, status] of Object.entries({ ...fighter.statuses })) {
      status.remaining -= 1;
      if (status.remaining <= 0 || status.stacks <= 0) {
        delete fighter.statuses[name];
        this.logs.push(fighterLogLine(fighter, `${fighter.name}의 ${name} 효과가 사라졌다.`));
      }
    }
    for (const effect of [...fighter.statEffects]) {
      effect.remaining -= 1;
      if (effect.remaining <= 0) fighter.statEffects.splice(fighter.statEffects.indexOf(effect), 1);
    }
    for (const effect of [...fighter.costEffects]) {
      effect.remaining -= 1;
      if (effect.remaining <= 0) fighter.costEffects.splice(fighter.costEffects.indexOf(effect), 1);
    }
    if (fighter.forbiddenRemaining > 0) {
      fighter.forbiddenRemaining -= 1;
      if (fighter.forbiddenRemaining <= 0) fighter.forbiddenActionKey = null;
    }
    for (const [actionKey, remaining] of Object.entries(fighter.forbiddenActionKeys || {})) {
      const next = Number(remaining) - 1;
      if (next <= 0) delete fighter.forbiddenActionKeys[actionKey];
      else fighter.forbiddenActionKeys[actionKey] = next;
    }
    characterLogic.decrementCounters(this, fighter);
  }

  currentStats(fighter) {
    let atk = fighter.baseAtk;
    let defense = fighter.baseDef;
    let spd = fighter.baseSpd;
    if (fighter.statuses["마비"]) spd *= 0.8;
    [atk, defense, spd] = characterLogic.modifyStats(this, fighter, atk, defense, spd);
    for (const effect of fighter.statEffects) {
      if (effect.stat === "atk") atk *= effect.multiplier;
      if (effect.stat === "def") defense *= effect.multiplier;
      if (effect.stat === "spd") spd *= effect.multiplier;
    }
    if (hasInscription(fighter, "orange")) atk *= 0.9;
    if (hasInscription(fighter, "blue")) defense *= 0.9;
    if (hasInscription(fighter, "violet")) {
      atk *= 1.1;
      defense *= 1.1;
    }
    if (hasInscription(fighter, "yellow")) spd *= fighter.hp >= fighter.maxHp * 0.3 ? 0.7 : 1.7;
    return [atk, defense, spd];
  }

  damage(target, amount, reason, attack = false, source = null) {
    let value = Math.max(0, Math.trunc(amount));
    if (value <= 0) return { amount: 0, afterHp: target.hp, revived: null };
    const original = value;
    if (attack && target.defenseMult !== null) {
      const defenseMult = characterLogic.modifyDefenseMultiplier(
        this,
        target,
        value,
        source,
        reason,
        target.defenseMult,
      );
      value = Math.max(1, floorInt(value * defenseMult));
      const reduced = Math.max(0, original - value);
      this.record.defenseReduced[target.side] = (this.record.defenseReduced[target.side] || 0) + reduced;
      if (hasInscription(target, "white") && target.defenseName === "일반 방어") {
        const extraReduced = Math.min(1, Math.max(0, value - 1));
        value -= extraReduced;
        this.record.defenseReduced[target.side] += extraReduced;
      }
      if (reduced > 0 && target.defenseName === "일반 방어" && !this.record.adventureDefenseRelicTriggered?.[target.side]) {
        this.record.adventureDefenseRelicTriggered = this.record.adventureDefenseRelicTriggered || {};
        this.record.adventureDefenseRelicTriggered[target.side] = true;
        if (adventureRelicEffects(target, "defense_counter_attack_multiplier").length > 0) {
          target.adventureCounterRelicReady = true;
          this.logs.push(fighterLogLine(target, `${target.name}의 부러진 기사의 박차가 다음 공격을 벼린다.`));
        }
        const mpRecovery = adventureRelicEffectSum(target, "defense_mp_restore");
        if (mpRecovery > 0) this.restoreMp(target, mpRecovery, "수호자의 방울");
      }
    }
    if (attack) {
      value = characterLogic.absorbAttackDamage(this, target, value, source, reason);
      if (value <= 0) return { amount: 0, afterHp: target.hp, revived: null };
      value = Math.max(1, floorInt(value * adventureRelicEffectProduct(target, "incoming_attack_multiplier")));
      for (const effect of adventureRelicEffects(target, "low_hp_incoming_multiplier")) {
        if (target.hp <= target.maxHp * Number(effect.threshold || 0)) {
          value = Math.max(1, floorInt(value * Number(effect.multiplier || 1)));
        }
      }
    }
    const before = target.hp;
    target.hp = Math.max(0, target.hp - value);
    const actual = before - target.hp;
    if (attack) this.record.attackDamageTaken[target.side] = (this.record.attackDamageTaken[target.side] || 0) + actual;
    if (actual > 0 && this.adventureState && source === this.player && target === this.ai) {
      this.adventureState.achievementStats = this.adventureState.achievementStats || {
        bestSingleAttackDamage: 0,
        bestSingleFixedDamage: 0,
      };
      const metric = attack ? "bestSingleAttackDamage" : "bestSingleFixedDamage";
      this.adventureState.achievementStats[metric] = Math.max(
        Number(this.adventureState.achievementStats[metric] || 0),
        actual,
      );
    }
    if (actual > 0) {
      characterLogic.onDamageTaken(this, target, actual, attack, source);
      if (attack && source) characterLogic.onAttackDamageDealt(this, source, target, actual);
    }
    let afterHp = target.hp;
    let revived = null;
    let adventureSurvived = false;
    if (target.hp <= 0) {
      revived = characterLogic.consumeDefeatEscape(this, target);
      if (revived == null && Number(target.adventureSurviveDefeatCount || 0) > 0) {
        target.adventureSurviveDefeatCount = Math.max(0, Number(target.adventureSurviveDefeatCount || 0) - 1);
        target.hp = 1;
        afterHp = target.hp;
        adventureSurvived = true;
        this.logs.push(fighterLogLine(target, `${target.name}의 수호 부적이 발동했다. HP 1로 살아남았다.`));
      } else if (revived == null) {
        const gearEffect = adventureRelicEffects(target, "revive_once")[0];
        const gear = gearEffect ? destroyAdventureRelic(target, gearEffect.relicId) : null;
        if (gear) {
          target.hp = Math.max(1, Math.trunc(target.maxHp * Number(gearEffect.hpRate || 0.3)));
          afterHp = target.hp;
          adventureSurvived = true;
          this.logs.push(fighterLogLine(target, `${target.name}의 역행의 톱니가 부서지며 HP ${target.hp}로 부활했다.`));
        } else {
          this.endBattle(source || this.opponent(target), target);
        }
      } else {
        afterHp = target.hp;
      }
    }
    return { amount: actual, afterHp, revived, adventureSurvived };
  }

  heal(fighter, amount, reason) {
    const multiplier = adventureRelicEffectProduct(fighter, "healing_multiplier");
    const value = Math.max(0, Math.trunc(Number(amount || 0) * multiplier));
    if (value <= 0) return;
    const before = fighter.hp;
    fighter.hp = Math.min(fighter.maxHp, fighter.hp + value);
    this.logs.push(fighterLogLine(fighter, `${fighter.name} HP 회복 ${before} -> ${fighter.hp} (${reason})`));
  }

  fixedDamage(target, amount, reason, source = null) {
    const opponent = source || this.opponent(target);
    let value = Math.max(0, Math.trunc(amount));
    if (opponent !== target) value = characterLogic.modifyFixedDamageToOpponent(this, opponent, target, value);
    if (value <= 0) return;
    const before = target.hp;
    const canReorderLogs = typeof this.logs.splice === "function";
    const nestedLogStart = canReorderLogs ? this.logs.length : 0;
    const result = this.damage(target, value, reason, false, opponent);
    const nestedLogs = canReorderLogs ? this.logs.splice(nestedLogStart) : [];
    this.logs.push(fighterLogLine(
      target,
      `${withParticle(target.name, "은", "는")} ${withParticle(reason, "으로", "로")} ${result.amount}의 고정 피해를 입었다. HP ${before} -> ${result.afterHp}`,
    ));
    if (nestedLogs.length) this.logs.push(...nestedLogs);
    if (result.revived) characterLogic.printDefeatEscape(this, target, result.revived);
    if (!this.gameOver && opponent !== target) characterLogic.onFixedDamageToOpponent(this, opponent, target, value);
    return result.amount;
  }

  restoreMp(fighter, amount, reason) {
    const requested = Math.max(0, Math.trunc(amount));
    const value = Math.max(0, Math.trunc(characterLogic.modifyMpRecovery(this, fighter, requested, reason)));
    if (value <= 0) return;
    const before = fighter.mp;
    fighter.mp = Math.min(fighter.maxMp, fighter.mp + value);
    this.logs.push(fighterLogLine(fighter, `${fighter.name} MP ${before} -> ${fighter.mp} (${reason})`));
  }

  reduceMp(fighter, amount, reason) {
    const value = Math.max(0, Math.trunc(amount));
    const before = fighter.mp;
    fighter.mp = Math.max(0, fighter.mp - value);
    const actual = before - fighter.mp;
    if (actual > 0) this.logs.push(fighterLogLine(fighter, `${fighter.name} MP ${before} -> ${fighter.mp} (${reason})`));
    return actual;
  }

  addStatus(fighter, name, turns, stacks = 1, source = "", stack = false, maxStacks = null) {
    if (stacks <= 0) return;
    const current = fighter.statuses[name];
    if (current) {
      current.stackable = current.stackable || stack;
      current.stacks = stack ? current.stacks + stacks : Math.max(current.stacks, stacks);
      if (maxStacks != null) current.stacks = Math.min(current.stacks, maxStacks);
      current.remaining = Math.max(current.remaining, turns);
    } else {
      fighter.statuses[name] = {
        name,
        remaining: Number(turns),
        stacks: maxStacks == null ? Number(stacks) : Math.min(Number(stacks), Number(maxStacks)),
        source,
        stackable: Boolean(stack),
      };
    }
    const status = fighter.statuses[name];
    if (status.stacks === 1 && !status.stackable) {
      this.logs.push(fighterLogLine(fighter, `${fighter.name}에게 ${name} 상태가 ${status.remaining}턴 동안 적용되었다.`));
    } else {
      this.logs.push(fighterLogLine(fighter, `${fighter.name}에게 ${name} ${status.stacks}중첩이 ${status.remaining}턴 동안 적용되었다.`));
    }
  }

  addStatEffect(fighter, stat, multiplier, turns, source) {
    const current = fighter.statEffects.find((effect) => effect.stat === stat && effect.source === source);
    if (current) {
      current.multiplier = Number(multiplier);
      current.remaining = Math.max(current.remaining, Number(turns));
      this.logs.push(fighterLogLine(fighter, `${fighter.name}의 ${stat.toUpperCase()} x${multiplier} 효과가 갱신되었다.`));
      return;
    }
    fighter.statEffects.push({ stat, multiplier: Number(multiplier), remaining: Number(turns), source });
    this.logs.push(fighterLogLine(fighter, `${fighter.name}의 ${stat.toUpperCase()}이 ${turns}턴 동안 x${multiplier}가 된다.`));
  }

  addCostEffect(fighter, multiplier, turns, source) {
    fighter.costEffects.push({ multiplier: Number(multiplier), remaining: Number(turns), source });
    this.logs.push(fighterLogLine(fighter, `${fighter.name}의 액티브 MP 소모량이 ${turns}턴 동안 ${multiplier}배가 된다.`));
  }

  addCounter(fighter, name, amount, maxValue = null) {
    const before = Number(fighter.counters[name] || 0);
    let after = before + Number(amount || 0);
    if (maxValue != null) after = Math.min(Number(maxValue), after);
    fighter.counters[name] = after;
    if (maxValue != null) this.logs.push(fighterLogLine(fighter, `${fighter.name}의 ${name} ${before}/${maxValue} -> ${after}/${maxValue}`));
    else this.logs.push(fighterLogLine(fighter, `${fighter.name}의 ${name} ${before} -> ${after}`));
    return after;
  }

  addVengeance(fighter) {
    const before = Number(fighter.counters["과령"] || 0);
    fighter.counters["과령"] = before + 1;
    this.logs.push(`${fighter.name}의 과령 ${before} -> ${fighter.counters["과령"]}`);
    if (fighter.counters["과령"] >= 6 && Number(fighter.counters["거포 강령"] || 0) <= 0) {
      this.triggerVengeanceOverflow(fighter, "과령 폭주");
    }
  }

  triggerVengeanceOverflow(fighter, reason) {
    const stacks = Number(fighter.counters["과령"] || 0);
    fighter.counters["과령"] = 0;
    this.fixedDamage(fighter, 25, reason, fighter);
    this.logs.push(`과령 ${stacks}을 모두 소모했다.`);
  }

  endBattle(winner, loser) {
    if (this.gameOver) return;
    const resolvedLoser = loser?.side === this.player.side
      ? this.player
      : loser?.side === this.ai.side
        ? this.ai
        : loser;
    const requestedWinner = winner?.side === this.player.side
      ? this.player
      : winner?.side === this.ai.side
        ? this.ai
        : winner;
    const resolvedWinner = !requestedWinner || requestedWinner.side === resolvedLoser?.side
      ? this.opponent(resolvedLoser)
      : requestedWinner;
    this.gameOver = true;
    this.winner = resolvedWinner;
    this.loser = resolvedLoser;
  }

  appendGameOverLogs() {
    this.logs.push(`GAME OVER: ${this.winner.label} 승리`);
    if (this.hidePersonalityUntilGameOver) {
      this.logs.push(`AI 성향: ${this.personality.name}`);
    }
  }

  roll() {
    return this.rng.next() * 100;
  }

  estimateActionDamage(actor, target, action, useMax = false) {
    if (!action.isAttack) return 0;
    let hits = 1;
    if (action.description.includes("[연격]")) {
      hits = characterLogic.estimatedHitCount(actor, action, useMax);
      if (hits == null) hits = useMax ? 3 : 2;
    }
    return this.calculateEstimatedDamage(actor, target, action) * Number(hits);
  }

  estimateHitRate(actor, target, action) {
    if (action.accuracy === null) return 100;
    const choice = new Choice(actor, action, this.effectiveCost(actor, action), this.effectivePriority(actor, action));
    let accuracy = this.modifiedAccuracy(choice);
    let evasion = Number(target.evasionChance || 0);
    if (hasInscription(target, "yellow") && target.hp < target.maxHp * 0.3 && action.isAttack) evasion += 10;
    evasion = characterLogic.estimateTargetEvasion(this, target, action, evasion);
    return clamp((accuracy / 100) * (1 - evasion / 100) * 100, 0, 100);
  }

  calculateEstimatedDamage(actor, target, action) {
    const [atk] = this.currentStats(actor);
    let targetDef = this.currentStats(target)[1];
    targetDef = characterLogic.estimatedTargetDefenseForAttack(this, actor, target, action, targetDef);
    let power = characterLogic.estimatedPower(this, actor, target, action, Number(action.power || 0));
    if (action.isCommonAction("normal_attack")) {
      power += Number(actor.adventureCommonAttackPowerBonus || 0);
    }
    if (usesAdventurePowerMultiplier(action)) {
      const adventurePowerMultiplier = Number(actor.adventureSkillPowerMultipliers?.[action.key] ?? 1);
      if (Number.isFinite(adventurePowerMultiplier) && adventurePowerMultiplier >= 0) {
        power *= adventurePowerMultiplier;
      }
    }
    if (hasInscription(actor, "white")) power = Math.max(0, power - whitePowerPenalty(action));
    if (hasInscription(actor, "red")) power += redPowerBonus(action);
    let mult = 1;
    for (const value of characterLogic.estimatedDamageMultipliers(this, actor, target, action)) mult *= Number(value || 1);
    const adventureDamageMultiplier = Number(actor.adventureDamageMultiplier ?? 1);
    if (Number.isFinite(adventureDamageMultiplier) && adventureDamageMultiplier >= 0) {
      mult *= adventureDamageMultiplier;
    }
    mult *= adventureRhythmAttackMultiplier(actor, this.turn, "outgoing");
    mult *= adventureRhythmAttackMultiplier(target, this.turn, "incoming");
    if (target.defenseMult !== null) mult *= target.defenseMult;
    let damage = Math.max(1, floorInt((power * (atk + 50)) / (targetDef + 50) * mult));
    if (hasInscription(actor, "white") && action.isCommonAction("normal_attack")) damage += 1;
    return damage;
  }

  estimateBestIncomingDamage(attacker, defender) {
    const legal = this.availableActions(attacker).filter((action) => this.isLegalChoice(attacker, action) && action.isAttack);
    return legal.length ? Math.max(...legal.map((action) => this.estimateActionDamage(attacker, defender, action, true))) : 0;
  }
}

function adventurePreviousActionKey(battle, fighter) {
  let history = fighter.selectedHistory || [];
  if (Object.hasOwn(battle.record.selected, fighter.side)) history = history.slice(0, -1);
  return String(history.at(-1) || "");
}

function adventureCommonDefenseBonus(battle, fighter) {
  let bonus = Number(fighter.adventureCommonDefenseReductionBonus || 0)
    + adventureRelicEffectSum(fighter, "common_defense_bonus");
  const previousKey = adventurePreviousActionKey(battle, fighter);
  if (previousKey && battle.actionKeyIsAttack(fighter, previousKey)) {
    bonus += adventureRelicEffectSum(fighter, "after_attack_defense_bonus");
  }
  return bonus;
}

function applyAdventureRelicAttackPower(battle, choice) {
  const actor = choice.actor;
  let multiplier = adventureRelicEffectProduct(actor, "attack_power_multiplier");
  if (choice.action.isActive) multiplier *= adventureRelicEffectProduct(actor, "active_attack_power_multiplier");
  for (const effect of adventureRelicEffects(actor, "low_hp_attack_multiplier")) {
    if (actor.hp <= actor.maxHp * Number(effect.threshold || 0)) multiplier *= Number(effect.multiplier || 1);
  }
  for (const effect of adventureRelicEffects(actor, "low_mp_attack_multiplier")) {
    if (actor.mp <= Number(effect.threshold || 0)) multiplier *= Number(effect.multiplier || 1);
  }
  if (actor.hp >= actor.maxHp) multiplier *= adventureRelicEffectProduct(actor, "full_hp_attack_multiplier");

  const previousKey = adventurePreviousActionKey(battle, actor);
  if (previousKey) {
    if (battle.actionKeyIsDefense(actor, previousKey)) {
      multiplier *= adventureRelicEffectProduct(actor, "after_defense_attack_multiplier");
    }
    if (previousKey === choice.action.key) {
      multiplier *= adventureRelicEffectProduct(actor, "repeat_attack_multiplier");
    } else {
      multiplier *= adventureRelicEffectProduct(actor, "changed_action_attack_multiplier");
    }
  }

  for (const effect of adventureRelicEffects(actor, "gold_attack_multiplier")) {
    const gold = Math.max(0, Number(battle.adventureState?.gold || 0));
    const steps = Math.floor(gold / Math.max(1, Number(effect.goldStep || 10)));
    const bonus = Math.min(Number(effect.maxBonus || 0), steps * Number(effect.bonusPerStep || 0));
    multiplier *= 1 + bonus;
  }

  const opponentKey = String(battle.record.selectedKey[battle.opponent(actor).side] || "");
  const opponentAction = battle.actionFromKey(opponentKey);
  if (opponentAction && Number(opponentAction.number) === Number(choice.action.number)) {
    multiplier *= adventureRelicEffectProduct(actor, "matching_action_attack_multiplier");
  }

  if (actor.adventureCounterRelicReady) {
    multiplier *= adventureRelicEffectProduct(actor, "defense_counter_attack_multiplier");
    actor.adventureCounterRelicReady = false;
  }

  for (const effect of adventureRelicEffects(actor, "attack_proc_multiplier")) {
    const roll = battle.roll(effect.relicName);
    if (roll < Number(effect.chance || 0) * 100) {
      multiplier *= Number(effect.multiplier || 1);
      battle.logs.push(fighterLogLine(actor, `${effect.relicName} 발동. 공격 위력 ×${effect.multiplier}`));
    }
  }
  choice.power = roundStat(Number(choice.power || 0) * multiplier);
}

function clearFighterCombatState(fighter) {
  fighter.statuses = {};
  fighter.statEffects = [];
  fighter.costEffects = [];
  fighter.counters = {};
  fighter.defenseStreak = 0;
  fighter.defenseMult = null;
  fighter.defenseName = null;
  fighter.evasionChance = 0;
  fighter.guaranteedEvasion = false;
  fighter.selectedHistory = [];
  fighter.selectedAttackActiveHistory = [];
  fighter.hitRecords = new Set();
  fighter.lastSuccessfulActionKey = null;
  fighter.forbiddenActionKey = null;
  fighter.forbiddenRemaining = 0;
  fighter.forbiddenActionKeys = {};
  fighter.attackSelectionCount1To5 = 0;
  fighter.lastMeditationSuccessTurn = null;
  fighter.adventureMeditationRelicReady = false;
  fighter.adventureCounterRelicReady = false;
}

function initializeFighterUniqueState(fighter) {
  characterLogic.initUniqueState(
    fighter,
    new Set((fighter.data.unique_statuses || []).map((item) => item.name)),
  );
}

function actionFromSkill(number, skill, characterId = null, ownerCharacterId = characterId, transformed = false) {
  return new Action({
    number,
    name: skill.name,
    target: skill.target,
    mp: skill.mp,
    power: skill.power,
    accuracy: skill.accuracy,
    priority: skill.priority,
    description: skill.description,
    common: false,
    characterId,
    ownerCharacterId,
    transformed,
    slot: number - 4,
  });
}

let cachedNormalActions = null;
const actionListCache = new WeakMap();

function normalActions() {
  if (!cachedNormalActions) {
    cachedNormalActions = [
      new Action({ number: 1, name: "일반 공격", target: "상대", mp: 0, power: 10, accuracy: 100, priority: 0, description: "효과 없음.", common: true, kind: "normal_attack" }),
      new Action({ number: 2, name: "일반 방어", target: "자신", mp: 0, power: null, accuracy: null, priority: 3, description: "[방어] 자신이 이 턴에 입는 공격 피해를 경감한다.", common: true, kind: "defense" }),
      new Action({ number: 3, name: "명상", target: "자신", mp: 0, power: null, accuracy: null, priority: 0, description: "자신의 MP를 15 회복한다.", common: true, kind: "meditation" }),
    ];
  }
  return cachedNormalActions;
}

function activeCharacterDataForFighter(fighter, battle = null) {
  const activeId = battle && typeof battle.activeCharacterId === "function"
    ? battle.activeCharacterId(fighter)
    : fighter.characterId;
  if (!activeId || activeId === fighter.characterId) return fighter.data;
  return battle?.characterDataById?.(activeId) || fighter.data;
}

function availableActions(fighter, battle = null) {
  const activeData = activeCharacterDataForFighter(fighter, battle);
  const activeId = activeData?.id || fighter.characterId;
  const transformed = Boolean(activeId && activeId !== fighter.characterId);
  let variants = actionListCache.get(activeData);
  if (!variants) {
    variants = new Map();
    actionListCache.set(activeData, variants);
  }
  const variantKey = `${fighter.characterId}|${transformed ? 1 : 0}`;
  if (!variants.has(variantKey)) {
    variants.set(variantKey, [
      ...normalActions(),
      ...(activeData.skills || []).map((skill, index) => (
        actionFromSkill(index + 4, skill, activeId, fighter.characterId, transformed)
      )),
    ]);
  }
  return variants.get(variantKey);
}

function actionKind(action) {
  if (action.isCommonAction("meditation")) return "명상";
  if (action.isDefense) return "방어";
  if (action.isAttack) return action.isActive ? "액티브 공격" : "공격";
  return action.isActive ? "액티브 비공격" : "비공격";
}

function renderAction(action, cost = null, priority = null, overrides = {}) {
  const mp = cost == null ? action.mp : cost;
  const pr = priority == null ? action.priority : priority;
  const displayedPower = Object.hasOwn(overrides, "power") ? overrides.power : action.power;
  const displayedAccuracy = Object.hasOwn(overrides, "accuracy") ? overrides.accuracy : action.accuracy;
  const description = Object.hasOwn(overrides, "description") ? overrides.description : action.description;
  const power = displayedPower == null ? "-" : String(displayedPower);
  const accuracy = displayedAccuracy == null ? "-" : String(displayedAccuracy);
  const mpText = cost != null && cost !== action.mp ? `MP ${mp} (기본 ${action.mp})` : `MP ${mp}`;
  const priorityText = priority != null && priority !== action.priority ? `우선도 ${pr} (기본 ${action.priority})` : `우선도 ${pr}`;
  return `[${action.number}] ${action.name}\n${action.target} / ${mpText} / 위력 ${power} / 명중률 ${accuracy} / ${priorityText}\n${description}`;
}

function findPersonality(id) {
  const requested = String(id || "R").toUpperCase();
  return AI_PERSONALITIES.find((item) => item.id === requested) || AI_PERSONALITIES[0];
}

function resolvePersonality(value, rng) {
  const requested = String(value || "").trim().toUpperCase();
  if (!requested || requested === "0" || requested === "RANDOM") return rng.choice(AI_PERSONALITIES).id;
  return AI_PERSONALITIES.some((item) => item.id === requested) ? requested : "R";
}

function resolveCharacterIndex(characters, value, rng) {
  if (value == null || value === "" || value === "random" || Number(value) === -1) return rng.range(characters.length);
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index >= characters.length) throw new Error("Character index is out of range.");
  return index;
}

function stateForBattle(battle, actionOwner = battle.player, forceActionsDisabled = false) {
  return {
    started: true,
    turn: battle.turn,
    is_over: battle.gameOver,
    gameOver: battle.gameOver,
    result: gameResultText(battle),
    winner: fighterSummary(battle.winner),
    loser: fighterSummary(battle.loser),
    player: fighterState(battle, battle.player),
    ai: fighterState(battle, battle.ai),
    personality: battle.visiblePersonality(),
    actions: actionStatesForFighter(battle, actionOwner, forceActionsDisabled),
  };
}

function fighterSummary(fighter) {
  if (!fighter) return null;
  return {
    side: fighter.side,
    id: fighter.data.id,
    name: fighter.name,
    title: fighter.title,
    label: fighter.label,
  };
}

function fighterState(battle, fighter, sideOverride = null) {
  const [atk, defense, spd] = battle.currentStats(fighter);
  const activeData = battle.activeCharacterData(fighter);
  const activeId = activeData?.id || fighter.characterId;
  const transformed = activeId !== fighter.characterId;
  const stateText = currentStateText(battle, fighter);
  const adventureStateText = currentAdventureStateText(battle, fighter);
  const hudStateText = currentHudStateText(stateText, adventureStateText);
  const battleLog = [];
  if (characterLogic.needsBattleLog(battle, fighter)) characterLogic.renderBattleLog(battle, fighter, battleLog);
  return {
    side: sideOverride || fighter.side,
    battleSide: fighter.side,
    id: fighter.data.id,
    name: fighter.name,
    title: fighter.title,
    activeCharacterId: activeId,
    activeCharacterName: activeData?.name || fighter.name,
    transformed,
    battleSpriteVariant: characterLogic.battleSpriteVariant(battle, fighter),
    label: fighter.label,
    hp: fighter.hp,
    max_hp: fighter.maxHp,
    maxHp: fighter.maxHp,
    mp: fighter.mp,
    max_mp: fighter.maxMp,
    maxMp: fighter.maxMp,
    inscription: fighter.inscription,
    inscriptionId: fighter.inscriptionId,
    inscriptionName: fighter.inscriptionName,
    atk: roundStat(atk),
    defense: roundStat(defense),
    spd: roundStat(spd),
    stats: { atk: roundStat(atk), def: roundStat(defense), spd: roundStat(spd) },
    baseStats: { hp: fighter.maxHp, atk: fighter.baseAtk, def: fighter.baseDef, spd: fighter.baseSpd },
    status_text: stateText,
    stateText,
    adventure_state_text: adventureStateText,
    adventureStateText,
    hud_state_text: hudStateText,
    hudStateText,
    characterEffectState: characterLogic.battleEffectState(battle, fighter),
    defenseText: `${defenseReductionPercentForStreak(
      fighter.defenseStreak + 1,
      adventureCommonDefenseBonus(battle, fighter),
    )}%`,
    battleLog,
    passive: activeData?.passive || fighter.data.passive,
    passiveIconCharacterId: activeId,
    passiveTransformed: transformed,
    uniqueStatuses: fighter.data.unique_statuses || [],
    adventureMpRecoveryBonus: Number(fighter.adventureMpRecoveryBonus || 0),
    adventureTurnEndHpRecovery: Number(fighter.adventureTurnEndHpRecovery || 0),
    adventureSkillCostMultipliers: { ...(fighter.adventureSkillCostMultipliers || {}) },
    adventureSkillPowerMultipliers: { ...(fighter.adventureSkillPowerMultipliers || {}) },
    adventureSkillAccuracyModifiers: { ...(fighter.adventureSkillAccuracyModifiers || {}) },
    adventureSkillPriorityModifiers: { ...(fighter.adventureSkillPriorityModifiers || {}) },
    adventureAllSkillCostMultiplier: Number(fighter.adventureAllSkillCostMultiplier ?? 1),
    adventureDamageMultiplier: Number(fighter.adventureDamageMultiplier ?? 1),
    adventureCommonAttackPowerBonus: Number(fighter.adventureCommonAttackPowerBonus || 0),
    adventureCommonDefenseReductionBonus: Number(fighter.adventureCommonDefenseReductionBonus || 0),
    adventureMeditationRecoveryBonus: Number(fighter.adventureMeditationRecoveryBonus || 0),
    adventureBattleRhythm: fighter.adventureBattleRhythm ? structuredCloneCompat(fighter.adventureBattleRhythm) : null,
    adventureRelics: structuredCloneCompat(fighter.adventureRelics || []),
    adventureTurnEndFixedDamage: Number(fighter.adventureTurnEndFixedDamage || 0),
    adventureSurviveDefeatCount: Number(fighter.adventureSurviveDefeatCount || 0),
    adventureSkipNextAction: Boolean(fighter.adventureSkipNextAction),
    adventureSkipNextActionLabel: String(fighter.adventureSkipNextActionLabel || ""),
    forbiddenActionKeys: { ...(fighter.forbiddenActionKeys || {}) },
  };
}

function actionStatesForFighter(battle, fighter, forceDisabled = false) {
  return availableActions(fighter, battle).map((action) => {
    const cost = battle.effectiveCost(fighter, action);
    const priority = battle.effectivePriority(fighter, action);
    const disabled = forceDisabled || battle.gameOver || !battle.isLegalChoice(fighter, action);
    const adventurePowerMultiplier = usesAdventurePowerMultiplier(action)
      ? Number(fighter.adventureSkillPowerMultipliers?.[action.key] ?? 1)
      : 1;
    const commonAttackPowerBonus = action.isCommonAction("normal_attack")
      ? Number(fighter.adventureCommonAttackPowerBonus || 0)
      : 0;
    const displayedPower = action.power == null
      ? null
      : roundStat((Number(action.power) + commonAttackPowerBonus) * (Number.isFinite(adventurePowerMultiplier) ? adventurePowerMultiplier : 1));
    const adventureAccuracyModifier = action.isActive
      ? Number(fighter.adventureSkillAccuracyModifiers?.[action.key] ?? 0)
      : 0;
    const debugAccuracyOverride = fighter.debugAccuracyOverride == null
      ? null
      : Number(fighter.debugAccuracyOverride);
    const displayedAccuracy = action.accuracy == null
      ? null
      : Number.isFinite(debugAccuracyOverride)
        ? roundStat(clamp(debugAccuracyOverride, 0, 100))
        : roundStat(clamp(
        Number(action.accuracy)
        + (Number.isFinite(adventureAccuracyModifier) ? adventureAccuracyModifier : 0)
        + (action.isActive && action.isAttack ? adventureRelicEffectSum(fighter, "active_accuracy_bonus") : 0),
        0,
        100,
      ));
    const power = displayedPower == null ? "-" : String(displayedPower);
    const accuracy = displayedAccuracy == null ? "-" : String(displayedAccuracy);
    let effectDescription = action.description;
    if (action.isCommonAction("defense")) {
      const reduction = defenseReductionPercentForStreak(
        fighter.defenseStreak + 1,
        adventureCommonDefenseBonus(battle, fighter),
      );
      effectDescription = `[방어] 자신이 이 턴에 입는 공격 피해를 ${reduction}% 경감한다.`;
    } else if (action.isCommonAction("meditation")) {
      effectDescription = `자신의 MP를 ${battle.meditationRecovery(fighter)} 회복한다.`;
    }
    return {
      number: action.number,
      name: action.name,
      label: `[${action.number}] ${action.name}`,
      target: action.target,
      cost,
      baseCost: action.mp,
      cost_text: String(cost),
      power: displayedPower,
      basePower: action.power,
      accuracy: action.accuracy,
      priority,
      basePriority: action.priority,
      characterId: action.characterId,
      ownerCharacterId: action.ownerCharacterId,
      iconCharacterId: action.characterId || fighter.characterId,
      transformed: Boolean(action.transformed),
      description: `${action.target} / 위력 ${power} / 명중률 ${accuracy} / 우선도 ${priority}\n${effectDescription}`,
      isAttack: action.isAttack,
      isDefense: action.isDefense,
      disabled,
      available: !disabled,
      display: renderAction(action, cost, priority, { power: displayedPower, accuracy: displayedAccuracy, description: effectDescription }),
    };
  });
}

function currentStateText(battle, fighter) {
  const parts = [];
  for (const [name, status] of Object.entries(fighter.statuses || {})) {
    if (status.stackable) {
      parts.push(`${name} ${status.stacks}(${status.remaining}턴)`);
    } else {
      parts.push(`${name}(${status.remaining}턴)`);
    }
  }
  const uniqueStateNames = new Set();
  for (const data of [fighter.data, battle.activeCharacterData(fighter)]) {
    for (const status of data?.unique_statuses || []) {
      if (status?.name) uniqueStateNames.add(status.name);
    }
  }
  for (const [name, value] of Object.entries(fighter.counters || {})) {
    if (!value && !uniqueStateNames.has(name)) continue;
    const formatted = characterLogic.counterStateText(battle, fighter, name, value);
    if (formatted.handled) {
      if (formatted.text) parts.push(formatted.text);
    } else if (uniqueStateNames.has(name) && typeof value === "number") {
      parts.push(`${name} ${value}`);
    } else {
      parts.push(`${name}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
    }
  }
  const groupedStatEffects = new Map();
  for (const effect of fighter.statEffects || []) {
    const stat = String(effect.stat || "").toLowerCase();
    const label = { atk: "ATK", def: "DEF", spd: "SPD" }[stat];
    const multiplier = Number(effect.multiplier);
    const remaining = Number(effect.remaining);
    if (!label || !Number.isFinite(multiplier) || remaining <= 0) continue;
    const key = `${String(effect.source || "")}\u0000${multiplier}\u0000${remaining}`;
    const group = groupedStatEffects.get(key) || { labels: [], multiplier, remaining };
    group.labels.push(label);
    groupedStatEffects.set(key, group);
  }
  for (const effect of groupedStatEffects.values()) {
    parts.push(`${effect.labels.join("·")} ×${roundStat(effect.multiplier)}(${effect.remaining}턴)`);
  }
  for (const effect of fighter.costEffects || []) {
    const multiplier = Number(effect.multiplier);
    const remaining = Number(effect.remaining);
    if (!Number.isFinite(multiplier) || remaining <= 0) continue;
    parts.push(`액티브 MP ×${roundStat(multiplier)}(${remaining}턴)`);
  }
  parts.push(...adventureFighterStateParts(battle, fighter));
  const sealedActions = Object.entries(fighter.forbiddenActionKeys || {})
    .filter(([, remaining]) => Number(remaining) > 0)
    .map(([actionKey, remaining]) => `${battle.displayActionName(fighter, actionKey)}(${remaining}턴)`);
  if (sealedActions.length) parts.push(`선택 봉인: ${sealedActions.join("·")}`);
  parts.push(...characterLogic.extraStateParts(battle, fighter));
  return parts.length ? parts.join(" / ") : "없음";
}

function adventureFighterStateParts(battle, fighter) {
  if (!battle?.adventureState || fighter.side !== battle.player?.side) return [];
  const parts = [];
  const adventureMpRecoveryBonus = Number(fighter.adventureMpRecoveryBonus || 0);
  if (adventureMpRecoveryBonus) parts.push(`기본 MP 회복 +${roundStat(adventureMpRecoveryBonus)}`);
  const adventureTurnEndHpRecovery = Number(fighter.adventureTurnEndHpRecovery || 0);
  if (adventureTurnEndHpRecovery) parts.push(`턴 종료 HP 회복 +${roundStat(adventureTurnEndHpRecovery)}`);
  const skillModifierKeys = new Set([
    ...Object.keys(fighter.adventureSkillCostMultipliers || {}),
    ...Object.keys(fighter.adventureSkillPowerMultipliers || {}),
    ...Object.keys(fighter.adventureSkillAccuracyModifiers || {}),
    ...Object.keys(fighter.adventureSkillPriorityModifiers || {}),
  ]);
  for (const actionKey of skillModifierKeys) {
    const actionName = battle.displayActionName(fighter, actionKey);
    const modifiers = [];
    const cost = Number(fighter.adventureSkillCostMultipliers?.[actionKey] ?? 1);
    const power = Number(fighter.adventureSkillPowerMultipliers?.[actionKey] ?? 1);
    const accuracy = Number(fighter.adventureSkillAccuracyModifiers?.[actionKey] ?? 0);
    const priority = Number(fighter.adventureSkillPriorityModifiers?.[actionKey] ?? 0);
    if (Number.isFinite(cost) && cost !== 1) modifiers.push(`MP ×${roundStat(cost)}`);
    if (Number.isFinite(power) && power !== 1) modifiers.push(`위력 ×${roundStat(power)}`);
    if (Number.isFinite(accuracy) && accuracy !== 0) modifiers.push(`명중률 ${signedNumber(accuracy)}`);
    if (Number.isFinite(priority) && priority !== 0) modifiers.push(`우선도 ${signedNumber(priority)}`);
    if (modifiers.length) parts.push(`${actionName}: ${modifiers.join("·")}`);
  }
  const allSkillCostMultiplier = Number(fighter.adventureAllSkillCostMultiplier ?? 1);
  if (Number.isFinite(allSkillCostMultiplier) && allSkillCostMultiplier !== 1) {
    parts.push(`모든 액티브 MP ×${roundStat(allSkillCostMultiplier)}`);
  }
  const damageMultiplier = Number(fighter.adventureDamageMultiplier ?? 1);
  if (Number.isFinite(damageMultiplier) && damageMultiplier !== 1) {
    parts.push(`공격 피해 ×${roundStat(damageMultiplier)}`);
  }
  const defenseBonus = adventureCommonDefenseBonus(battle, fighter);
  const commonAttackBonus = Number(fighter.adventureCommonAttackPowerBonus || 0);
  if (commonAttackBonus) parts.push(`일반 공격 위력 +${roundStat(commonAttackBonus)}`);
  if (defenseBonus) parts.push(`일반 방어 경감 +${Math.round(defenseBonus * 100)}%p`);
  const meditationBonus = Number(fighter.adventureMeditationRecoveryBonus || 0)
    + adventureRelicEffectSum(fighter, "meditation_bonus");
  if (meditationBonus) parts.push(`명상 회복 +${roundStat(meditationBonus)}`);
  const rhythmKind = String(fighter.adventureBattleRhythm?.kind || "");
  if (ADVENTURE_RHYTHM_LABELS[rhythmKind]) {
    const direction = rhythmKind === "wall" ? "incoming" : "outgoing";
    const multiplier = adventureRhythmAttackMultiplier(fighter, battle.turn, direction);
    parts.push(`전투 리듬: ${ADVENTURE_RHYTHM_LABELS[rhythmKind]}(현재 x${multiplier})`);
  }
  const relicNames = (fighter.adventureRelics || []).filter((relic) => !relic?.destroyed).map((relic) => relic.name);
  if (relicNames.length) parts.push(`유물: ${relicNames.join("·")}`);
  const fixedDamage = Number(fighter.adventureTurnEndFixedDamage || 0);
  if (fixedDamage > 0) parts.push(`턴 종료 고정 피해 ${roundStat(fixedDamage)}`);
  const surviveCount = Number(fighter.adventureSurviveDefeatCount || 0);
  if (surviveCount > 0) parts.push(`수호 부적 ${surviveCount}회`);
  if (fighter.adventureSkipNextAction) {
    parts.push(`다음 행동 불가: ${fighter.adventureSkipNextActionLabel || "행동 봉쇄"}`);
  }
  parts.push(...adventureRouteStateParts(battle.adventureState));
  return parts;
}

function currentAdventureStateText(battle, fighter) {
  const parts = adventureFighterStateParts(battle, fighter);
  return parts.length ? parts.join(" / ") : "없음";
}

function currentHudStateText(stateText, adventureStateText = "없음") {
  const adventureParts = new Set(String(adventureStateText || "")
    .split(" / ")
    .map((part) => part.trim())
    .filter((part) => part && part !== "없음"));
  const hiddenPrefixes = [
    "기본 MP 회복",
    "턴 종료 HP 회복",
    "유물:",
    "여정 능력치",
    "전투 종료 HP 회복 보정",
    "전투 시작 MP 회복",
    "마왕군 최대 HP",
    "전투 보상",
    "행선지 재추첨",
    "유물상의 장부",
    "다음 기습 확률",
    "다음 전투",
  ];
  const parts = String(stateText || "")
    .split(" / ")
    .map((part) => part.trim())
    .filter((part) => part
      && part !== "없음"
      && !adventureParts.has(part)
      && !hiddenPrefixes.some((prefix) => part.startsWith(prefix)))
    .map((part) => part
      .replace(/\((\d+)턴\)/g, " $1T")
      .replace(/\b(ATK(?:·DEF|·SPD)?|DEF(?:·SPD)?|SPD) ×(\d+(?:\.\d+)?)/g, (_match, label, multiplier) => `${label}${Number(multiplier) >= 1 ? "↑" : "↓"}`));
  return parts.length ? parts.join(" · ") : "";
}

function adventureRouteStateParts(adventure) {
  if (!adventure) return [];
  const parts = [];
  const statMultipliers = { atk: 1, def: 1, spd: 1, ...(adventure.playerStatMultipliers || {}) };
  const changedStats = Object.entries(statMultipliers)
    .filter(([, value]) => Number.isFinite(Number(value)) && Number(value) !== 1)
    .map(([stat, value]) => `${stat.toUpperCase()} ×${roundStat(Number(value))}`);
  if (changedStats.length) parts.push(`여정 능력치 ${changedStats.join("·")}`);
  const postBattleHealBonus = Number(adventure.postBattleHealRateBonus || 0);
  if (postBattleHealBonus) parts.push(`전투 종료 HP 회복 보정 ${signedPercentPoint(postBattleHealBonus)}`);
  const battleStartMpRecovery = Number(adventure.battleStartMpRecovery || 0);
  if (battleStartMpRecovery) parts.push(`전투 시작 MP 회복 +${roundStat(battleStartMpRecovery)}`);
  const enemyHpMultiplier = Number(adventure.futureEnemyMaxHpMultiplier ?? 1);
  if (Number.isFinite(enemyHpMultiplier) && enemyHpMultiplier !== 1) {
    parts.push(`마왕군 최대 HP ×${roundStat(enemyHpMultiplier)}`);
  }
  const specialization = adventure.rewardSpecialization;
  if (Number(specialization?.battlesRemaining || 0) > 0) {
    parts.push(`전투 보상 ${String(specialization.preferredStat || "").toUpperCase()} ${Math.round(Number(specialization.preferredBonus || 0) * 100)}%·그 외 ${Math.round(Number(specialization.otherBonus || 0) * 100)}%(${specialization.battlesRemaining}회)`);
  }
  const rerolls = Number(adventure.routeRerollCount || 0);
  if (rerolls > 0) parts.push(`행선지 재추첨 ${rerolls}회`);
  if (adventure.hasRelicLedger) parts.push("유물상의 장부 1개");
  if (adventure.nextAmbushChanceOverride != null) parts.push(`다음 기습 확률 ${Number(adventure.nextAmbushChanceOverride)}%`);
  for (const effect of adventure.nextBattleEffects || []) {
    const battles = Math.max(0, Math.trunc(Number(effect.battlesRemaining || 0)));
    if (!battles) continue;
    const duration = `(${battles}전)`;
    if (effect.type === "all_skill_cost") parts.push(`다음 전투 액티브 MP ×${roundStat(Number(effect.multiplier || 1))}${duration}`);
    else if (effect.type === "damage") parts.push(`다음 전투 공격 피해 ×${roundStat(Number(effect.multiplier || 1))}${duration}`);
    else if (effect.type === "turn_end_mp") parts.push(`다음 전투 턴 종료 MP +${roundStat(Number(effect.amount || 0))}${duration}`);
    else if (effect.type === "skip_enemy_action") parts.push(`다음 전투 상대 첫 행동 봉쇄${duration}`);
    else if (effect.type === "both_turn_end_fixed_damage") parts.push(`다음 전투 양측 턴 종료 피해 ${roundStat(Number(effect.amount || 0))}${duration}`);
  }
  return parts;
}

function signedNumber(value) {
  const number = roundStat(Number(value || 0));
  return number > 0 ? `+${number}` : String(number);
}

function signedPercentPoint(value) {
  const percent = Math.round(Number(value || 0) * 100);
  return `${percent > 0 ? "+" : ""}${percent}%p`;
}

function gameResultText(battle) {
  if (!battle.gameOver) return null;
  if (!battle.winner) return "무승부";
  return `${battle.winner.label} 승리`;
}

function structuredCloneCompat(value) {
  return globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function cloneSimulationValue(value) {
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (value instanceof Set) return new Set(value);
  if (Array.isArray(value)) {
    const clone = new Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      clone[index] = cloneSimulationValue(value[index]);
    }
    return clone;
  }
  const clone = {};
  for (const key of Object.keys(value)) clone[key] = cloneSimulationValue(value[key]);
  return clone;
}

function cloneFighter(source) {
  const fighter = Object.create(Fighter.prototype);
  fighter.side = source.side;
  fighter.data = source.data;
  fighter.inscription = source.inscription;
  fighter.inscriptionId = source.inscriptionId;
  fighter.maxHp = source.maxHp;
  fighter.hp = source.hp;
  fighter.maxMp = source.maxMp;
  fighter.mp = source.mp;
  fighter.baseAtk = source.baseAtk;
  fighter.baseDef = source.baseDef;
  fighter.baseSpd = source.baseSpd;
  fighter.adventureMpRecoveryBonus = source.adventureMpRecoveryBonus;
  fighter.adventureTurnEndHpRecovery = source.adventureTurnEndHpRecovery;
  fighter.adventureSkillCostMultipliers = { ...source.adventureSkillCostMultipliers };
  fighter.adventureSkillPowerMultipliers = { ...source.adventureSkillPowerMultipliers };
  fighter.adventureSkillAccuracyModifiers = { ...source.adventureSkillAccuracyModifiers };
  fighter.adventureSkillPriorityModifiers = { ...source.adventureSkillPriorityModifiers };
  fighter.adventureAllSkillCostMultiplier = source.adventureAllSkillCostMultiplier;
  fighter.adventureDamageMultiplier = source.adventureDamageMultiplier;
  fighter.adventureCommonAttackPowerBonus = source.adventureCommonAttackPowerBonus;
  fighter.adventureCommonDefenseReductionBonus = source.adventureCommonDefenseReductionBonus;
  fighter.adventureMeditationRecoveryBonus = source.adventureMeditationRecoveryBonus;
  fighter.adventureBattleRhythm = source.adventureBattleRhythm
    ? { ...source.adventureBattleRhythm }
    : null;
  fighter.debugAccuracyOverride = source.debugAccuracyOverride;
  fighter.adventureRelics = structuredCloneCompat(source.adventureRelics || []);
  fighter.adventureMeditationRelicReady = Boolean(source.adventureMeditationRelicReady);
  fighter.adventureCounterRelicReady = Boolean(source.adventureCounterRelicReady);
  fighter.adventureTurnEndFixedDamage = source.adventureTurnEndFixedDamage;
  fighter.adventureSurviveDefeatCount = source.adventureSurviveDefeatCount;
  fighter.adventureSkipNextAction = source.adventureSkipNextAction;
  fighter.adventureSkipNextActionLabel = source.adventureSkipNextActionLabel;
  fighter.statuses = {};
  for (const name of Object.keys(source.statuses)) {
    fighter.statuses[name] = { ...source.statuses[name] };
  }
  fighter.statEffects = new Array(source.statEffects.length);
  for (let index = 0; index < source.statEffects.length; index += 1) {
    fighter.statEffects[index] = { ...source.statEffects[index] };
  }
  fighter.costEffects = new Array(source.costEffects.length);
  for (let index = 0; index < source.costEffects.length; index += 1) {
    fighter.costEffects[index] = { ...source.costEffects[index] };
  }
  fighter.counters = cloneSimulationValue(source.counters);
  fighter.defenseStreak = source.defenseStreak;
  fighter.defenseMult = source.defenseMult;
  fighter.defenseName = source.defenseName;
  fighter.evasionChance = source.evasionChance;
  fighter.guaranteedEvasion = source.guaranteedEvasion;
  fighter.selectedHistory = source.selectedHistory.slice();
  fighter.selectedAttackActiveHistory = source.selectedAttackActiveHistory.slice();
  fighter.hitRecords = new Set(source.hitRecords);
  fighter.lastSuccessfulActionKey = source.lastSuccessfulActionKey;
  fighter.forbiddenActionKey = source.forbiddenActionKey;
  fighter.forbiddenRemaining = source.forbiddenRemaining;
  fighter.forbiddenActionKeys = { ...source.forbiddenActionKeys };
  fighter.attackSelectionCount1To5 = source.attackSelectionCount1To5;
  fighter.lastMeditationSuccessTurn = source.lastMeditationSuccessTurn;
  if (Object.hasOwn(source, "ementoForgottenActionKey")) {
    fighter.ementoForgottenActionKey = source.ementoForgottenActionKey;
  }
  if (Object.hasOwn(source, "ementoForecastActionKey")) {
    fighter.ementoForecastActionKey = source.ementoForecastActionKey;
  }
  if (Object.hasOwn(source, "ementoProphecyRemaining")) {
    fighter.ementoProphecyRemaining = source.ementoProphecyRemaining;
  }
  if (Object.hasOwn(source, "ementoDreamFailurePending")) {
    fighter.ementoDreamFailurePending = source.ementoDreamFailurePending;
  }
  fighter.inscriptions = source.inscriptions;
  return fighter;
}

function cloneTurnRecord(source) {
  const record = Object.create(TurnRecord.prototype);
  record.selected = { ...source.selected };
  record.selectedKey = { ...source.selectedKey };
  record.selectedKind = { ...source.selectedKind };
  record.actionSuccess = { ...source.actionSuccess };
  record.attackHit = { ...source.attackHit };
  record.attackDamageTaken = { ...source.attackDamageTaken };
  record.activeAttackMpSpent = { ...source.activeAttackMpSpent };
  record.freezeRemoved = { ...source.freezeRemoved };
  record.defenseReduced = { ...source.defenseReduced };
  record.gainedInsight = { ...source.gainedInsight };
  record.madnessDecided = { ...source.madnessDecided };
  return record;
}

function titleCase(value) {
  return String(value).replace(/(^|[-_ ])(\w)/g, (_, prefix, char) => `${prefix}${char.toUpperCase()}`);
}

module.exports = {
  MAX_MP,
  START_MP,
  DEFAULT_INSCRIPTION_ID,
  RANDOM_INSCRIPTION_ID,
  AI_PERSONALITIES,
  AI_SEARCH_TUNING,
  Battle,
  Fighter,
  Action,
  Choice,
  Mulberry32,
  availableActions,
  actionFromSkill,
  normalActions,
  renderAction,
  resolveCharacterIndex,
  resolvePersonality,
  resolveInscriptionId,
  randomInscriptionId,
  normalizeInscriptions,
  stateForBattle,
  fighterState,
  fighterSummary,
  actionStatesForFighter,
};
