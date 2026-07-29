"""Neroko battle and AI hooks."""

from __future__ import annotations

from typing import Any

from .common import floor_int


CHARACTER_ID = "neroko"
HIDDEN_COUNTERS = {"죽을 힘을 다해", "길동무 잔기"}


def adjust_initial_stats(fighter: Any) -> None:
    fighter.max_hp = max(1, floor_int(fighter.max_hp / 9))
    fighter.hp = fighter.max_hp


def init_unique_state(fighter: Any, unique_names: set[str]) -> None:
    if "잔기" in unique_names:
        fighter.counters["잔기"] = 8


def extra_state_parts(battle: Any, fighter: Any) -> list[str]:
    parts: list[str] = []
    if fighter.counters.get("죽을 힘을 다해", 0) == 1:
        parts.append("죽을 힘을 다해: ATK x2")
    elif fighter.counters.get("죽을 힘을 다해", 0) == 2:
        parts.append("죽을 힘을 다해 반동: ATK x0.5 · 선택 불가")
    if "길동무 잔기" in fighter.counters:
        parts.append(f"길동무 기록 {fighter.counters['길동무 잔기']}잔기")
    return parts


def counter_resource_value(fighter: Any, name: str, raw: Any) -> float | None:
    if name == "길동무 잔기":
        return 0.0
    if name == "죽을 힘을 다해":
        if raw == 1:
            return 120
        if raw == 2:
            return -150
        return 0.0
    if name == "잔기" and isinstance(raw, int):
        return raw * 220
    return None


def modify_stats(battle: Any, fighter: Any, atk: float, df: float, spd: float) -> tuple[float, float, float]:
    desperate = fighter.counters.get("죽을 힘을 다해", 0)
    if desperate == 1:
        atk *= 2
    elif desperate == 2:
        atk *= 0.5
    return atk, df, spd


def setup_value(battle: Any, actor: Any, target: Any, action: Any) -> float:
    if action.is_skill(CHARACTER_ID, 1):
        return 360 if actor.counters.get("죽을 힘을 다해", 0) != 1 else 80
    if action.is_skill(CHARACTER_ID, 2):
        incoming = battle.estimate_best_incoming_damage(target, actor)
        if int(actor.counters.get("잔기", 0)) > 0 and actor.hp <= incoming:
            return 520
        return 120
    if action.is_skill(CHARACTER_ID, 3):
        missing_lives = 8 - int(actor.counters.get("잔기", 0))
        return missing_lives * 180
    return 0.0


def is_legal_choice(battle: Any, fighter: Any, action: Any) -> bool | None:
    if action.is_skill(CHARACTER_ID, 1) and fighter.counters.get("죽을 힘을 다해", 0) == 2:
        return False
    return None


def target_evasion(battle: Any, target: Any, choice: Any, evasion: float) -> float:
    if choice.action.is_attack:
        evasion += 9
    return evasion


def estimate_target_evasion(battle: Any, target: Any, action: Any, evasion: float) -> float:
    if action.is_attack:
        evasion += 9
    return evasion


def apply_condition_effects(battle: Any, choice: Any) -> bool | None:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0):
        lives = int(actor.counters.get("잔기", 0))
        power_add = max(0, 9 - lives)
        choice.power = (choice.power or 0) + power_add
        print(f"잔기 {lives}중첩으로 위력이 {power_add} 증가했다.")
    if action.is_skill(CHARACTER_ID, 3):
        if int(actor.counters.get("잔기", 0)) >= 8:
            return False
    return None


def estimated_power(battle: Any, actor: Any, target: Any, action: Any, power: int) -> int:
    if action.is_skill(CHARACTER_ID, 0):
        power += max(0, 9 - int(actor.counters.get("잔기", 0)))
    return power


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 1):
        actor.counters["죽을 힘을 다해"] = 1
        print(f"{actor.name}의 ATK가 잔기를 소모할 때까지 x2가 된다.")
        return True
    if action.is_skill(CHARACTER_ID, 2):
        actor.counters["길동무 잔기"] = int(actor.counters.get("잔기", 0))
        print(f"현재 잔기 {actor.counters['길동무 잔기']}중첩을 길동무 기준으로 기록했다.")
        return True
    if action.is_skill(CHARACTER_ID, 3):
        battle.add_counter(actor, "잔기", 1, max_value=8)
        return True
    return False


def on_turn_end(battle: Any, fighter: Any) -> None:
    opponent = battle.opponent(fighter)
    recorded_lives = fighter.counters.pop("길동무 잔기", None)
    if recorded_lives is not None and int(fighter.counters.get("잔기", 0)) < int(recorded_lives):
        battle.fixed_damage(opponent, 30, "길동무")


def consume_defeat_escape(battle: Any, fighter: Any) -> tuple[int, int, int, int] | None:
    before_lives = int(fighter.counters.get("잔기", 0))
    if before_lives <= 0:
        return None

    previous_desperation = int(fighter.counters.get("죽을 힘을 다해", 0))
    companion_record = fighter.counters.get("길동무 잔기")
    after_lives = max(0, before_lives - 1)

    fighter.statuses.clear()
    fighter.stat_effects.clear()
    fighter.cost_effects.clear()
    fighter.forbidden_action_key = None
    fighter.forbidden_remaining = 0
    fighter.defense_mult = None
    fighter.defense_name = None
    fighter.evasion_chance = 0.0
    fighter.guaranteed_evasion = False

    fighter.counters.clear()
    fighter.counters["잔기"] = after_lives
    if companion_record is not None:
        fighter.counters["길동무 잔기"] = companion_record
    if previous_desperation == 1:
        fighter.counters["죽을 힘을 다해"] = 2
        new_desperation = 2
    else:
        new_desperation = 0

    fighter.hp = fighter.max_hp
    return before_lives, after_lives, previous_desperation, new_desperation


def print_defeat_escape(battle: Any, fighter: Any, revive: tuple[int, int, int, int]) -> None:
    before_lives, after_lives, previous_desperation, new_desperation = revive
    print(f"{fighter.name}의 잔기 {before_lives} → {after_lives}중첩")
    print(f"{fighter.name} HP 회복 0 → {fighter.hp} (잔기)")
    if previous_desperation == 1 and new_desperation == 2:
        print(f"{fighter.name}의 ATK가 죽을 힘을 다해 반동으로 x0.5가 된다.")
    elif previous_desperation == 2:
        print("죽을 힘을 다해 반동과 선택 제한이 해제되었다.")


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    value = 0.0
    lives = int(actor.counters.get("잔기", 0))
    desperate_state = int(actor.counters.get("죽을 힘을 다해", 0))
    incoming = battle.estimate_best_incoming_damage(target, actor)
    counts = battle.recent_kind_counts(target)
    life_loss_expected = lives > 0 and incoming >= actor.hp
    companion_ready = "길동무 잔기" in actor.counters

    if action.is_skill(CHARACTER_ID, 0):
        value += max(0, 9 - lives) * 160
        if desperate_state == 1:
            value += expected_damage * 0.8 + 260

    elif action.is_skill(CHARACTER_ID, 1):
        if desperate_state == 0:
            value += 430
            if life_loss_expected and counts["attack"] > 0:
                value += 760
            if actor.mp < 27:
                value += 220
        else:
            value -= 280

    elif action.is_skill(CHARACTER_ID, 2):
        if companion_ready:
            value -= 520
        elif life_loss_expected:
            value += 2500 + counts["attack"] * 420
        elif counts["attack"] >= 2:
            value += 840
        else:
            value += 120

    elif action.is_skill(CHARACTER_ID, 3):
        missing_lives = max(0, 8 - lives)
        if missing_lives > 0 and not life_loss_expected:
            value += missing_lives * 260
        if life_loss_expected:
            value -= 900
        if actor.mp < 75:
            value -= 380

    elif action.is_common_action("meditation"):
        if actor.mp < 27 and not companion_ready:
            value += 620
        if life_loss_expected and counts["attack"] > 0:
            value += 460
        if actor.mp >= 90:
            value -= 360

    return value


def would_condition_fail(battle: Any, actor: Any, target: Any, action: Any) -> bool | None:
    if action.is_skill(CHARACTER_ID, 3):
        return int(actor.counters.get("잔기", 0)) >= 8
    return None
