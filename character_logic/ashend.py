"""Ashend battle and AI hooks."""

from __future__ import annotations

from typing import Any


CHARACTER_ID = "ashend"
HIDDEN_COUNTERS = {"재로부터의 엄습", "재가 되어 회피"}


def extra_state_parts(battle: Any, fighter: Any) -> list[str]:
    parts: list[str] = []
    if fighter.counters.get("재로부터의 엄습", 0) > 0:
        parts.append("다음 공격 피해 x1.5")
    if fighter.counters.get("재가 되어 회피", 0) > 0:
        parts.append(f"공격 회피 50% · {fighter.counters['재가 되어 회피']}턴")
    return parts


def reset_turn_flags(battle: Any, fighter: Any) -> None:
    if fighter.counters.get("재가 되어 회피", 0) > 0:
        fighter.evasion_chance += 50


def modify_accuracy_status(battle: Any, choice: Any, target: Any, accuracy: float) -> float:
    if "회진" in choice.actor.statuses and choice.action.is_attack:
        accuracy *= 0.8
    return accuracy


def apply_condition_effects(battle: Any, choice: Any) -> bool | None:
    return None


def modify_attack_power(battle: Any, choice: Any, power: int) -> int:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 2):
        if battle.record.attack_damage_taken.get(actor.side, 0) <= 0 and "회진" in target.statuses:
            turns = target.statuses["회진"].remaining
            choice.power = (choice.power or 0) + turns * 8
            power = int(choice.power)
    return power


def estimated_power(battle: Any, actor: Any, target: Any, action: Any, power: int) -> int:
    if action.is_skill(CHARACTER_ID, 2):
        if battle.record.attack_damage_taken.get(actor.side, 0) <= 0 and "회진" in target.statuses:
            power += target.statuses["회진"].remaining * 8
    return power


def attack_damage_multipliers(battle: Any, choice: Any) -> list[float]:
    if choice.actor.counters.get("재로부터의 엄습", 0) > 0:
        return [1.5]
    return []


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0):
        turns = battle.rng.randint(2, 5)
        print(f"회진 지속시간 {turns}턴으로 결정되었다.")
        battle.add_status(target, "회진", turns, 1, actor.name)
    elif action.is_skill(CHARACTER_ID, 2):
        battle.add_status(target, "회진", 2, 1, actor.name)


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 1):
        actor.guaranteed_evasion = True
        print("이번 턴 이후 상대 공격에 대한 회피 판정이 반드시 성공한다.")
        return True
    if action.is_skill(CHARACTER_ID, 3):
        actor.evasion_chance += 50
        actor.counters["재가 되어 회피"] = 4
        print("4턴 동안 상대의 공격을 50% 확률로 회피한다.")
        return True
    return False


def on_turn_end(battle: Any, fighter: Any) -> None:
    opponent = battle.opponent(fighter)
    if battle.kind_is_attack(battle.record.selected_kind.get(opponent.side)) and battle.record.attack_damage_taken.get(fighter.side, 0) <= 0:
        fighter.counters["재로부터의 엄습"] = 2
        print(f"{fighter.name}은 다음 턴 공격 피해가 1.5배가 된다.")
    if battle.record.selected_key.get(fighter.side) == battle.skill_key(CHARACTER_ID, 1):
        if battle.kind_is_attack(battle.record.selected_kind.get(opponent.side)) and battle.record.attack_damage_taken.get(fighter.side, 0) <= 0:
            battle.add_stat_effect(fighter, "atk", 1.4, 4, "회색의 안개 속으로")


def decrement_counters(fighter: Any) -> None:
    if fighter.counters.get("재로부터의 엄습", 0) > 0:
        fighter.counters["재로부터의 엄습"] -= 1
    if fighter.counters.get("재가 되어 회피", 0) > 0:
        fighter.counters["재가 되어 회피"] -= 1


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    value = 0.0
    dust = target.statuses.get("회진")
    dust_remaining = dust.remaining if dust else 0
    incoming = battle.estimate_best_incoming_damage(target, actor)
    counts = battle.recent_kind_counts(target)
    attack_read = counts["attack"]
    ambush_ready = actor.counters.get("재로부터의 엄습", 0) > 0

    if ambush_ready and action.is_attack:
        value += expected_damage * 0.7 + 260
    if action.is_skill(CHARACTER_ID, 0):
        if dust is None:
            value += 540 * hit_rate
        elif dust_remaining <= 1:
            value += 220
        else:
            value -= 120
    if action.is_skill(CHARACTER_ID, 1):
        value += incoming * 2.1 + attack_read * 420
        if incoming > 0:
            value += 760
        if ambush_ready:
            value -= 220
    if action.is_skill(CHARACTER_ID, 2):
        if dust is not None:
            value += dust_remaining * 340 + expected_damage * 1.1
            if expected_damage >= target.hp:
                value += 2600
        else:
            value -= 260
        if incoming > actor.hp * 0.25 and attack_read > 0:
            value -= 250
    if action.is_skill(CHARACTER_ID, 3):
        value += incoming * 1.35 + attack_read * 260
        if actor.counters.get("재가 되어 회피", 0) <= 0:
            value += 620
        if actor.hp <= incoming:
            value += 480
    return value
