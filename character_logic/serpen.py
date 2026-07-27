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
