"""Charinel battle and AI hooks."""

from __future__ import annotations

from typing import Any

from .common import floor_int, kind_is_attack


CHARACTER_ID = "charinel"


def init_unique_state(fighter: Any, unique_names: set[str]) -> None:
    if "집광" in unique_names:
        fighter.counters["집광"] = 0


def setup_value(battle: Any, actor: Any, target: Any, action: Any) -> float:
    if action.is_common_action("meditation") or action.is_skill(CHARACTER_ID, 1):
        return 180
    return 0.0


def turn_end_mp_bonus(fighter: Any) -> int:
    return int(fighter.counters.get("집광", 0))


def estimated_power(battle: Any, actor: Any, target: Any, action: Any, power: int) -> int:
    remaining_mp = max(0, actor.mp - battle.effective_cost(actor, action))
    focus = int(actor.counters.get("집광", 0))
    if action.is_skill(CHARACTER_ID, 0) and focus >= 1:
        power += floor_int(remaining_mp * 0.2)
    if action.is_skill(CHARACTER_ID, 3):
        power += floor_int(remaining_mp * 1.4)
    return power


def estimated_damage_multipliers(battle: Any, actor: Any, target: Any, action: Any) -> list[float]:
    if not action.is_skill(CHARACTER_ID, 3):
        return []
    focus = int(actor.counters.get("집광", 0))
    if focus < 1:
        return []
    return [1 + focus * 0.05]


def apply_condition_effects(battle: Any, choice: Any) -> bool | None:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 2):
        if int(actor.counters.get("집광", 0)) < 1:
            return False
    if action.is_skill(CHARACTER_ID, 3):
        if actor.mp >= 1:
            extra = actor.mp
            actor.mp = 0
            choice.consumed_mp_extra = extra
            power_add = floor_int(extra * 1.4)
            choice.power = (choice.power or 0) + power_add
            print(f"현재 MP {extra}를 모두 소모해 위력이 {power_add} 증가했다.")
    if action.is_skill(CHARACTER_ID, 0):
        if int(actor.counters.get("집광", 0)) >= 1:
            power_add = floor_int(actor.mp * 0.2)
            choice.power = (choice.power or 0) + power_add
            print(f"현재 MP의 20%로 위력이 {power_add} 증가했다.")
    return None


def attack_damage_multipliers(battle: Any, choice: Any) -> list[float]:
    actor = choice.actor
    action = choice.action
    if not action.is_skill(CHARACTER_ID, 3):
        return []
    focus = int(actor.counters.get("집광", 0))
    if focus < 1:
        return []
    actor.counters["집광"] = 0
    print(f"집광 {focus}중첩을 모두 소모해 피해 배율이 증가했다.")
    return [1 + focus * 0.05]


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0):
        battle.add_counter(actor, "집광", 1)
    elif action.is_skill(CHARACTER_ID, 2):
        if battle.record.action_success.get(target.side) and not kind_is_attack(battle.record.selected_kind.get(target.side)):
            actor.counters["집광"] = max(0, int(actor.counters.get("집광", 0)) - 1)
            reduced = battle.reduce_mp(target, 15, "흡광옥")
            battle.restore_mp(actor, reduced, "흡광옥")


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    action = choice.action
    if not action.is_skill(CHARACTER_ID, 1):
        return False
    battle.fixed_damage(actor, 8, "광폭화")
    battle.add_counter(actor, "집광", 4)
    return True


def finish_action(battle: Any, choice: Any, success: bool, hit: bool, miss_not_failure: bool) -> None:
    action = choice.action
    if action.is_common_action("meditation") and success:
        battle.add_counter(choice.actor, "집광", 1)
        choice.actor.last_meditation_success_turn = battle.turn


def on_damage_taken(battle: Any, target: Any, amount: int, attack: bool, source: Any | None) -> None:
    if attack:
        battle.restore_mp(target, floor_int(amount * 0.2), "빛을 향한 믿음")


def would_condition_fail(battle: Any, actor: Any, target: Any, action: Any) -> bool | None:
    if action.is_skill(CHARACTER_ID, 2):
        return int(actor.counters.get("집광", 0)) < 1
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
    focus = int(actor.counters.get("집광", 0))
    counts = battle.recent_kind_counts(target)
    non_attack_read = counts["defense"] * 1.2 + counts["meditation"] * 1.2
    attack_read = counts["attack"]
    incoming = battle.estimate_best_incoming_damage(target, actor)

    if action.is_skill(CHARACTER_ID, 0):
        value += 180
        if focus >= 1:
            value += min(520, actor.mp * 8)
    if action.is_skill(CHARACTER_ID, 1):
        emergency = incoming >= actor.hp
        if focus < 4 and not emergency:
            value += 3600
            if actor.mp >= 50:
                value += 1600
            if actor.hp < actor.max_hp * 0.35:
                value -= 900
        else:
            value += 220
        if actor.mp < 35:
            value -= 180
        if actor.hp <= 16:
            value -= 1600
    if action.is_skill(CHARACTER_ID, 2):
        value -= 450
        if non_attack_read >= attack_read + 1 and focus >= 2:
            value += 620 + non_attack_read * 430
        if target.mp >= 35 and non_attack_read >= attack_read + 1 and focus >= 2:
            value += min(500, target.mp * 7)
        if focus <= 1:
            value -= 700
        elif focus >= 4 and non_attack_read <= attack_read:
            value -= 500
        if attack_read > non_attack_read:
            value -= min(850, (attack_read - non_attack_read) * 360)
    if action.is_skill(CHARACTER_ID, 3):
        lethal = expected_damage >= target.hp
        emergency = incoming >= actor.hp
        charged = (actor.mp >= 70 and focus >= 4) or (actor.mp >= 60 and focus >= 8)
        if lethal:
            value += 5200 + expected_damage * 2.2
        elif emergency:
            value += 2600 + expected_damage * 1.8
        elif charged:
            value += 3000 + expected_damage * 1.8
        else:
            value -= 2200
            value -= max(0, 70 - actor.mp) * 12
            value -= max(0, 4 - focus) * 360
    if action.is_common_action("meditation"):
        value += 360 + max(0, 70 - actor.mp) * 8
        if focus < 4:
            value += 260
        if incoming < actor.hp and actor.mp < 70:
            value += 300
    return value
