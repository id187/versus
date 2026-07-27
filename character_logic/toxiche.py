"""Toxiche battle and AI hooks."""

from __future__ import annotations

from typing import Any

from .common import floor_int


CHARACTER_ID = "toxiche"
HIDDEN_COUNTERS = {"신려탈피"}


def modify_priority(battle: Any, fighter: Any, action: Any, priority: int) -> int:
    if action.is_active and fighter.counters.get("신려탈피", 0) > 0:
        priority += 1
    return priority


def attack_damage_multipliers(battle: Any, choice: Any) -> list[float]:
    return [1.3] if battle.is_actor_first(choice) else []


def apply_condition_effects(battle: Any, choice: Any) -> bool | None:
    target = battle.opponent(choice.actor)
    if choice.action.is_skill(CHARACTER_ID, 3) and battle.record.selected_kind.get(target.side) == "방어":
        choice.power = (choice.power or 0) + 16
        print("상대가 [방어] 행동을 선택해 위력이 16 증가했다.")
    return None


def estimated_damage_multipliers(battle: Any, actor: Any, target: Any, action: Any) -> list[float]:
    return [1.15]


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0):
        if battle.roll("마비 부여") < 80:
            battle.add_status(target, "마비", 3, 1, actor.name)
    elif action.is_skill(CHARACTER_ID, 2):
        if "마비" in target.statuses:
            battle.heal(actor, floor_int(total_damage * 0.7), "신사지교")
        elif not battle.kind_is_attack(battle.record.selected_kind.get(target.side)) or battle.is_actor_first(choice):
            battle.heal(actor, floor_int(total_damage * 0.5), "신사지교")
    elif action.is_skill(CHARACTER_ID, 3):
        if battle.record.selected_kind.get(target.side) == "방어" and battle.is_actor_first(choice):
            battle.add_status(target, "마비", 4, 1, actor.name)


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    action = choice.action
    if not action.is_skill(CHARACTER_ID, 1):
        return False
    battle.add_stat_effect(actor, "atk", 1.6, 4, action.name)
    battle.add_stat_effect(actor, "def", 0.8, 4, action.name)
    actor.counters["신려탈피"] = 2
    print("다음 턴 액티브 스킬의 우선도가 1 증가한다.")
    return True


def decrement_counters(fighter: Any) -> None:
    if fighter.counters.get("신려탈피", 0) > 0:
        fighter.counters["신려탈피"] -= 1
