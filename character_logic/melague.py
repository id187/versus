"""Melague battle and AI hooks."""

from __future__ import annotations

from typing import Any

from .common import floor_int, kind_is_attack


CHARACTER_ID = "melague"
HIDDEN_COUNTERS = {"병혈 전파"}


def reset_turn_flags(battle: Any, fighter: Any) -> None:
    fighter.counters.pop("병혈 전파", None)


def apply_condition_effects(battle: Any, choice: Any) -> bool | None:
    target = battle.opponent(choice.actor)
    if choice.action.is_skill(CHARACTER_ID, 1):
        plague = target.statuses.get("역병")
        if (plague.stacks if plague else 0) < 4:
            return False
    return None


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0):
        battle.add_status(target, "역병", 2, 2, actor.name, stack=True)
    elif action.is_skill(CHARACTER_ID, 1):
        plague = target.statuses.get("역병")
        if plague:
            spent = floor_int(plague.stacks * 0.5)
            plague.stacks = max(0, plague.stacks - spent)
            print(f"{target.name}의 역병 {spent}중첩을 소모했다.")
            battle.heal(actor, spent * 4, "항체 활성")
            battle.add_status(target, "역병", 3, 1, actor.name, stack=True)
    elif action.is_skill(CHARACTER_ID, 3):
        for _ in range(7):
            battle.fixed_damage(target, 1, "시궁의 쥐떼")
            if battle.game_over:
                return


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    action = choice.action
    if not action.is_skill(CHARACTER_ID, 2):
        return False
    battle.add_stat_effect(actor, "def", 0.8, 1, action.name)
    actor.counters["병혈 전파"] = 1
    return True


def on_defense_hit(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    if target.counters.get("병혈 전파", 0) > 0 and total_damage > 0:
        battle.add_status(actor, "역병", 4, floor_int(total_damage * 0.3), target.name, stack=True)


def on_fixed_damage_to_opponent(battle: Any, actor: Any, target: Any, amount: int) -> None:
    if amount <= 0:
        return
    roll = battle.roll("상처 감염")
    print(f"상처 감염 30% / 판정값 {roll:.2f}")
    if roll < 30:
        battle.add_status(target, "역병", 2, 1, actor.name, stack=True)


def pre_character_turn_end(battle: Any, fighter: Any) -> None:
    if "역병" not in fighter.statuses:
        return
    stacks = fighter.statuses["역병"].stacks
    battle.fixed_damage(fighter, stacks, f"역병 {stacks}중첩")


def would_condition_fail(battle: Any, actor: Any, target: Any, action: Any) -> bool | None:
    if action.is_skill(CHARACTER_ID, 1):
        plague = target.statuses.get("역병")
        return (plague.stacks if plague else 0) < 4
    return None
