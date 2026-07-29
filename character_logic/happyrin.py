"""Happyrin battle and AI hooks."""

from __future__ import annotations

from typing import Any


CHARACTER_ID = "happyrin"
MADNESS = "광증"
MAX_MADNESS = 10
PASSIVE_AMOUNT = 7


def _madness_stacks(fighter: Any) -> int:
    status = fighter.statuses.get(MADNESS)
    return int(status.stacks) if status else 0


def _add_madness(battle: Any, fighter: Any, turns: int, stacks: int, source: str) -> None:
    battle.add_status(fighter, MADNESS, turns, stacks, source, stack=True, max_stacks=MAX_MADNESS)


def _madness_hit_cap(actor: Any, target: Any, replaced: bool) -> int:
    cap = _madness_stacks(actor)
    if replaced:
        cap += _madness_stacks(target)
    return max(0, cap)


def on_action_start_status(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    original = choice.action
    status = actor.statuses.get(MADNESS)
    if not status or not original.is_active:
        return False

    chance = min(100, int(status.stacks) * 10)
    roll = battle.roll(MADNESS)
    print(f"광증 판정 {chance}% / 판정값 {roll:.2f}")
    if roll >= chance:
        return False

    options = []
    for slot in range(len(actor.data.get("skills", []))):
        action = actor.skill_by_key(battle.skill_key(actor.character_id, slot))
        if action and action.key != original.key:
            options.append(action)
    if not options:
        return False

    replacement = battle.rng.choice(options)
    choice.action = replacement
    choice.power = replacement.power
    choice.accuracy = replacement.accuracy
    choice.hit_count = 1
    choice.madness_replaced = True
    choice.madness_original_action_key = original.key
    battle.record.madness_decided[actor.side] = True
    _prepare_replacement_choice(actor, choice, replacement)
    print(f"광증으로 {original.name} 대신 {replacement.name}이 결정되었다.")
    return False


def _prepare_replacement_choice(actor: Any, choice: Any, action: Any) -> None:
    if actor.character_id == "gandrick":
        choice.selected_bullets = int(actor.counters.get("탄환", 0)) if action.is_skill("gandrick", 3) else None
    if actor.character_id == "balef" and action.is_active and action.is_attack and choice.prev_attack_active is None:
        history = actor.selected_attack_active_history
        choice.prev_attack_active = history[-1] if history else None


def apply_condition_effects(battle: Any, choice: Any) -> bool | None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 1):
        _add_madness(battle, actor, 2, 1, action.name)
    elif action.is_skill(CHARACTER_ID, 2):
        hit_cap = _madness_hit_cap(actor, target, choice.madness_replaced)
        if hit_cap < 1:
            return False
        choice.hit_count = battle.rng.randint(1, hit_cap)
        print(f"[연격] 광증 중첩 수 {hit_cap} 기준으로 {choice.hit_count}회로 결정되었다.")
    return None


def estimated_hit_count(actor: Any, action: Any, use_max: bool) -> float | None:
    if action.is_skill(CHARACTER_ID, 2):
        hit_cap = max(1, _madness_stacks(actor))
        return hit_cap if use_max else (1 + hit_cap) / 2
    return None


def attack_damage_multipliers(battle: Any, choice: Any) -> list[float]:
    if choice.action.is_skill(CHARACTER_ID, 1) and choice.madness_replaced:
        return [2.0]
    return []


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0):
        recipient = target if choice.madness_replaced else actor
        _add_madness(battle, recipient, 5, 1, action.name)
    elif action.is_skill(CHARACTER_ID, 1):
        stacks = _madness_stacks(actor)
        if choice.madness_replaced:
            stacks *= 2
        _add_madness(battle, target, 4, stacks, action.name)


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    action = choice.action
    if not action.is_skill(CHARACTER_ID, 3):
        return False
    _add_madness(battle, actor, 4, 5, action.name)
    multiplier = 1.7 if choice.madness_replaced else 1.2
    for stat in ("atk", "def", "spd"):
        battle.add_stat_effect(actor, stat, multiplier, 4, action.name)
    return True


def on_turn_end(battle: Any, fighter: Any) -> None:
    if fighter.character_id != CHARACTER_ID:
        return
    opponent = battle.opponent(fighter)
    if battle.record.madness_decided.get(fighter.side):
        battle.heal(fighter, PASSIVE_AMOUNT, "복약 지도")
    if battle.record.madness_decided.get(opponent.side):
        battle.fixed_damage(opponent, PASSIVE_AMOUNT, "복약 지도")


def setup_value(battle: Any, actor: Any, target: Any, action: Any) -> float:
    own_madness = _madness_stacks(actor)
    target_madness = _madness_stacks(target)
    if action.is_skill(CHARACTER_ID, 3):
        incoming = battle.estimate_best_incoming_damage(target, actor)
        if own_madness < 5:
            value = 3500 if actor.hp > incoming * 1.15 else 950
            if action.mp <= actor.mp <= action.mp + 16:
                value += 520
            return value
        return 240
    if action.is_skill(CHARACTER_ID, 1):
        return max(180, (MAX_MADNESS - target_madness) * 70)
    if action.is_skill(CHARACTER_ID, 0) and own_madness < 3:
        return 220
    return 0.0


def _active_skill_actions(battle: Any, actor: Any) -> list[Any]:
    actions: list[Any] = []
    for slot in range(len(actor.data.get("skills", []))):
        action = actor.skill_by_key(battle.skill_key(actor.character_id, slot))
        if action is not None:
            actions.append(action)
    return actions


def _madness_result_value(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    replaced: bool,
    incoming: float,
) -> float:
    own_madness = _madness_stacks(actor)
    target_madness = _madness_stacks(target)
    hit_rate = battle.estimate_hit_rate(actor, target, action)
    damage = battle.estimate_action_damage(actor, target, action, use_max=False)

    if replaced and action.is_skill(CHARACTER_ID, 1):
        damage *= 2.0
    if replaced and action.is_skill(CHARACTER_ID, 2):
        one_hit = battle.calculate_estimated_damage(actor, target, action)
        hit_cap = _madness_hit_cap(actor, target, replaced=True)
        damage = one_hit * ((1 + hit_cap) / 2)

    expected_damage = damage * hit_rate
    value = expected_damage * 3.2
    if action.is_attack and expected_damage >= target.hp:
        value += 7200
    elif action.is_attack and damage >= target.hp:
        value += 4600 * hit_rate

    if action.is_skill(CHARACTER_ID, 0):
        if replaced:
            value += max(0, min(1, MAX_MADNESS - target_madness)) * 360 * hit_rate
        else:
            value += 180 if own_madness < 4 else -180
    elif action.is_skill(CHARACTER_ID, 1):
        own_after_condition = min(MAX_MADNESS, own_madness + 1)
        stacks = own_after_condition * (2 if replaced else 1)
        applied = min(MAX_MADNESS - target_madness, stacks)
        value += max(0, applied) * (145 + own_after_condition * 18) * hit_rate
        if own_madness >= 8:
            value -= 220
    elif action.is_skill(CHARACTER_ID, 2):
        hit_cap = _madness_hit_cap(actor, target, replaced)
        if hit_cap < 1:
            value -= 2400
        else:
            value += min(10, hit_cap) * 115 * hit_rate
        if replaced and target_madness >= 2:
            value += min(6, target_madness) * 140 * hit_rate
    elif action.is_skill(CHARACTER_ID, 3):
        multiplier = 1.7 if replaced else 1.2
        value += 950 if multiplier < 1.5 else 2550
        value += max(0, actor.max_hp - actor.hp) * (0.8 if multiplier < 1.5 else 1.25)
        if incoming >= actor.hp:
            value -= 650
        if own_madness >= 8:
            value -= 240

    if replaced:
        value += PASSIVE_AMOUNT * 42
    return value


def _madness_decoy_bonus(battle: Any, actor: Any, target: Any, action: Any, incoming: float) -> float:
    own_madness = _madness_stacks(actor)
    if own_madness <= 0 or not action.is_active:
        return 0.0

    proc = min(1.0, own_madness / 10)
    options = [candidate for candidate in _active_skill_actions(battle, actor) if candidate.key != action.key]
    if not options:
        return 0.0

    direct = _madness_result_value(battle, actor, target, action, replaced=False, incoming=incoming)
    replacement_values = [
        _madness_result_value(battle, actor, target, candidate, replaced=True, incoming=incoming)
        for candidate in options
    ]
    replacement_average = sum(replacement_values) / len(replacement_values)
    bonus = (replacement_average - direct) * proc

    if own_madness >= 6 and replacement_average > direct:
        best_replacement = max(replacement_values)
        bonus += max(0.0, best_replacement - replacement_average) * proc * 0.18
        bonus *= 1 + (own_madness - 5) * 0.22
        bonus = min(bonus, 1150 + own_madness * 70)
        pressure = incoming / max(1, actor.hp)
        hp_ratio = actor.hp / max(1, actor.max_hp)
        if pressure >= 1.0:
            bonus *= 0.2
        elif pressure >= 0.65 and hp_ratio < 0.55:
            bonus *= 0.4
        elif pressure >= 0.45 and hp_ratio < 0.45:
            bonus *= 0.65
    return bonus


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    value = 0.0
    own_madness = _madness_stacks(actor)
    target_madness = _madness_stacks(target)
    incoming = battle.estimate_best_incoming_damage(target, actor)

    value += _madness_decoy_bonus(battle, actor, target, action, incoming)

    if own_madness >= 6 and action.is_active:
        value -= (own_madness - 5) * 130
    if own_madness >= 7 and action.is_common_action("meditation"):
        value += 260

    if action.is_skill(CHARACTER_ID, 0):
        value += max(0, 4 - own_madness) * 120
        if own_madness == 0:
            if action.mp <= actor.mp < 37 and actor.mp + 10 < 37:
                value += 900
            elif actor.mp + 10 >= 37:
                value -= 260
        elif own_madness <= 2:
            value += 360
        if own_madness >= 6:
            value -= 180
    elif action.is_skill(CHARACTER_ID, 1):
        value += max(1, own_madness + 1) * 150 * hit_rate
        value += max(0, 6 - target_madness) * 90
    elif action.is_skill(CHARACTER_ID, 2):
        if expected_damage >= target.hp:
            value += 1800
        else:
            value += max(0, own_madness - 1) * 170 * hit_rate
    elif action.is_skill(CHARACTER_ID, 3):
        value += 620
        if own_madness < 5:
            value += 800
            if actor.hp > incoming * 1.15:
                value += 720
        if incoming >= actor.hp:
            value -= 500
    return value


def would_condition_fail(battle: Any, actor: Any, target: Any, action: Any) -> bool | None:
    if action.is_skill(CHARACTER_ID, 2):
        return _madness_stacks(actor) < 1
    return None
