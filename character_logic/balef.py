"""Balef battle and AI hooks."""

from __future__ import annotations

import copy
from typing import Any

from .common import floor_int, skill_key


CHARACTER_ID = "balef"


def init_unique_state(fighter: Any, unique_names: set[str]) -> None:
    if "권류" in unique_names:
        fighter.counters["권류"] = 0


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
            actor.counters["권류"] = int(actor.counters.get("권류", 0)) + 1
            print(f"권류가 1중첩 증가했다. 현재 {actor.counters['권류']}중첩")
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
    multipliers = [1 + int(actor.counters.get("권류", 0)) * 0.05]
    if action.is_skill(CHARACTER_ID, 0):
        flow = int(actor.counters.get("권류", 0))
        if choice.prev_attack_active == skill_key(CHARACTER_ID, 2):
            multipliers.append(1.8)
        elif flow % 2 == 0:
            multipliers.append(1.4)
    if action.is_skill(CHARACTER_ID, 2):
        if target.defense_mult is not None:
            multipliers.append(3.0)
    return multipliers


def estimated_damage_multipliers(battle: Any, actor: Any, target: Any, action: Any) -> list[float]:
    return [1 + int(actor.counters.get("권류", 0)) * 0.05]


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
    actor.counters["권류"] = int(actor.counters.get("권류", 0)) + 1
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
