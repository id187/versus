"""Cryne battle and AI hooks."""

from __future__ import annotations

from typing import Any


CHARACTER_ID = "cryne"


def init_unique_state(fighter: Any, unique_names: set[str]) -> None:
    if "상흔" in unique_names:
        fighter.counters["상흔"] = 0


def counter_resource_value(fighter: Any, name: str, raw: Any) -> float | None:
    if name == "상흔" and isinstance(raw, int):
        return raw * 48
    return None


def apply_condition_effects(battle: Any, choice: Any) -> bool | None:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0):
        stacks = int(actor.counters.get("상흔", 0))
        choice.power = (choice.power or 0) + stacks
        print(f"상흔 {stacks}중첩으로 위력이 {stacks} 증가했다.")
    if action.is_skill(CHARACTER_ID, 2):
        if battle.record.attack_damage_taken.get(actor.side, 0) <= 0:
            return False
    if action.is_skill(CHARACTER_ID, 3):
        stacks = int(actor.counters.get("상흔", 0))
        if stacks < 5:
            return False
        choice.hit_count = battle.rng.randint(max(1, stacks - 4), stacks)
        print(f"[연격] {choice.hit_count}회로 결정되었다.")
    return None


def attack_damage_multipliers(battle: Any, choice: Any) -> list[float]:
    actor = choice.actor
    missing = actor.max_hp - actor.hp
    return [1 + missing / actor.max_hp]


def estimated_hit_count(actor: Any, action: Any, use_max: bool) -> float | None:
    if not action.is_skill(CHARACTER_ID, 3):
        return None
    stacks = int(actor.counters.get("상흔", 0))
    if stacks < 5:
        return 0
    return stacks if use_max else (max(1, stacks - 4) + stacks) / 2


def estimated_damage_multipliers(battle: Any, actor: Any, target: Any, action: Any) -> list[float]:
    return [1 + (actor.max_hp - actor.hp) / actor.max_hp]


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    return None


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    action = choice.action
    if not action.is_skill(CHARACTER_ID, 1):
        return False
    battle.fixed_damage(actor, 15, "울부짖는 상처")
    if not battle.game_over:
        battle.add_stat_effect(actor, "atk", 1.4, 4, action.name)
        battle.add_stat_effect(actor, "def", 1.4, 4, action.name)
    return True


def finish_action(battle: Any, choice: Any, success: bool, hit: bool, miss_not_failure: bool) -> None:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0):
        battle.fixed_damage(actor, 5, action.name)
    elif action.is_skill(CHARACTER_ID, 3) and success:
        actor.counters["상흔"] = 0
        print("상흔을 모두 소모했다.")


def on_damage_taken(battle: Any, target: Any, amount: int, attack: bool, source: Any | None) -> None:
    battle.add_counter(target, "상흔", 1)


def would_condition_fail(battle: Any, actor: Any, target: Any, action: Any) -> bool | None:
    if action.is_skill(CHARACTER_ID, 2):
        return battle.record.attack_damage_taken.get(actor.side, 0) <= 0
    if action.is_skill(CHARACTER_ID, 3):
        return int(actor.counters.get("상흔", 0)) < 5
    return None
