"""Registry for VERSUS character-specific battle and AI hooks."""

from __future__ import annotations

from typing import Any

from . import (
    ashend,
    balef,
    charinel,
    cryne,
    dethus,
    gandrick,
    karossy,
    melague,
    neroko,
    nihfle,
    plote,
    revesha,
    serpen,
    toxiche,
    zeroven,
)


MODULES = (
    toxiche,
    cryne,
    plote,
    ashend,
    karossy,
    nihfle,
    serpen,
    melague,
    balef,
    revesha,
    gandrick,
    charinel,
    dethus,
    zeroven,
    neroko,
)
LOGICS = {module.CHARACTER_ID: module for module in MODULES}
GLOBAL_HIDDEN_COUNTERS = {"고요한 밤"}


def logic_for(fighter_or_id: Any) -> Any | None:
    character_id = fighter_or_id if isinstance(fighter_or_id, str) else fighter_or_id.character_id
    return LOGICS.get(character_id)


def _call(fighter: Any, name: str, *args: Any, default: Any = None) -> Any:
    logic = logic_for(fighter)
    fn = getattr(logic, name, None) if logic else None
    if fn is None:
        return default
    return fn(*args)


def adjust_initial_stats(fighter: Any) -> None:
    _call(fighter, "adjust_initial_stats", fighter)


def init_unique_state(fighter: Any, unique_names: set[str]) -> None:
    _call(fighter, "init_unique_state", fighter, unique_names)


def counter_state_text(fighter: Any, name: str, value: Any) -> tuple[bool, str | None]:
    if name in GLOBAL_HIDDEN_COUNTERS:
        return True, None
    logic = logic_for(fighter)
    if logic is None:
        return False, None
    if name in getattr(logic, "HIDDEN_COUNTERS", set()):
        return True, None
    formatter = getattr(logic, "counter_state_text", None)
    if formatter is None:
        return False, None
    text = formatter(fighter, name, value)
    return (text is not None), text


def extra_state_parts(battle: Any, fighter: Any) -> list[str]:
    parts = list(_call(fighter, "extra_state_parts", battle, fighter, default=[]) or [])
    if fighter.counters.get("고요한 밤", 0) > 0:
        parts.append("고요한 밤")
    return parts


def reset_turn_flags(battle: Any, fighter: Any) -> None:
    _call(fighter, "reset_turn_flags", battle, fighter)


def needs_battle_log(fighter: Any) -> bool:
    return bool(_call(fighter, "needs_battle_log", fighter, default=False))


def render_battle_log(battle: Any, fighter: Any, lines: list[str]) -> None:
    _call(fighter, "render_battle_log", battle, fighter, lines)


def counter_resource_value(fighter: Any, name: str, raw: Any) -> float | None:
    return _call(fighter, "counter_resource_value", fighter, name, raw)


def defense_score_bonus_reduction(actor: Any, action: Any) -> float:
    return float(_call(actor, "defense_score_bonus_reduction", actor, action, default=0.0) or 0.0)


def setup_value(battle: Any, actor: Any, target: Any, action: Any) -> float:
    return float(_call(actor, "setup_value", battle, actor, target, action, default=0.0) or 0.0)


def on_make_choice(battle: Any, fighter: Any, action: Any, choice: Any) -> None:
    _call(fighter, "on_make_choice", battle, fighter, action, choice)


def is_legal_choice(battle: Any, fighter: Any, action: Any) -> bool | None:
    return _call(fighter, "is_legal_choice", battle, fighter, action)


def modify_cost(battle: Any, fighter: Any, action: Any, cost: int) -> int:
    value = _call(fighter, "modify_cost", battle, fighter, action, cost, default=cost)
    return int(value)


def modify_priority(battle: Any, fighter: Any, action: Any, priority: int) -> int:
    value = _call(fighter, "modify_priority", battle, fighter, action, priority, default=priority)
    return int(value)


def on_action_start_before_common(battle: Any, choice: Any) -> bool:
    return serpen.on_action_start_before_common(battle, choice)


def on_action_start_after_paralysis(battle: Any, choice: Any) -> bool:
    return nihfle.on_action_start_after_paralysis(battle, choice)


def on_action_start_after_common(battle: Any, choice: Any) -> bool:
    if plote.on_action_start_status(battle, choice):
        return True
    return bool(_call(choice.actor, "on_action_start", battle, choice, default=False))


def on_active_mp_spent(battle: Any, actor: Any) -> None:
    _call(actor, "on_active_mp_spent", battle, actor)


def modify_accuracy(battle: Any, choice: Any, target: Any, accuracy: float) -> float:
    value = ashend.modify_accuracy_status(battle, choice, target, accuracy)
    value = float(_call(choice.actor, "modify_accuracy_actor_before_target", battle, choice, target, value, default=value))
    value = float(_call(target, "modify_accuracy_target", battle, choice, target, value, default=value))
    value = float(_call(choice.actor, "modify_accuracy_actor_after_target", battle, choice, target, value, default=value))
    return value


def target_evasion(battle: Any, target: Any, choice: Any, evasion: float) -> float:
    return float(_call(target, "target_evasion", battle, target, choice, evasion, default=evasion))


def estimate_target_evasion(battle: Any, target: Any, action: Any, evasion: float) -> float:
    return float(_call(target, "estimate_target_evasion", battle, target, action, evasion, default=evasion))


def apply_condition_effects(battle: Any, choice: Any) -> bool:
    result = _call(choice.actor, "apply_condition_effects", battle, choice)
    return False if result is False else True


def modify_attack_power(battle: Any, choice: Any, power: int) -> int:
    value = _call(choice.actor, "modify_attack_power", battle, choice, power, default=power)
    return int(value)


def attack_damage_multipliers(battle: Any, choice: Any) -> list[float]:
    target = battle.opponent(choice.actor)
    values: list[float] = []
    actor_logic = logic_for(choice.actor)
    actor_fn = getattr(actor_logic, "attack_damage_multipliers", None) if actor_logic else None
    if actor_fn is not None:
        values.extend(actor_fn(battle, choice))
    target_logic = logic_for(target)
    target_fn = getattr(target_logic, "target_damage_multipliers", None) if target_logic else None
    if target_fn is not None:
        values.extend(target_fn(battle, choice, target))
    return values


def on_hit_pre_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor_logic = logic_for(choice.actor)
    actor_fn = getattr(actor_logic, "on_hit_pre_defense_as_actor", None) if actor_logic else None
    if actor_fn is not None:
        actor_fn(battle, choice, total_damage)
        if battle.game_over:
            return
    target = battle.opponent(choice.actor)
    target_logic = logic_for(target)
    target_fn = getattr(target_logic, "on_hit_pre_defense_as_target", None) if target_logic else None
    if target_fn is not None:
        target_fn(battle, choice, total_damage)


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    _call(choice.actor, "on_hit_after_defense", battle, choice, total_damage)


def on_defense_hit(battle: Any, choice: Any, total_damage: int) -> None:
    target = battle.opponent(choice.actor)
    _call(target, "on_defense_hit", battle, choice, total_damage)


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    return bool(_call(choice.actor, "apply_non_attack_effects", battle, choice, default=False))


def on_meditation_effect(battle: Any, choice: Any) -> None:
    _call(choice.actor, "on_meditation_effect", battle, choice)


def finish_action(battle: Any, choice: Any, success: bool, hit: bool, miss_not_failure: bool) -> None:
    _call(choice.actor, "finish_action", battle, choice, success, hit, miss_not_failure)


def turn_end_mp_bonus(fighter: Any) -> int:
    return int(_call(fighter, "turn_end_mp_bonus", fighter, default=0) or 0)


def apply_pre_mp_turn_end(battle: Any, fighter: Any) -> None:
    dethus.pre_mp_turn_end(battle, fighter)


def apply_other_turn_end(battle: Any, fighter: Any) -> None:
    melague.pre_character_turn_end(battle, fighter)
    if battle.game_over:
        return
    _call(fighter, "on_turn_end", battle, fighter)


def decrement_counters(fighter: Any) -> None:
    if fighter.counters.get("고요한 밤", 0) > 0:
        fighter.counters["고요한 밤"] -= 1
    _call(fighter, "decrement_counters", fighter)


def modify_stats(battle: Any, fighter: Any, atk: float, df: float, spd: float) -> tuple[float, float, float]:
    value = _call(fighter, "modify_stats", battle, fighter, atk, df, spd)
    if value is None:
        return atk, df, spd
    return value


def on_fixed_damage_to_opponent(battle: Any, actor: Any, target: Any, amount: int) -> None:
    _call(actor, "on_fixed_damage_to_opponent", battle, actor, target, amount)


def consume_defeat_escape(battle: Any, fighter: Any) -> Any | None:
    return _call(fighter, "consume_defeat_escape", battle, fighter)


def print_defeat_escape(battle: Any, fighter: Any, revive: Any) -> None:
    _call(fighter, "print_defeat_escape", battle, fighter, revive)


def on_damage_taken(battle: Any, target: Any, amount: int, attack: bool, source: Any | None) -> None:
    _call(target, "on_damage_taken", battle, target, amount, attack, source)


def estimated_hit_count(actor: Any, action: Any, use_max: bool) -> float | None:
    return _call(actor, "estimated_hit_count", actor, action, use_max)


def estimated_power(battle: Any, actor: Any, target: Any, action: Any, power: int) -> int:
    value = _call(actor, "estimated_power", battle, actor, target, action, power, default=power)
    return int(value)


def estimated_damage_multipliers(battle: Any, actor: Any, target: Any, action: Any) -> list[float]:
    logic = logic_for(actor)
    fn = getattr(logic, "estimated_damage_multipliers", None) if logic else None
    if fn is None:
        return []
    return list(fn(battle, actor, target, action))


def would_condition_fail(battle: Any, actor: Any, target: Any, action: Any) -> bool:
    result = _call(actor, "would_condition_fail", battle, actor, target, action)
    return bool(result) if result is not None else False


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    return float(_call(actor, "ai_score", battle, actor, target, action, expected_damage, hit_rate, default=0.0) or 0.0)
