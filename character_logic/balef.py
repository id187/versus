"""Balef battle and AI hooks."""

from __future__ import annotations

import copy
from typing import Any

from .common import floor_int, skill_key


CHARACTER_ID = "balef"
FLOW = "권류"
TRIO_KEYS = {skill_key(CHARACTER_ID, slot) for slot in range(3)}


def init_unique_state(fighter: Any, unique_names: set[str]) -> None:
    if FLOW in unique_names:
        fighter.counters[FLOW] = 0


def needs_battle_log(fighter: Any) -> bool:
    return True


def render_battle_log(battle: Any, fighter: Any, lines: list[str]) -> None:
    recent = [
        battle.display_action_name(fighter, action_key)
        for action_key in fighter.selected_attack_active_history[-3:]
    ]
    lines.append("공격 액티브 선택 기록: " + (" → ".join(recent) if recent else "없음"))
    trio = [skill_key(CHARACTER_ID, slot) for slot in range(3)]
    hits = [
        f"{battle.display_action_name(fighter, action_key)} {'완료' if action_key in fighter.hit_records else '미달성'}"
        for action_key in trio
    ]
    lines.append("삼위일권 명중: " + " / ".join(hits))


def on_make_choice(battle: Any, fighter: Any, action: Any, choice: Any) -> None:
    if action.is_active and action.is_attack:
        choice.prev_attack_active = fighter.selected_attack_active_history[-1] if fighter.selected_attack_active_history else None
        fighter.selected_attack_active_history.append(action.key)


def modify_priority(battle: Any, fighter: Any, action: Any, priority: int) -> int:
    if action.is_skill(CHARACTER_ID, 1):
        prev = fighter.selected_attack_active_history[-1] if fighter.selected_attack_active_history else None
        if prev == skill_key(CHARACTER_ID, 2):
            priority += 1
    return priority


def on_action_start(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    action = choice.action
    if action.is_active and action.is_attack:
        prev = choice.prev_attack_active
        if prev and prev != action.key:
            actor.counters[FLOW] = int(actor.counters.get(FLOW, 0)) + 1
            print(f"권류가 1중첩 증가했다. 현재 {actor.counters[FLOW]}중첩")
    return False


def apply_condition_effects(battle: Any, choice: Any) -> bool | None:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 2):
        if choice.prev_attack_active == skill_key(CHARACTER_ID, 0):
            choice.power = (choice.power or 0) + 10
            print("범권괴권 연계로 위력이 10 증가했다.")
    if action.is_skill(CHARACTER_ID, 3):
        if len(actor.selected_attack_active_history) < 2:
            return False
    return None


def attack_damage_multipliers(battle: Any, choice: Any) -> list[float]:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    multipliers = [1 + int(actor.counters.get(FLOW, 0)) * 0.05]
    if action.is_skill(CHARACTER_ID, 0):
        flow = int(actor.counters.get(FLOW, 0))
        if choice.prev_attack_active == skill_key(CHARACTER_ID, 2):
            multipliers.append(1.8)
        elif flow % 2 == 0:
            multipliers.append(1.4)
    if action.is_skill(CHARACTER_ID, 2):
        if target.defense_mult is not None:
            multipliers.append(3.0)
    return multipliers


def estimated_damage_multipliers(battle: Any, actor: Any, target: Any, action: Any) -> list[float]:
    projected_flow = _projected_flow(actor, action)
    multipliers = [1 + projected_flow * 0.05]
    prev = _prev_attack(actor)
    if action.is_skill(CHARACTER_ID, 0):
        if prev == skill_key(CHARACTER_ID, 2):
            multipliers.append(1.8)
        elif projected_flow % 2 == 0:
            multipliers.append(1.4)
    if action.is_skill(CHARACTER_ID, 2) and target.defense_mult is not None:
        multipliers.append(3.0)
    return multipliers


def estimated_power(battle: Any, actor: Any, target: Any, action: Any, power: int) -> int:
    if action.is_skill(CHARACTER_ID, 2) and _prev_attack(actor) == skill_key(CHARACTER_ID, 0):
        return power + 10
    return power


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_active and action.is_attack:
        actor.hit_records.add(action.key)
        trio = {skill_key(CHARACTER_ID, 0), skill_key(CHARACTER_ID, 1), skill_key(CHARACTER_ID, 2)}
        if trio.issubset(actor.hit_records):
            fixed = floor_int(target.max_hp * 0.06)
            battle.fixed_damage(target, fixed, "삼위일권")
            actor.hit_records.difference_update(trio)
            if battle.game_over:
                return
    if action.is_skill(CHARACTER_ID, 0):
        if choice.prev_attack_active == skill_key(CHARACTER_ID, 1):
            battle.add_stat_effect(target, "atk", 0.9, 3, action.name)
            battle.add_stat_effect(actor, "atk", 1.1, 3, action.name)
    elif action.is_skill(CHARACTER_ID, 1):
        rate = 0.7 if choice.prev_attack_active == skill_key(CHARACTER_ID, 0) else 0.5
        amount = floor_int(total_damage * rate)
        reduced = battle.reduce_mp(target, amount, "흡성대권")
        battle.restore_mp(actor, reduced, "흡성대권")
    elif action.is_skill(CHARACTER_ID, 2):
        if choice.prev_attack_active == skill_key(CHARACTER_ID, 1):
            battle.heal(actor, floor_int(total_damage * 0.3), "관통마권")


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    if not choice.action.is_skill(CHARACTER_ID, 3):
        return False
    actor = choice.actor
    history = actor.selected_attack_active_history
    if len(history) < 2:
        print("복제할 공격 액티브 기록이 부족하다.")
        return True
    actor.counters[FLOW] = int(actor.counters.get(FLOW, 0)) + 1
    first, second = history[-2], history[-1]
    original = actor.skill_by_key(first)
    if not original:
        return True
    copied = copy.copy(original)
    copied.mp = 0
    copied.power = floor_int((copied.power or 0) * 1.7)
    copied.accuracy = 100
    copied.priority = 0
    actor.selected_attack_active_history.append(copied.key)
    nested = choice.__class__(
        actor,
        copied,
        0,
        0,
        copied.power,
        copied.accuracy,
        prev_attack_active=second,
        copied_from=choice.action.name,
    )
    print(f"극의환권으로 {copied.name}을 복제해 즉시 처리한다.")
    battle.execute_action(nested, depth=1)
    return True


def would_condition_fail(battle: Any, actor: Any, target: Any, action: Any) -> bool | None:
    if action.is_skill(CHARACTER_ID, 3):
        return len(actor.selected_attack_active_history) < 2
    return None


def _prev_attack(actor: Any) -> str | None:
    return actor.selected_attack_active_history[-1] if actor.selected_attack_active_history else None


def _projected_flow(actor: Any, action: Any) -> int:
    flow = int(actor.counters.get(FLOW, 0))
    prev = _prev_attack(actor)
    if action.is_active and action.is_attack and prev and prev != action.key:
        flow += 1
    return flow


def _missing_trio(actor: Any) -> set[str]:
    return TRIO_KEYS.difference(actor.hit_records)


def _defense_read(battle: Any, target: Any, expected_damage: float) -> float:
    counts = battle.recent_kind_counts(target)
    value = counts["defense"] * 1.35 + counts["meditation"] * 0.25
    if expected_damage >= target.hp * 0.75:
        value += 1.0
    if expected_damage >= target.hp:
        value += 1.2
    if target.defense_streak >= 2:
        value -= 0.7
    return max(0.0, value)


def setup_value(battle: Any, actor: Any, target: Any, action: Any) -> float:
    if not action.is_skill(CHARACTER_ID, 3) or len(actor.selected_attack_active_history) < 2:
        return 0.0
    first, second = actor.selected_attack_active_history[-2], actor.selected_attack_active_history[-1]
    missing = _missing_trio(actor)
    value = 520 + int(actor.counters.get(FLOW, 0)) * 80
    if first in missing:
        value += 1450
        if len(missing) == 1:
            value += 1250
    if first != second:
        value += 420
    if TRIO_KEYS.issubset(actor.hit_records):
        value += floor_int(target.max_hp * 0.06) * 85
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
    prev = _prev_attack(actor)
    missing = _missing_trio(actor)
    flow = int(actor.counters.get(FLOW, 0))
    projected_flow = _projected_flow(actor, action)
    defense_read = _defense_read(battle, target, expected_damage)
    missing_mp = max(0, 100 - actor.mp)

    if action.is_active and action.is_attack:
        if prev:
            value += 360 if action.key != prev else -260
        if TRIO_KEYS.issubset(actor.hit_records):
            value += floor_int(target.max_hp * 0.06) * 95
        elif action.key in missing:
            value += 520 * hit_rate
            if len(missing) == 1:
                value += 1500 * hit_rate
            elif len(missing) == 2:
                value += 520 * hit_rate
        elif missing:
            value -= 240

    if action.is_skill(CHARACTER_ID, 0):
        if prev == skill_key(CHARACTER_ID, 2):
            value += 820
        elif projected_flow % 2 == 0:
            value += 420
        if prev == skill_key(CHARACTER_ID, 1):
            value += 520
            if battle.estimate_best_incoming_damage(target, actor) >= actor.hp * 0.45:
                value += 380

    elif action.is_skill(CHARACTER_ID, 1):
        rate = 0.7 if prev == skill_key(CHARACTER_ID, 0) else 0.5
        expected_drain = min(target.mp, floor_int(max(0, expected_damage) * rate))
        useful_drain = min(missing_mp, expected_drain)
        if target.mp >= 25:
            value += expected_drain * 70
        if useful_drain >= 8:
            value += useful_drain * 140
        if actor.mp <= 55 and target.mp >= 45:
            value += 1300
        if prev == skill_key(CHARACTER_ID, 0):
            value += 620
            if actor.mp <= 60 and target.mp >= 45:
                value += 1300
        if prev == skill_key(CHARACTER_ID, 2):
            value += 360
        if actor.mp >= 86 and target.mp < 20:
            value -= 650

    elif action.is_skill(CHARACTER_ID, 2):
        if prev == skill_key(CHARACTER_ID, 0):
            value += 740
        if prev == skill_key(CHARACTER_ID, 1):
            value += 360 + min(700, max(0, 100 - actor.hp) * 8)
        if defense_read >= 2.2:
            value += 3400
        elif defense_read >= 1.2:
            value += 1400
        if target.defense_streak >= 2:
            value -= 520

    elif action.is_skill(CHARACTER_ID, 3):
        if len(actor.selected_attack_active_history) >= 2:
            first = actor.selected_attack_active_history[-2]
            if first in missing:
                value += 520
            elif missing:
                value -= 4200 if len(missing) == 1 else 1800
            if flow >= 3:
                value += 300
        if actor.mp < 58:
            value -= 360

    elif action.is_common_action("meditation"):
        if actor.mp < 39 and len(missing) <= 1:
            value += 460
        if actor.mp >= 90:
            value -= 520

    if action.is_common_action("normal_attack") and missing:
        value -= 280
    return value
