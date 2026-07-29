"""Serpen battle and AI hooks."""

from __future__ import annotations

from typing import Any

from .common import PHASES, PHASE_MULT, floor_int


CHARACTER_ID = "serpen"


def init_unique_state(fighter: Any, unique_names: set[str]) -> None:
    if "위상" in unique_names:
        fighter.counters["위상"] = "삭월"


def counter_state_text(fighter: Any, name: str, value: Any) -> str | None:
    if name == "위상":
        return f"{name} {value}"
    return None


def extra_state_parts(battle: Any, fighter: Any) -> list[str]:
    return []


def modify_stats(battle: Any, fighter: Any, atk: float, df: float, spd: float) -> tuple[float, float, float]:
    phase = fighter.counters.get("위상", "삭월")
    mult = PHASE_MULT.get(phase, 1.0)
    return atk * mult, df * mult, spd


def on_action_start_before_common(battle: Any, choice: Any) -> bool:
    if choice.actor.counters.get("고요한 밤", 0) > 0:
        print("고요한 밤 효과로 행동 개시 시 실패했다.")
        return True
    return False


def attack_damage_multipliers(battle: Any, choice: Any) -> list[float]:
    if choice.action.is_skill(CHARACTER_ID, 3):
        return [PHASE_MULT.get(choice.actor.counters.get("위상", "삭월"), 1.0)]
    return []


def estimated_damage_multipliers(battle: Any, actor: Any, target: Any, action: Any) -> list[float]:
    if action.is_skill(CHARACTER_ID, 3):
        return [PHASE_MULT.get(actor.counters.get("위상", "삭월"), 1.0)]
    return []


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0):
        if actor.counters.get("위상") in {"초승", "상현"}:
            battle.heal(actor, floor_int((actor.max_hp - actor.hp) * 0.1), "차오르는 궤적")
    elif action.is_skill(CHARACTER_ID, 2):
        if actor.counters.get("위상") in {"하현", "그믐"}:
            battle.fixed_damage(target, floor_int((target.max_hp - target.hp) * 0.1), "기우는 도려내기")


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    if not choice.action.is_skill(CHARACTER_ID, 1):
        return False
    phase = actor.counters.get("위상", "삭월")
    actor.counters["위상"] = PHASES[(PHASES.index(phase) + 2) % len(PHASES)]
    print(f"위상이 {actor.counters['위상']}으로 변경되었다.")
    return True


def on_turn_end(battle: Any, fighter: Any) -> None:
    opponent = battle.opponent(fighter)
    if (
        battle.record.selected_key.get(fighter.side) == battle.common_action_key("defense")
        and battle.record.action_success.get(fighter.side)
        and battle.record.defense_reduced.get(fighter.side, 0) >= 1
    ):
        fighter.counters["고요한 밤"] = 2
        opponent.counters["고요한 밤"] = 2
        print("고요한 밤이 다음 턴 동안 양측에게 적용된다.")
    phase = fighter.counters.get("위상", "삭월")
    fighter.counters["위상"] = PHASES[(PHASES.index(phase) + 1) % len(PHASES)]
    print(f"{fighter.name}의 위상이 {fighter.counters['위상']}으로 변경되었다.")


def decrement_counters(fighter: Any) -> None:
    return None


def _phase(actor: Any) -> str:
    return actor.counters.get("위상", "삭월")


def _defense_read(battle: Any, actor: Any, target: Any, expected_damage: float) -> float:
    counts = battle.recent_kind_counts(target)
    value = counts["defense"] * 1.35 + counts["meditation"] * 0.35
    if expected_damage >= target.hp * 0.8:
        value += 1.2
    if expected_damage >= target.hp:
        value += 1.0
    if target.defense_streak >= 2:
        value -= 0.8
    return max(0.0, value)


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    phase = _phase(actor)
    incoming = battle.estimate_best_incoming_damage(target, actor)
    missing_hp = max(0, actor.max_hp - actor.hp)
    target_missing_hp = max(0, target.max_hp - target.hp)
    defense_read = _defense_read(battle, actor, target, expected_damage)
    value = 0.0

    if action.is_skill(CHARACTER_ID, 0):
        if phase in {"초승", "상현"}:
            value += 360 + floor_int(missing_hp * 0.1) * 95
            if actor.hp <= incoming * 1.45:
                value += 420
        elif phase == "삭월":
            value -= 220

    elif action.is_skill(CHARACTER_ID, 1):
        if phase == "삭월":
            value += 1850
            if actor.mp >= 48:
                value += 520
            if target.hp <= battle.estimate_best_incoming_damage(actor, target):
                value -= 950
        elif phase == "그믐":
            value += 760
            if actor.mp >= 60:
                value += 280
        elif phase in {"상현", "만월"}:
            value -= 1800
        elif phase == "초승":
            value -= 520
        else:
            value -= 900
        if incoming >= actor.hp:
            value -= 2200
        elif incoming >= actor.hp * 0.65:
            value -= 700

    elif action.is_skill(CHARACTER_ID, 2):
        if phase in {"하현", "그믐"}:
            bonus_damage = floor_int(target_missing_hp * 0.1)
            value += 360 + bonus_damage * 120
            if expected_damage + bonus_damage >= target.hp:
                value += 2400
        elif phase == "만월":
            value -= 260

    elif action.is_skill(CHARACTER_ID, 3):
        if phase == "만월":
            value += 2600 + expected_damage * 1.2
            if expected_damage >= target.hp:
                value += 3600
            if defense_read >= 2.2:
                value -= 14000
            elif defense_read >= 1.2:
                value -= 5200
        elif phase in {"상현", "하현"}:
            value += 520 + expected_damage * 0.35
            if actor.mp < 60 and expected_damage < target.hp:
                value -= 380
        else:
            value -= 950

    elif action.is_common_action("meditation"):
        next_phase = PHASES[(PHASES.index(phase) + 1) % len(PHASES)]
        if actor.mp < 39 and next_phase == "만월":
            value += 1250
        elif actor.mp < 39 and phase in {"초승", "상현"}:
            value += 520
        if actor.mp >= 90:
            value -= 520

    if action.is_common_action("normal_attack") and phase == "만월" and actor.mp >= 39:
        value -= 650
    return value
