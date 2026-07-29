"""Karossy battle and AI hooks."""

from __future__ import annotations

from typing import Any

from .common import WEATHERS, floor_int, skill_key


CHARACTER_ID = "karossy"


def init_unique_state(fighter: Any, unique_names: set[str]) -> None:
    if "예보" in unique_names:
        fighter.counters["예보"] = "맑음"


def counter_state_text(fighter: Any, name: str, value: Any) -> str | None:
    if name == "예보":
        return f"{name} {value}"
    return None


def setup_value(battle: Any, actor: Any, target: Any, action: Any) -> float:
    return 120 if action.is_skill(CHARACTER_ID, 1) or action.is_skill(CHARACTER_ID, 2) else 0.0


def _planned_weather(action: Any) -> str | None:
    mapping = {
        0: "천둥",
        1: "흐림",
        2: "맑음",
    }
    if action.character_id != CHARACTER_ID or action.slot not in mapping:
        return None
    return mapping[action.slot]


def on_meditation_effect(battle: Any, choice: Any) -> None:
    actor = choice.actor
    if actor.counters.get("예보") == "맑음":
        battle.heal(actor, 5, "맑음")


def target_evasion(battle: Any, target: Any, choice: Any, evasion: float) -> float:
    if target.counters.get("예보") == "흐림":
        if target.defense_name == "일반 방어" and choice.action.is_attack:
            evasion += 15
    return evasion


def modify_attack_power(battle: Any, choice: Any, power: int) -> int:
    actor = choice.actor
    action = choice.action
    if action.is_common_action("normal_attack") and actor.counters.get("예보") == "천둥":
        return 15
    return power


def estimated_power(battle: Any, actor: Any, target: Any, action: Any, power: int) -> int:
    if action.is_common_action("normal_attack") and actor.counters.get("예보") == "천둥":
        return 15
    return power


def attack_damage_multipliers(battle: Any, choice: Any) -> list[float]:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0) and actor.counters.get("예보") == "천둥":
        return [1.5]
    return []


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if not action.is_skill(CHARACTER_ID, 3):
        return
    weather = actor.counters.get("예보")
    if weather == "천둥":
        battle.fixed_damage(target, floor_int(target.max_hp * 0.05), "대기상 폭탄")
    elif weather == "흐림":
        for stat in ("atk", "def", "spd"):
            battle.add_stat_effect(target, stat, 0.9, 4, action.name)
    elif weather == "맑음":
        battle.heal(actor, floor_int(total_damage * 0.4), "대기상 폭탄")


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 1):
        if actor.counters.get("예보") == "흐림":
            for stat in ("atk", "def", "spd"):
                battle.add_stat_effect(actor, stat, 1.3, 4, action.name)
        else:
            battle.add_stat_effect(actor, "atk", 1.1, 4, action.name)
            battle.add_stat_effect(actor, "def", 1.1, 4, action.name)
        return True
    if action.is_skill(CHARACTER_ID, 2):
        battle.heal(actor, 24 if actor.counters.get("예보") == "맑음" else 12, action.name)
        return True
    return False


def on_turn_end(battle: Any, fighter: Any) -> None:
    chosen = battle.record.selected_key.get(fighter.side)
    mapping = {
        skill_key(CHARACTER_ID, 0): "천둥",
        skill_key(CHARACTER_ID, 1): "흐림",
        skill_key(CHARACTER_ID, 2): "맑음",
    }
    current = fighter.counters.get("예보", "맑음")
    if chosen in mapping and mapping[chosen] != current:
        fighter.counters["예보"] = mapping[chosen]
        battle.restore_mp(fighter, 3, "내일의 날씨")
        print(f"예보가 {fighter.counters['예보']}으로 변경되었다.")
    else:
        options = [item for item in WEATHERS if item != current]
        fighter.counters["예보"] = battle.rng.choice(options)
        print(f"{fighter.name}의 예보가 {fighter.counters['예보']}으로 변경되었다.")


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    value = 0.0
    weather = actor.counters.get("예보", "맑음")
    planned = _planned_weather(action)
    counts = battle.recent_kind_counts(target)
    incoming = battle.estimate_best_incoming_damage(target, actor)
    missing_hp = actor.max_hp - actor.hp

    wants_thunder = target.hp <= target.max_hp * 0.45 or actor.mp >= 72
    wants_cloudy = incoming >= actor.hp * 0.38 or counts["attack"] >= 2
    wants_sunny = missing_hp >= 28 or actor.hp <= actor.max_hp * 0.5

    if planned and planned != weather and actor.mp >= 45:
        if planned == "천둥" and wants_thunder:
            value += 520
        elif planned == "흐림" and wants_cloudy:
            value += 560
        elif planned == "맑음" and wants_sunny:
            value += 520
        else:
            value += 120

    if action.is_skill(CHARACTER_ID, 0):
        if weather == "천둥":
            value += 900 + expected_damage * 0.45
        elif wants_thunder and actor.mp >= 50:
            value += 260

    elif action.is_skill(CHARACTER_ID, 1):
        if weather == "흐림":
            value += 1450
        else:
            value += 260
        if wants_cloudy:
            value += incoming * 0.9 + counts["attack"] * 180

    elif action.is_skill(CHARACTER_ID, 2):
        heal = 24 if weather == "맑음" else 12
        value += min(missing_hp, heal) * 34
        if wants_sunny:
            value += 360
        if missing_hp <= 8 and actor.mp < 70:
            value -= 180

    elif action.is_skill(CHARACTER_ID, 3):
        if weather == "천둥":
            value += floor_int(target.max_hp * 0.05) * 40
        elif weather == "흐림":
            value += incoming * 0.75 + counts["attack"] * 220
        elif weather == "맑음":
            value += min(missing_hp, expected_damage * 0.4) * 7
        if actor.mp < 55 and expected_damage < target.hp:
            value -= 320

    elif action.is_common_action("meditation"):
        if weather == "맑음" and missing_hp > 0:
            value += min(missing_hp, 5) * 30
        if actor.mp < 40:
            value += 180

    return value
