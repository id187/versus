"""Plote battle and AI hooks."""

from __future__ import annotations

from typing import Any

from .common import floor_int


CHARACTER_ID = "plote"


def on_action_start_status(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if "화상" not in actor.statuses or not action.is_attack:
        return False
    burn = actor.statuses["화상"]
    damage = floor_int(actor.max_hp * 0.02 * burn.stacks)
    if damage <= 0:
        return False
    battle.fixed_damage(actor, damage, f"화상 {burn.stacks}중첩")
    if target.character_id == CHARACTER_ID:
        recovered = floor_int(burn.stacks * 0.5)
        battle.restore_mp(target, recovered, "영혼 연소")
    return battle.game_over


def apply_condition_effects(battle: Any, choice: Any) -> bool | None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if not action.is_skill(CHARACTER_ID, 2):
        return None
    if battle.record.attack_damage_taken.get(actor.side, 0) > 0:
        return False
    burn = target.statuses.get("화상")
    stacks = burn.stacks if burn else 0
    choice.power = (choice.power or 0) + stacks
    print(f"화상 중첩 수 {stacks}로 위력이 {stacks} 증가했다.")
    return None


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0):
        if battle.roll("화상 부여") < 60:
            battle.add_status(target, "화상", 3, 3, actor.name, stack=True)
    elif action.is_skill(CHARACTER_ID, 3):
        battle.add_status(target, "화상", 4, 4, actor.name, stack=True)
        battle.add_cost_effect(target, 1.2, 4, action.name)


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    if not choice.action.is_skill(CHARACTER_ID, 1):
        return False
    battle.apply_defense(choice.actor, choice.action.name)
    return True


def on_defense_hit(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    if target.defense_name == "가로막는 불길":
        battle.add_status(actor, "화상", 5, 1, target.name, stack=True)


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    value = 0.0
    burn = target.statuses.get("화상")
    burn_stacks = burn.stacks if burn else 0
    incoming = battle.estimate_best_incoming_damage(target, actor)
    counts = battle.recent_kind_counts(target)

    if action.is_skill(CHARACTER_ID, 0) and burn_stacks <= 1:
        value += 160
    if action.is_skill(CHARACTER_ID, 1):
        value += incoming * 0.9 + counts["attack"] * 180
    if action.is_skill(CHARACTER_ID, 2):
        value += burn_stacks * 70
        if burn_stacks > 0 and counts["attack"] <= counts["defense"] + counts["meditation"]:
            value += burn_stacks * 115 + (counts["defense"] + counts["meditation"]) * 360
        if burn_stacks >= 5 and counts["attack"] == 0:
            value += 680
        if incoming > 0 and counts["attack"] >= counts["defense"] + counts["meditation"]:
            value -= min(850, incoming * 16)
        if burn_stacks <= 0:
            value -= 180
    if action.is_skill(CHARACTER_ID, 3):
        value += max(0, 4 - burn_stacks) * 75
    return value
