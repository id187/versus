"""Nihfle battle and AI hooks."""

from __future__ import annotations

from typing import Any


CHARACTER_ID = "nihfle"


def extra_state_parts(battle: Any, fighter: Any) -> list[str]:
    if fighter.last_meditation_success_turn == battle.turn - 1:
        return ["빙결 부여 확률 +10%p"]
    return []


def on_action_start_after_paralysis(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    action = choice.action
    if "빙결" in actor.statuses and not action.is_attack:
        actor.statuses.pop("빙결", None)
        battle.record.freeze_removed[actor.side] = True
        print("빙결로 비공격 행동에 실패하고 빙결이 해제되었다.")
        return True
    return False


def defense_score_bonus_reduction(actor: Any, action: Any) -> float:
    return 0.5 if action.is_skill(CHARACTER_ID, 3) else 0.0


def apply_condition_effects(battle: Any, choice: Any) -> bool | None:
    target = battle.opponent(choice.actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 1) and battle.record.freeze_removed.get(target.side):
        choice.power = (choice.power or 0) + 10
        print("이번 턴 상대의 빙결이 해제되어 위력이 10 증가했다.")
    return None


def attack_damage_multipliers(battle: Any, choice: Any) -> list[float]:
    target = battle.opponent(choice.actor)
    if choice.action.is_skill(CHARACTER_ID, 2) and "빙결" in target.statuses:
        return [3.0]
    return []


def estimated_damage_multipliers(battle: Any, actor: Any, target: Any, action: Any) -> list[float]:
    if action.is_skill(CHARACTER_ID, 2) and "빙결" in target.statuses:
        return [3.0]
    return []


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0):
        if "빙결" in target.statuses:
            battle.add_stat_effect(target, "def", 0.8, 3, action.name)
            battle.add_stat_effect(target, "spd", 0.8, 3, action.name)
        chance = 85 + (10 if actor.last_meditation_success_turn == battle.turn - 1 else 0)
        if battle.roll("빙결 부여") < chance:
            battle.add_status(target, "빙결", 2, 1, actor.name)
    elif action.is_skill(CHARACTER_ID, 1):
        chance = 30
        if battle.record.freeze_removed.get(target.side):
            chance += 50
        if actor.last_meditation_success_turn == battle.turn - 1:
            chance += 10
        if battle.roll("빙결 부여") < chance:
            battle.add_status(target, "빙결", 3, 1, actor.name)
    elif action.is_skill(CHARACTER_ID, 2):
        if "빙결" in target.statuses:
            target.statuses.pop("빙결", None)
            battle.record.freeze_removed[target.side] = True
            print(f"{target.name}의 빙결이 해제되었다.")


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    if not choice.action.is_skill(CHARACTER_ID, 3):
        return False
    battle.apply_defense(choice.actor, choice.action.name, bonus_reduction=0.5)
    return True


def on_defense_hit(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    if target.defense_name == "절대영도":
        if battle.roll("빙결 부여") < 90:
            battle.add_status(actor, "빙결", 4, 1, target.name)


def finish_action(battle: Any, choice: Any, success: bool, hit: bool, miss_not_failure: bool) -> None:
    if choice.action.is_common_action("meditation") and success:
        choice.actor.last_meditation_success_turn = battle.turn


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    value = 0.0
    frozen_status = target.statuses.get("빙결")
    frozen = frozen_status is not None
    freeze_remaining = frozen_status.remaining if frozen_status else 0
    freeze_removed = battle.record.freeze_removed.get(target.side, False)
    incoming = battle.estimate_best_incoming_damage(target, actor)
    counts = battle.recent_kind_counts(target)
    attack_read = counts["attack"] * 1.35
    escape_read = counts["defense"] * 1.25 + counts["meditation"]
    if target.mp < 25:
        escape_read += 0.35
    if target.hp <= expected_damage:
        attack_read += 0.75

    if action.is_common_action("normal_attack"):
        value -= 220
        if frozen:
            value -= 850

    if frozen and action.is_skill(CHARACTER_ID, 2):
        value += expected_damage * 2.4 + 2700
        value += max(0.0, attack_read - escape_read) * 700
        if freeze_remaining <= 1:
            value += 800
        if expected_damage >= target.hp:
            value += 3600
        if escape_read > attack_read + 1:
            value -= min(1100, (escape_read - attack_read - 1) * 450)
    elif frozen and action.is_attack and freeze_remaining <= 1:
        value -= 650

    if action.is_skill(CHARACTER_ID, 0):
        if frozen:
            value += 260 if freeze_remaining >= 2 else -300
        else:
            value += 480 * hit_rate
            if actor.mp < 36 and expected_damage < target.hp:
                value -= 1200
            elif actor.mp >= 46:
                value += 420
    if action.is_skill(CHARACTER_ID, 1):
        if freeze_removed:
            value += 1100
        elif frozen:
            value += max(0.0, escape_read - attack_read) * 650
            if freeze_remaining <= 1:
                value += 500
            if attack_read >= escape_read + 1:
                value -= 350
    if action.is_skill(CHARACTER_ID, 3):
        value += incoming * 1.45
        if incoming > 0:
            value += 420
        if frozen:
            value += attack_read * 260
        elif actor.hp <= incoming * 1.5:
            value += 520
    if action.is_common_action("meditation"):
        if not frozen and actor.mp < 36:
            value += 1100
        elif actor.mp < 46:
            value += 420
        if frozen and actor.mp < 25 and freeze_remaining >= 2:
            value += 850
    return value
