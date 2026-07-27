"""Zeroven battle and AI hooks."""

from __future__ import annotations

from typing import Any


CHARACTER_ID = "zeroven"
HIDDEN_COUNTERS = {"거포 강령"}


def init_unique_state(fighter: Any, unique_names: set[str]) -> None:
    if "과령" in unique_names:
        fighter.counters["과령"] = 0
        fighter.counters["거포 강령"] = 0


def extra_state_parts(battle: Any, fighter: Any) -> list[str]:
    if fighter.counters.get("거포 강령", 0) > 0:
        return [f"거포 강령 {fighter.counters['거포 강령']}턴"]
    return []


def setup_value(battle: Any, actor: Any, target: Any, action: Any) -> float:
    if action.is_skill(CHARACTER_ID, 3) and actor.counters.get("과령", 0) >= 4:
        return 220
    return 0.0


def modify_accuracy_actor_before_target(battle: Any, choice: Any, target: Any, accuracy: float) -> float:
    actor = choice.actor
    action = choice.action
    if action.is_active:
        accuracy *= max(0, 1 - int(actor.counters.get("과령", 0)) * 0.03)
    if action.is_attack:
        accuracy += 5
    return accuracy


def modify_accuracy_target(battle: Any, choice: Any, target: Any, accuracy: float) -> float:
    if choice.action.is_attack:
        accuracy += 5
    return accuracy


def apply_condition_effects(battle: Any, choice: Any) -> bool | None:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 1):
        if int(actor.counters.get("과령", 0)) < 3:
            return False
    if action.is_skill(CHARACTER_ID, 2):
        stacks = int(actor.counters.get("과령", 0))
        if stacks <= 0:
            return False
        if stacks >= 5:
            choice.power = (choice.power or 0) + 2
            print("과령 5중첩 이상으로 위력이 2 증가했다.")
        choice.hit_count = battle.rng.randint(1, stacks)
        print(f"[연격] {choice.hit_count}회로 결정되었다.")
    return None


def attack_damage_multipliers(battle: Any, choice: Any) -> list[float]:
    return [1 + int(choice.actor.counters.get("과령", 0)) * 0.2]


def estimated_hit_count(actor: Any, action: Any, use_max: bool) -> float | None:
    if not action.is_skill(CHARACTER_ID, 2):
        return None
    stacks = int(actor.counters.get("과령", 0))
    if stacks <= 0:
        return 0
    return stacks if use_max else (1 + stacks) / 2


def estimated_damage_multipliers(battle: Any, actor: Any, target: Any, action: Any) -> list[float]:
    return [1 + int(actor.counters.get("과령", 0)) * 0.2]


def on_hit_pre_defense_as_actor(battle: Any, choice: Any, total_damage: int) -> None:
    battle.add_vengeance(choice.actor)


def on_hit_pre_defense_as_target(battle: Any, choice: Any, total_damage: int) -> None:
    battle.add_vengeance(battle.opponent(choice.actor))


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    if choice.action.is_skill(CHARACTER_ID, 0):
        if battle.roll("ATK 감소") < 30:
            battle.add_stat_effect(target, "atk", 0.6, 3, choice.action.name)


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 1):
        actor.counters["과령"] = max(0, int(actor.counters.get("과령", 0)) - 3)
        battle.heal(actor, 15, action.name)
        return True
    if action.is_skill(CHARACTER_ID, 3):
        actor.counters["거포 강령"] = 4
        print("4턴 동안 과령 폭주 피해가 억제된다.")
        return True
    return False


def on_turn_end(battle: Any, fighter: Any) -> None:
    if fighter.counters.get("거포 강령", 0) == 1 and int(fighter.counters.get("과령", 0)) >= 6:
        battle.trigger_vengeance_overflow(fighter, "거포 강령 종료")


def decrement_counters(fighter: Any) -> None:
    if fighter.counters.get("거포 강령", 0) > 0:
        fighter.counters["거포 강령"] -= 1


def would_condition_fail(battle: Any, actor: Any, target: Any, action: Any) -> bool | None:
    if action.is_skill(CHARACTER_ID, 1):
        return int(actor.counters.get("과령", 0)) < 3
    if action.is_skill(CHARACTER_ID, 2):
        return int(actor.counters.get("과령", 0)) <= 0
    return None


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    value = 0.0
    stacks = int(actor.counters.get("과령", 0))
    missing_hp = max(0, actor.max_hp - actor.hp)
    if action.is_skill(CHARACTER_ID, 3):
        if stacks >= 5:
            value += 1200
        if stacks >= 4:
            value += 650
        if stacks <= 2 and actor.counters.get("거포 강령", 0) > 0:
            value -= 450
    if action.is_skill(CHARACTER_ID, 1) and stacks >= 3:
        value += 220 + missing_hp * 1.3 + max(0, stacks - 3) * 90
        if actor.hp <= actor.max_hp * 0.35:
            value += 420
    if action.is_skill(CHARACTER_ID, 2) and stacks > 0:
        value += stacks * 160 + expected_damage * 0.9
        if stacks >= 4:
            value += 320
        if expected_damage >= target.hp:
            value += 2500
    if action.is_skill(CHARACTER_ID, 0) and stacks <= 1:
        value += 120
    if action.is_common_action("meditation") and actor.mp < 35:
        value += 120
    return value
