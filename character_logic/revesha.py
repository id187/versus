"""Revesha battle and AI hooks."""

from __future__ import annotations

from typing import Any

from .common import floor_int, kind_is_attack


CHARACTER_ID = "revesha"


def init_unique_state(fighter: Any, unique_names: set[str]) -> None:
    if "통찰" in unique_names:
        fighter.counters["통찰"] = 0


def needs_battle_log(fighter: Any) -> bool:
    return True


def render_battle_log(battle: Any, fighter: Any, lines: list[str]) -> None:
    opponent = battle.opponent(fighter)
    last_success = battle.display_action_name(opponent, opponent.last_successful_action_key) if opponent.last_successful_action_key else "없음"
    lines.append(f"상대 마지막 성공 행동: {last_success}")


def counter_resource_value(fighter: Any, name: str, raw: Any) -> float | None:
    if name == "통찰" and isinstance(raw, int):
        return raw * 135
    return None


def modify_stats(battle: Any, fighter: Any, atk: float, df: float, spd: float) -> tuple[float, float, float]:
    mult = 1 + int(fighter.counters.get("통찰", 0)) * 0.05
    return atk * mult, df * mult, spd * mult


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0):
        insight = int(actor.counters.get("통찰", 0))
        battle.heal(actor, insight // 2, "날이 뒤집힌 검")
    elif action.is_skill(CHARACTER_ID, 2):
        forbidden_key = target.last_successful_action_key
        if forbidden_key:
            forbidden = battle.display_action_name(target, forbidden_key)
            target.forbidden_action_key = forbidden_key
            target.forbidden_remaining = 3
            print(f"{target.name}은 3턴 동안 {forbidden}을 선택할 수 없다.")
    elif action.is_skill(CHARACTER_ID, 3):
        insight = int(actor.counters.get("통찰", 0))
        fixed = floor_int((target.max_hp - target.hp) * (insight * 0.07))
        battle.fixed_damage(target, fixed, "예견된 종말")


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    if not choice.action.is_skill(CHARACTER_ID, 1):
        return False
    battle.apply_defense(choice.actor, choice.action.name)
    return True


def on_defense_hit(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    if target.defense_name == "깨져버린 거울":
        battle.fixed_damage(actor, floor_int(total_damage * 1.3), "깨져버린 거울")


def on_turn_end(battle: Any, fighter: Any) -> None:
    opponent = battle.opponent(fighter)
    own = battle.record.selected_kind.get(fighter.side)
    opp = battle.record.selected_kind.get(opponent.side)
    gained = (
        (opp == "명상" and kind_is_attack(own))
        or (kind_is_attack(opp) and own == "방어")
        or (opp == "방어" and own == "명상")
    )
    if gained:
        battle.add_counter(fighter, "통찰", 1)
        battle.record.gained_insight[fighter.side] = True
        return
    battle.fixed_damage(fighter, floor_int(fighter.max_hp * 0.02), "끝은 필연적이니")
    if battle.game_over:
        return
    battle.fixed_damage(opponent, floor_int(opponent.max_hp * 0.02), "끝은 필연적이니")


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    value = 0.0
    insight = int(actor.counters.get("통찰", 0))
    counts = battle.recent_kind_counts(target)
    insight_weight = 1 + max(0, 6 - insight) * 0.18
    incoming = battle.estimate_best_incoming_damage(target, actor)
    history = target.selected_history[:-1] if target.side in battle.record.selected else target.selected_history

    if action.is_attack:
        value += counts["meditation"] * 430 * insight_weight
        if target.mp < 35:
            value += 180 * insight_weight
    if action.is_defense:
        value += counts["attack"] * 440 * insight_weight
        value += incoming * (0.95 + 0.1 * max(0, 4 - insight))
        if action.is_skill(CHARACTER_ID, 1):
            value += incoming * 1.45 + 240
            if counts["attack"] >= max(counts["defense"], counts["meditation"]) + 1:
                value += 500
    if action.is_common_action("meditation"):
        value += counts["defense"] * 430 * insight_weight
        if actor.mp < 55:
            value += 180

    if action.is_skill(CHARACTER_ID, 0) and insight > 0:
        value += min(actor.max_hp - actor.hp, insight // 2) * 36
    if action.is_skill(CHARACTER_ID, 2) and target.last_successful_action_key:
        repeated = history[-3:].count(target.last_successful_action_key)
        value += 420 + repeated * 260
        if battle.action_key_is_attack(target, target.last_successful_action_key):
            value += 160
        elif battle.action_key_is_defense(target, target.last_successful_action_key):
            value += 220
    if action.is_skill(CHARACTER_ID, 3) and insight > 0:
        missing = target.max_hp - target.hp
        fixed = floor_int(missing * (insight * 0.07))
        value += fixed * hit_rate * 3.2
        if expected_damage + fixed * hit_rate >= target.hp:
            value += 3000
        elif insight < 3:
            value -= 300
    return value
