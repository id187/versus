"""Dethus battle and AI hooks."""

from __future__ import annotations

from typing import Any

from .common import floor_int


CHARACTER_ID = "dethus"


def pre_mp_turn_end(battle: Any, fighter: Any) -> None:
    if "갈증" in fighter.statuses and fighter.mp <= 9:
        stacks = fighter.statuses["갈증"].stacks
        battle.fixed_damage(fighter, stacks * 3, f"갈증 {stacks}중첩")


def modify_attack_power(battle: Any, choice: Any, power: int) -> int:
    actor = choice.actor
    target = battle.opponent(actor)
    if choice.action.is_common_action("normal_attack"):
        thirst = target.statuses.get("갈증")
        power += (thirst.stacks if thirst else 0) * 2
    return power


def estimated_power(battle: Any, actor: Any, target: Any, action: Any, power: int) -> int:
    if action.is_common_action("normal_attack"):
        thirst = target.statuses.get("갈증")
        power += (thirst.stacks if thirst else 0) * 2
    return power


def _recent_high_mp_skill_count(target: Any) -> int:
    count = 0
    history = target.selected_history
    for key in history[-4:]:
        previous = target.skill_by_key(key)
        if previous and previous.mp >= 35:
            count += 1
    return count


def _high_mp_skill_read(target: Any) -> float:
    value = float(_recent_high_mp_skill_count(target))
    if target.mp >= 70:
        value += 1.2
    elif target.mp >= 48:
        value += 0.7
    return value


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 3):
        reduced = battle.reduce_mp(target, 50, "말라붙는 대지")
        stacks = floor_int(reduced * 0.1)
        if stacks > 0:
            battle.add_status(target, "갈증", 4, stacks, actor.name, stack=True)
    elif action.is_skill(CHARACTER_ID, 0):
        if battle.record.selected_kind.get(target.side) in {"액티브 공격", "액티브 비공격"}:
            battle.add_status(target, "갈증", 4, 1, actor.name, stack=True)
    elif action.is_skill(CHARACTER_ID, 2):
        battle.reduce_mp(target, 15, "신기루의 저주")
        battle.add_status(target, "갈증", 3, 1, actor.name, stack=True)


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    if not choice.action.is_skill(CHARACTER_ID, 1):
        return False
    battle.apply_defense(choice.actor, choice.action.name)
    return True


def on_defense_hit(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    if target.defense_name != "빠져드는 모래늪":
        return
    spent = battle.record.active_attack_mp_spent.get(actor.side, 0)
    if spent > 0:
        value = floor_int(spent * 0.25)
        reduced = battle.reduce_mp(actor, value, "빠져드는 모래늪")
        battle.restore_mp(target, reduced, "빠져드는 모래늪")


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    value = 0.0
    thirst = target.statuses.get("갈증")
    thirst_stacks = thirst.stacks if thirst else 0
    counts = battle.recent_kind_counts(target)
    incoming = battle.estimate_best_incoming_damage(target, actor)
    high_mp_read = _high_mp_skill_read(target)
    meditation_loop = counts["meditation"] >= 2

    if action.is_common_action("normal_attack"):
        value += thirst_stacks * 170
        if meditation_loop:
            value += 360 + thirst_stacks * 180

    elif action.is_skill(CHARACTER_ID, 0):
        if high_mp_read > 0 or counts["attack"] + counts["meditation"] > counts["defense"]:
            value += 260 + high_mp_read * 180
        if thirst_stacks <= 0:
            value += 140

    elif action.is_skill(CHARACTER_ID, 1):
        value += incoming * 1.15 + counts["attack"] * 240
        if high_mp_read >= 1.0:
            value += 380

    elif action.is_skill(CHARACTER_ID, 2):
        if high_mp_read >= 1.0:
            value += 780 + high_mp_read * 420
        if target.mp >= 35:
            value += min(700, target.mp * 8)
        if target.mp <= 15:
            value -= 420

    elif action.is_skill(CHARACTER_ID, 3):
        if meditation_loop:
            value += 2100 + min(1200, target.mp * 14)
        elif target.mp >= 72:
            value += 1150
        elif target.mp < 38:
            value -= 900
        if thirst_stacks >= 3:
            value += thirst_stacks * 140

    return value
