"""Melague battle and AI hooks."""

from __future__ import annotations

from typing import Any

from .common import floor_int, kind_is_attack


CHARACTER_ID = "melague"
PLAGUE = "역병"
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


def _plague_stacks(fighter: Any) -> int:
    status = fighter.statuses.get(PLAGUE)
    return int(status.stacks) if status else 0


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    value = 0.0
    plague = _plague_stacks(target)
    incoming = battle.estimate_best_incoming_damage(target, actor)
    counts = battle.recent_kind_counts(target)
    attack_read = counts["attack"] * 1.3
    non_attack_read = counts["defense"] + counts["meditation"]
    missing_hp = max(0, actor.max_hp - actor.hp)

    if action.is_skill(CHARACTER_ID, 0):
        if plague < 4:
            value += (4 - plague) * 260 * hit_rate
        elif plague >= 7:
            value -= 320

    elif action.is_skill(CHARACTER_ID, 1):
        if plague >= 4:
            spent = plague // 2
            value += spent * (260 + min(12, missing_hp) * 10)
            if actor.hp < actor.max_hp * 0.55:
                value += spent * 180
            if plague >= 8:
                value += 520

    elif action.is_skill(CHARACTER_ID, 2):
        expected_plague = floor_int(incoming * 0.3)
        if incoming <= 0 or expected_plague <= 0:
            value -= 700
        else:
            value += expected_plague * 180
            if plague < 4:
                value += min(4 - plague, expected_plague) * 360
            if incoming >= 28:
                value += min(900, incoming * 18)
            if incoming >= 35:
                value += 1800
            if attack_read > non_attack_read:
                value += min(900, (attack_read - non_attack_read) * 420)
                if incoming >= 35:
                    value += 5200
            elif non_attack_read > attack_read + 1:
                value -= min(850, (non_attack_read - attack_read) * 320)
        if actor.hp <= incoming * 1.2 + 4:
            value -= 2400
        elif actor.hp <= incoming * 1.55:
            value -= 650

    elif action.is_skill(CHARACTER_ID, 3):
        value += 7 * 45
        if expected_damage + 7 >= target.hp:
            value += 2200
        elif plague < 4:
            value += 420
        if actor.mp < 55 and target.hp > expected_damage + 7:
            value -= 420

    elif action.is_common_action("meditation"):
        if actor.mp < 27 and plague >= 3:
            value += 520
        elif actor.mp < 20:
            value += 260

    if action.is_common_action("normal_attack") and plague < 4:
        value -= 180
    return value
