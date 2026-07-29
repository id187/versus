"""Saqua battle and AI hooks."""

from __future__ import annotations

from typing import Any


CHARACTER_ID = "saqua"
FLOW = "정류"
SERMON_COUNT = "강연사 선택 횟수"
MISSED_ATTACK_TURN = "사쿠아 공격 미명중"
MAX_FLOW = 2
MISS_MP_REFUND_RATE = 0.7
HIDDEN_COUNTERS = {SERMON_COUNT, MISSED_ATTACK_TURN}


def init_unique_state(fighter: Any, unique_names: set[str]) -> None:
    if FLOW in unique_names:
        fighter.counters[FLOW] = 0
        fighter.counters[SERMON_COUNT] = 0
        fighter.counters[MISSED_ATTACK_TURN] = 0


def counter_state_text(fighter: Any, name: str, value: Any) -> str | None:
    if name == FLOW:
        return f"{FLOW} {int(value)}/{MAX_FLOW}"
    return None


def reset_turn_flags(battle: Any, fighter: Any) -> None:
    fighter.counters[MISSED_ATTACK_TURN] = 0


def needs_battle_log(fighter: Any) -> bool:
    return True


def render_battle_log(battle: Any, fighter: Any, lines: list[str]) -> None:
    count = int(fighter.counters.get(SERMON_COUNT, 0))
    lines.append(f"강연사 선택: {count}회")


def counter_resource_value(fighter: Any, name: str, raw: Any) -> float | None:
    if name == FLOW and isinstance(raw, int):
        return raw * 220
    if name == SERMON_COUNT and isinstance(raw, int):
        return min(8, raw) * 42
    return None


def on_make_choice(battle: Any, fighter: Any, action: Any, choice: Any) -> None:
    if action.is_skill(CHARACTER_ID, 2):
        fighter.counters[SERMON_COUNT] = int(fighter.counters.get(SERMON_COUNT, 0)) + 1


def modify_accuracy_actor_after_target(battle: Any, choice: Any, target: Any, accuracy: float) -> float:
    actor = choice.actor
    if not choice.action.is_attack:
        return accuracy
    flow = int(actor.counters.get(FLOW, 0))
    if flow < MAX_FLOW:
        return accuracy
    actor.counters[FLOW] = 0
    choice.guaranteed_hit = True
    if _is_real_fighter(battle, actor):
        print(f"{FLOW} {flow}/{MAX_FLOW}를 모두 소모해 명중 판정을 통과한다.")
    return 100.0


def attack_damage_multipliers(battle: Any, choice: Any) -> list[float]:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 2):
        return [1 + max(0, int(actor.counters.get(SERMON_COUNT, 0)) - 1) * 0.1]
    if action.is_skill(CHARACTER_ID, 3) and int(actor.counters.get(FLOW, 0)) == 0:
        return [1.2]
    return []


def estimated_damage_multipliers(battle: Any, actor: Any, target: Any, action: Any) -> list[float]:
    if action.is_skill(CHARACTER_ID, 2):
        count = int(actor.counters.get(SERMON_COUNT, 0)) + 1
        return [1 + max(0, count - 1) * 0.1]
    if action.is_skill(CHARACTER_ID, 3) and _flow_after_hit_check(actor, action) == 0:
        return [1.2]
    return []


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0) and int(actor.counters.get(FLOW, 0)) == 0:
        battle.heal(actor, int(total_damage * 0.5), action.name)
    if action.is_skill(CHARACTER_ID, 3):
        battle.add_stat_effect(target, "def", 0.5, 4, action.name)
        battle.add_stat_effect(target, "spd", 0.5, 4, action.name)


def on_defense_hit(battle: Any, choice: Any, total_damage: int) -> None:
    defender = battle.opponent(choice.actor)
    if defender.character_id == CHARACTER_ID and defender.defense_name == "흐르는 수막":
        battle.add_counter(defender, FLOW, 2, max_value=MAX_FLOW)


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    if not choice.action.is_skill(CHARACTER_ID, 1):
        return False
    battle.apply_defense(choice.actor, choice.action.name)
    return True


def finish_action(battle: Any, choice: Any, success: bool, hit: bool, miss_not_failure: bool) -> None:
    if not choice.action.is_attack:
        return
    if success and hit:
        return
    choice.actor.counters[MISSED_ATTACK_TURN] = 1
    battle.add_counter(choice.actor, FLOW, 1, max_value=MAX_FLOW)


def on_turn_end(battle: Any, fighter: Any) -> None:
    if int(fighter.counters.get(MISSED_ATTACK_TURN, 0)) > 0:
        spent = int(battle.record.active_attack_mp_spent.get(fighter.side, 0))
        refund = int(spent * MISS_MP_REFUND_RATE)
        if refund > 0:
            battle.restore_mp(fighter, refund, "물은 돌아온다")


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    value = 0.0
    flow = int(actor.counters.get(FLOW, 0))
    sermon_count = int(actor.counters.get(SERMON_COUNT, 0))
    incoming = battle.estimate_best_incoming_damage(target, actor)
    attack_read = battle.recent_kind_counts(target)["attack"]
    guaranteed = flow >= MAX_FLOW and action.is_attack

    if action.is_attack and action.is_active and flow < MAX_FLOW:
        value += (1 - hit_rate) * action.mp * MISS_MP_REFUND_RATE * 8

    if action.is_common_action("normal_attack"):
        value -= 520 if guaranteed else 140
        if flow < MAX_FLOW:
            value += (1 - hit_rate) * 180

    if action.is_skill(CHARACTER_ID, 0):
        if _flow_after_hit_check(actor, action) == 0:
            value += min(actor.max_hp - actor.hp, expected_damage * 0.5) * 2.2
        if flow == 0:
            value += 180
        elif flow == 1:
            value += 520
        if flow < MAX_FLOW:
            value += (1 - hit_rate) * 260
        if guaranteed:
            value -= 220

    elif action.is_skill(CHARACTER_ID, 1):
        if incoming <= 0:
            value -= 520
        else:
            value += min(incoming, actor.hp) * 1.0
            if flow < MAX_FLOW:
                value += (MAX_FLOW - flow) * 260
            value += attack_read * 520
            if attack_read <= 0 and incoming < actor.hp * 0.45:
                value -= 700
            if incoming >= actor.hp * 0.55:
                value += 700
            if incoming >= actor.hp:
                value += 1500
        if actor.mp < 45 and incoming < actor.hp * 0.55:
            value -= 420

    elif action.is_skill(CHARACTER_ID, 2):
        value += min(8, sermon_count) * 170
        if sermon_count <= 1:
            value += 280
        if guaranteed:
            value += 820
        elif flow == 1:
            value += 420
        elif flow == 0 and sermon_count < 3:
            value += 180
        if expected_damage >= target.hp:
            value += 2400

    elif action.is_skill(CHARACTER_ID, 3):
        if guaranteed:
            value += 3000
        elif flow == 1:
            value += 160
            if actor.mp < 70 and expected_damage < target.hp * 0.65:
                value -= 720
        else:
            value -= 720
        if _flow_after_hit_check(actor, action) == 0:
            value += expected_damage * 0.6
        value += hit_rate * 920
        if _has_stat_effect(target, "def", action.name) and _has_stat_effect(target, "spd", action.name):
            value -= 1100
        if target.hp <= expected_damage:
            value += 2800

    if action.is_common_action("meditation") and actor.mp >= 80:
        value -= 550
    if guaranteed and action.is_attack and not action.is_skill(CHARACTER_ID, 3):
        value -= 120

    return value


def _flow_after_hit_check(actor: Any, action: Any) -> int:
    flow = int(actor.counters.get(FLOW, 0))
    if action.is_attack and flow >= MAX_FLOW:
        return 0
    return flow


def _has_stat_effect(fighter: Any, stat: str, source: str) -> bool:
    return any(
        getattr(effect, "stat", None) == stat
        and getattr(effect, "source", None) == source
        and int(getattr(effect, "remaining", 0)) > 0
        for effect in getattr(fighter, "stat_effects", [])
    )


def _is_real_fighter(battle: Any, fighter: Any) -> bool:
    return fighter is getattr(battle, "player", None) or fighter is getattr(battle, "ai", None)
