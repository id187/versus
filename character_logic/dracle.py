"""Dracle battle and AI hooks."""

from __future__ import annotations

from typing import Any

from .common import floor_int


CHARACTER_ID = "dracle"
DRAGON = "혁룡"
DAMAGE_RECORD = "혁룡 피해 기록"
AWAKENING = "혁룡 각성"
SCALE_GUARD = "용의 비늘"
BLOODLUST = "용혈의 투지"
HIDDEN_COUNTERS = {DAMAGE_RECORD, AWAKENING, SCALE_GUARD, BLOODLUST}

BASE_MAX_DRAGON = 10
AWAKENED_MAX_DRAGON = 15
AWAKENING_GAIN = 5
AWAKENING_TURNS = 4
AWAKENING_READY_MP = 60
DAMAGE_RECORD_PER_STACK = 15
BREATH_DAMAGE_MULTIPLIER = 1.3
BREATH_MP_DRAIN_RATIO = 0.3
CLAW_ATK_MULTIPLIER = 1.2
CLAW_ATK_TURNS = 3


def init_unique_state(fighter: Any, unique_names: set[str]) -> None:
    if DRAGON in unique_names:
        fighter.counters[DRAGON] = 0
        fighter.counters[DAMAGE_RECORD] = 0


def counter_state_text(fighter: Any, name: str, value: Any) -> str | None:
    if name == DRAGON:
        return f"{DRAGON} {int(value)}/{_max_dragon(fighter)}"
    return None


def extra_state_parts(battle: Any, fighter: Any) -> list[str]:
    parts: list[str] = []
    record = int(fighter.counters.get(DAMAGE_RECORD, 0))
    if record > 0 or _dragon(fighter) < _max_dragon(fighter):
        parts.append(f"{DAMAGE_RECORD} {record}/{DAMAGE_RECORD_PER_STACK}")
    if int(fighter.counters.get(AWAKENING, 0)) > 0:
        parts.append(f"{AWAKENING} {fighter.counters[AWAKENING]}턴")
    if int(fighter.counters.get(SCALE_GUARD, 0)) > 0:
        parts.append(f"{SCALE_GUARD}: 공격 피해 -{_scale_reduction(fighter)}")
    if int(fighter.counters.get(BLOODLUST, 0)) > 0:
        parts.append(f"{BLOODLUST}: 공격 피해 x1.1")
    return parts


def reset_turn_flags(battle: Any, fighter: Any) -> None:
    fighter.counters.pop(SCALE_GUARD, None)


def counter_resource_value(fighter: Any, name: str, raw: Any) -> float | None:
    if name == DRAGON and isinstance(raw, int):
        return raw * 115
    if name == DAMAGE_RECORD and isinstance(raw, int):
        return raw * 8
    if name == AWAKENING:
        return 520 if int(raw or 0) > 0 else 0.0
    if name == BLOODLUST:
        return 190 if int(raw or 0) > 0 else 0.0
    return None


def on_action_start(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0) and _dragon(actor) >= 1:
        battle.restore_mp(actor, 3, action.name)
    return False


def apply_condition_effects(battle: Any, choice: Any) -> bool | None:
    actor = choice.actor
    action = choice.action
    dragon = _dragon(actor)
    if action.is_skill(CHARACTER_ID, 0) and dragon >= 4:
        bonus = floor_int(dragon * 1.5)
        choice.power = (choice.power or 0) + bonus
        print(f"{DRAGON} {dragon}/{_max_dragon(actor)} 기준으로 위력이 {bonus} 증가했다.")
    if action.is_skill(CHARACTER_ID, 1) and dragon < 1:
        return False
    if action.is_skill(CHARACTER_ID, 3) and (dragon < 5 or _awakening_active(actor)):
        return False
    return None


def estimated_power(battle: Any, actor: Any, target: Any, action: Any, power: int) -> int:
    dragon = _dragon(actor)
    if action.is_skill(CHARACTER_ID, 0) and dragon >= 4:
        power += floor_int(dragon * 1.5)
    return power


def attack_damage_multipliers(battle: Any, choice: Any) -> list[float]:
    actor = choice.actor
    action = choice.action
    dragon = _dragon(actor)
    multipliers: list[float] = []
    if int(actor.counters.get(BLOODLUST, 0)) > 0:
        multipliers.append(1.1)
    if action.is_skill(CHARACTER_ID, 0) and dragon >= 7:
        multipliers.append(BREATH_DAMAGE_MULTIPLIER)
    if action.is_skill(CHARACTER_ID, 2):
        chance = _claw_double_chance(actor)
        roll = battle.roll("용의 발톱 피해 증폭")
        print(f"용의 발톱 피해 증폭 {chance}% / 판정값 {roll:.2f}")
        if roll < chance:
            multipliers.append(2.0)
    return multipliers


def estimated_damage_multipliers(battle: Any, actor: Any, target: Any, action: Any) -> list[float]:
    dragon = _dragon(actor)
    multipliers: list[float] = []
    if int(actor.counters.get(BLOODLUST, 0)) > 0:
        multipliers.append(1.1)
    if action.is_skill(CHARACTER_ID, 0) and dragon >= 7:
        multipliers.append(BREATH_DAMAGE_MULTIPLIER)
    if action.is_skill(CHARACTER_ID, 2):
        multipliers.append(1 + _claw_double_chance(actor) / 100)
    return multipliers


def modify_attack_damage(battle: Any, choice: Any, target: Any, damage: int) -> int:
    if int(target.counters.get(SCALE_GUARD, 0)) <= 0:
        return damage
    reduction = _scale_reduction(target)
    if reduction <= 0:
        return damage
    reduced = max(1, damage - reduction)
    if reduced < damage:
        print(f"{SCALE_GUARD}로 공격 피해가 {damage} → {reduced}로 감소했다.")
    return reduced


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    _record_dragon_damage(battle, actor, total_damage)
    if action.is_skill(CHARACTER_ID, 0) and _dragon(actor) >= 10:
        battle.reduce_mp(target, floor_int(total_damage * BREATH_MP_DRAIN_RATIO), action.name)
    if action.is_skill(CHARACTER_ID, 2):
        battle.add_stat_effect(actor, "atk", CLAW_ATK_MULTIPLIER, CLAW_ATK_TURNS, action.name)


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 1):
        actor.counters[SCALE_GUARD] = 1
        print(f"이번 턴 동안 공격 피해가 {_scale_reduction(actor)} 감소한다.")
        return True
    if action.is_skill(CHARACTER_ID, 3):
        actor.counters[AWAKENING] = AWAKENING_TURNS
        battle.add_counter(actor, DRAGON, AWAKENING_GAIN, max_value=_max_dragon(actor))
        print(f"{AWAKENING}으로 {DRAGON} 최대 중첩이 {_max_dragon(actor)}가 되었다.")
        _convert_damage_record(battle, actor)
        return True
    return False


def finish_action(battle: Any, choice: Any, success: bool, hit: bool, miss_not_failure: bool) -> None:
    if choice.action.is_common_action("normal_attack") and success and hit:
        choice.actor.counters[BLOODLUST] = 2
        print(f"다음 턴 동안 {BLOODLUST}로 공격 피해가 1.1배가 된다.")


def decrement_counters(fighter: Any) -> None:
    if int(fighter.counters.get(BLOODLUST, 0)) > 0:
        remaining = int(fighter.counters.get(BLOODLUST, 0)) - 1
        if remaining <= 0:
            fighter.counters.pop(BLOODLUST, None)
        else:
            fighter.counters[BLOODLUST] = remaining
    if int(fighter.counters.get(AWAKENING, 0)) <= 0:
        return
    remaining = int(fighter.counters.get(AWAKENING, 0))
    if remaining <= 1:
        fighter.counters.pop(AWAKENING, None)
        before = _dragon(fighter)
        fighter.counters[DRAGON] = min(BASE_MAX_DRAGON, max(0, before - AWAKENING_GAIN))
        print(f"{AWAKENING} 종료: {DRAGON} {before}/{AWAKENED_MAX_DRAGON} → {fighter.counters[DRAGON]}/{BASE_MAX_DRAGON}")
    else:
        fighter.counters[AWAKENING] = remaining - 1


def setup_value(battle: Any, actor: Any, target: Any, action: Any) -> float:
    dragon = _dragon(actor)
    incoming = battle.estimate_best_incoming_damage(target, actor)
    if action.is_skill(CHARACTER_ID, 1):
        if dragon < 1:
            return 0.0
        reduction = _scale_reduction(actor)
        if incoming < actor.hp * 0.45:
            return 0.0
        value = min(incoming, reduction) * 55
        if incoming >= actor.hp:
            value += 1200
        elif incoming >= actor.hp * 0.45:
            value += 520
        return value
    if not action.is_skill(CHARACTER_ID, 3):
        return 0.0
    if dragon < 5 or _awakening_active(actor):
        return 0.0
    if actor.mp < _awakening_ready_mp(action):
        return -2600 - max(0, _awakening_ready_mp(action) - actor.mp) * 22
    value = 2100 + dragon * 190 + int(actor.counters.get(DAMAGE_RECORD, 0)) * 24
    if actor.mp >= _awakening_ready_mp(action) + 10:
        value += 420
    if incoming >= actor.hp:
        value -= 1500
    return value


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    value = 0.0
    dragon = _dragon(actor)
    incoming = battle.estimate_best_incoming_damage(target, actor)
    awakening_action = actor.skill_by_key(battle.skill_key(CHARACTER_ID, 3))
    ready_mp = _awakening_ready_mp(awakening_action) if awakening_action else AWAKENING_READY_MP
    wants_awakening = dragon >= 5 and not _awakening_active(actor)

    if action.is_common_action("normal_attack"):
        value += 220 + _dragon_gain_value(actor, expected_damage * hit_rate)
        if actor.mp < 35:
            value += 180
    elif action.is_common_action("meditation"):
        if wants_awakening and actor.mp < ready_mp:
            value += 1100 + (ready_mp - actor.mp) * 28
        elif actor.mp < 45:
            value += 420
        if actor.mp >= 88:
            value -= 650

    if action.is_skill(CHARACTER_ID, 0):
        value += 260 + _dragon_gain_value(actor, expected_damage * hit_rate)
        if dragon < 5:
            value += max(0, 5 - dragon) * 120
        if dragon >= 1:
            value += 210
        if dragon >= 4:
            value += dragon * 65
        if dragon >= 7:
            value += expected_damage * 0.75
        if dragon >= 10 and target.mp > 0:
            value += min(target.mp, floor_int(expected_damage * BREATH_MP_DRAIN_RATIO)) * 38

    elif action.is_skill(CHARACTER_ID, 1):
        if dragon < 1:
            value -= 3200
        else:
            reduction = _scale_reduction(actor)
            prevented = min(incoming, reduction)
            value += prevented * 70 + dragon * 20
            if incoming >= actor.hp:
                value += 1800
            elif incoming >= actor.hp * 0.55:
                value += 820
            else:
                value -= 520
            if incoming <= reduction * 0.45:
                value -= 260
            if wants_awakening and actor.mp < ready_mp:
                value -= 650

    elif action.is_skill(CHARACTER_ID, 2):
        value += _dragon_gain_value(actor, expected_damage * hit_rate)
        chance = _claw_double_chance(actor)
        value += chance * 12
        value += (180 if _has_stat_effect(actor, "atk", action.name) else 520) * hit_rate
        if expected_damage >= target.hp:
            value += 3600
        elif dragon >= 5 and not _awakening_active(actor):
            cost = battle.effective_cost(actor, action)
            if actor.mp - cost + 10 < ready_mp and expected_damage < target.hp * 0.65:
                value -= 780
        if dragon >= 8:
            value += 520

    elif action.is_skill(CHARACTER_ID, 3):
        if dragon < 5:
            value -= 4800
        elif _awakening_active(actor):
            value -= 3600
        elif actor.mp < ready_mp:
            value -= 3600 + (ready_mp - actor.mp) * 32
        else:
            value += 3200 + dragon * 260
            value += int(actor.counters.get(DAMAGE_RECORD, 0)) * 34
            if actor.mp >= ready_mp + 10:
                value += 620
            if incoming >= actor.hp:
                value -= 1800

    return value


def would_condition_fail(battle: Any, actor: Any, target: Any, action: Any) -> bool | None:
    if action.is_skill(CHARACTER_ID, 1):
        return _dragon(actor) < 1
    if action.is_skill(CHARACTER_ID, 3):
        return _dragon(actor) < 5 or _awakening_active(actor)
    return None


def _dragon(fighter: Any) -> int:
    return int(fighter.counters.get(DRAGON, 0))


def _max_dragon(fighter: Any) -> int:
    return AWAKENED_MAX_DRAGON if _awakening_active(fighter) else BASE_MAX_DRAGON


def _awakening_active(fighter: Any) -> bool:
    return int(fighter.counters.get(AWAKENING, 0)) > 0


def _scale_reduction(fighter: Any) -> int:
    return _dragon(fighter) * 4


def _claw_double_chance(fighter: Any) -> int:
    return min(100, _dragon(fighter) * 10)


def _awakening_ready_mp(action: Any | None) -> int:
    cost = int(getattr(action, "mp", 43) if action is not None else 43)
    return max(AWAKENING_READY_MP, cost + 17)


def _has_stat_effect(fighter: Any, stat: str, source: str) -> bool:
    return any(
        getattr(effect, "stat", None) == stat
        and getattr(effect, "source", None) == source
        and int(getattr(effect, "remaining", 0)) > 0
        for effect in getattr(fighter, "stat_effects", [])
    )


def _dragon_gain_value(actor: Any, expected_damage: float) -> float:
    if _dragon(actor) >= _max_dragon(actor):
        return 0.0
    record = int(actor.counters.get(DAMAGE_RECORD, 0))
    projected = record + max(0, expected_damage)
    gained = min(_max_dragon(actor) - _dragon(actor), floor_int(projected / DAMAGE_RECORD_PER_STACK))
    return gained * 520 + min(DAMAGE_RECORD_PER_STACK - 1, projected % DAMAGE_RECORD_PER_STACK) * 18


def _record_dragon_damage(battle: Any, actor: Any, total_damage: int) -> None:
    if total_damage <= 0 or _dragon(actor) >= _max_dragon(actor):
        return
    before = int(actor.counters.get(DAMAGE_RECORD, 0))
    actor.counters[DAMAGE_RECORD] = before + total_damage
    print(f"{DAMAGE_RECORD} {before} → {actor.counters[DAMAGE_RECORD]}")
    _convert_damage_record(battle, actor)


def _convert_damage_record(battle: Any, actor: Any) -> None:
    record = int(actor.counters.get(DAMAGE_RECORD, 0))
    current = _dragon(actor)
    max_dragon = _max_dragon(actor)
    gained = min(max_dragon - current, record // DAMAGE_RECORD_PER_STACK)
    if gained <= 0:
        return
    actor.counters[DAMAGE_RECORD] = record - gained * DAMAGE_RECORD_PER_STACK
    actor.counters[DRAGON] = current + gained
    print(f"{actor.name}의 {DRAGON} {current}/{max_dragon} → {actor.counters[DRAGON]}/{max_dragon}")
