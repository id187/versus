"""Librang battle and AI hooks."""

from __future__ import annotations

from typing import Any

from .common import floor_int


CHARACTER_ID = "librang"
BALANCE = "균형"
PRAYER = "평형의 기도"
HIDDEN_COUNTERS = {PRAYER}
JUDGMENT_BASE_PERCENT = 25
JUDGMENT_RESERVE_MP = 50


def init_unique_state(fighter: Any, unique_names: set[str]) -> None:
    if BALANCE in unique_names:
        fighter.counters[BALANCE] = 0


def counter_state_text(fighter: Any, name: str, value: Any) -> str | None:
    if name == BALANCE:
        return f"{BALANCE} {value}"
    return None


def extra_state_parts(battle: Any, fighter: Any) -> list[str]:
    if int(fighter.counters.get(PRAYER, 0)) <= 0:
        return []
    mult = 1 + _balance(fighter) * 0.2
    return [f"{PRAYER}: 공격 피해 x{mult:g}"]


def needs_battle_log(fighter: Any) -> bool:
    return True


def render_battle_log(battle: Any, fighter: Any, lines: list[str]) -> None:
    opponent = battle.opponent(fighter)
    own_attacks, own_non_attacks = _selected_counts(battle, fighter)
    opp_attacks, opp_non_attacks = _selected_counts(battle, opponent)
    lines.append(f"자신 선택: 공격 {own_attacks} / 비공격 {own_non_attacks}")
    lines.append(f"상대 선택: 공격 {opp_attacks} / 비공격 {opp_non_attacks}")


def counter_resource_value(fighter: Any, name: str, raw: Any) -> float | None:
    if name == BALANCE and isinstance(raw, int):
        return raw * 240
    if name == PRAYER:
        return 180 if int(raw or 0) > 0 else 0.0
    return None


def modify_cost(battle: Any, fighter: Any, action: Any, cost: int) -> int:
    if action.is_skill(CHARACTER_ID, 1):
        cost -= _balance(fighter)
    return cost


def apply_condition_effects(battle: Any, choice: Any) -> bool | None:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0):
        bonus = _balance(actor) * 2
        if bonus > 0:
            choice.power = (choice.power or 0) + bonus
            print(f"{BALANCE} 중첩 수 {_balance(actor)}로 위력이 {bonus} 증가했다.")
    if action.is_skill(CHARACTER_ID, 2) and _balance(actor) < 1:
        return False
    return None


def estimated_power(battle: Any, actor: Any, target: Any, action: Any, power: int) -> int:
    if action.is_skill(CHARACTER_ID, 0):
        power += _balance(actor) * 2
    return power


def attack_damage_multipliers(battle: Any, choice: Any) -> list[float]:
    if choice.action.is_attack and int(choice.actor.counters.get(PRAYER, 0)) > 0:
        return [1 + _balance(choice.actor) * 0.2]
    return []


def estimated_damage_multipliers(battle: Any, actor: Any, target: Any, action: Any) -> list[float]:
    if action.is_attack and int(actor.counters.get(PRAYER, 0)) > 0:
        return [1 + _balance(actor) * 0.2]
    return []


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0):
        attacks, non_attacks = _selected_counts(battle, target)
        extra = max(0, non_attacks - attacks)
        battle.fixed_damage(target, extra, action.name)
    elif action.is_skill(CHARACTER_ID, 3):
        battle.fixed_damage(target, _judgment_fixed_damage(target, _balance(actor)), action.name)


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 1):
        battle.apply_defense(actor, action.name)
        return True
    if action.is_skill(CHARACTER_ID, 2):
        actor.counters[PRAYER] = 2
        mult = 1 + _balance(actor) * 0.2
        print(f"다음 턴 동안 공격 피해가 x{mult:g}가 된다.")
        return True
    return False


def on_defense_hit(battle: Any, choice: Any, total_damage: int) -> None:
    attacker = choice.actor
    defender = battle.opponent(attacker)
    if defender.defense_name != "지킨다는 것의 무거움":
        return
    attacks, non_attacks = _selected_counts(battle, attacker)
    extra = max(0, attacks - non_attacks)
    battle.fixed_damage(attacker, extra, defender.defense_name)


def on_turn_end(battle: Any, fighter: Any) -> None:
    if battle.turn % 2 != 0:
        return
    attacks, non_attacks = _selected_counts(battle, fighter)
    if attacks == non_attacks:
        battle.add_counter(fighter, BALANCE, 1)


def decrement_counters(fighter: Any) -> None:
    if PRAYER not in fighter.counters:
        return
    remaining = int(fighter.counters.get(PRAYER, 0))
    if remaining <= 1:
        fighter.counters.pop(PRAYER, None)
    else:
        fighter.counters[PRAYER] = remaining - 1


def modify_fixed_damage_to_opponent(battle: Any, actor: Any, target: Any, amount: int) -> int:
    bonus = _balance(actor)
    if bonus <= 0 or amount <= 0:
        return amount
    print(f"냉혹한 심판자: 고정 피해가 {bonus} 증가했다.")
    return amount + bonus


def setup_value(battle: Any, actor: Any, target: Any, action: Any) -> float:
    balance = _balance(actor)
    if action.is_skill(CHARACTER_ID, 1):
        incoming = battle.estimate_best_incoming_damage(target, actor)
        attacks, non_attacks = _selected_counts(battle, target)
        punish = max(0, attacks - non_attacks)
        return incoming * 0.25 + punish * 150 + balance * 60
    if action.is_skill(CHARACTER_ID, 2) and balance >= 1:
        if int(actor.counters.get(PRAYER, 0)) > 0:
            return 0.0
        return 560 + balance * 300
    return 0.0


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    value = 0.0
    balance = _balance(actor)
    own_attacks, own_non_attacks = _selected_counts(battle, actor)
    target_attacks, target_non_attacks = _selected_counts(battle, target)
    incoming = battle.estimate_best_incoming_damage(target, actor)

    value += _balance_timing_value(battle, actor, action, own_attacks, own_non_attacks)

    if action.is_skill(CHARACTER_ID, 0):
        extra = max(0, target_non_attacks - target_attacks)
        value += balance * 180 + extra * 260 * hit_rate
        if extra > 0:
            value += 360

    elif action.is_skill(CHARACTER_ID, 1):
        punish = max(0, target_attacks - target_non_attacks)
        incoming_weight = 0.35
        if target_attacks > target_non_attacks or incoming >= actor.hp * 0.75:
            incoming_weight = 0.95
        value += incoming * incoming_weight + punish * 330
        if incoming >= actor.hp:
            value += 2100
        if battle.turn % 2 == 0 and _projected_equal(actor, action, own_attacks, own_non_attacks):
            value += 460

    elif action.is_skill(CHARACTER_ID, 2):
        if balance < 1:
            value -= 3200
        elif int(actor.counters.get(PRAYER, 0)) > 0:
            value -= 900
        else:
            value += 780 + balance * 460
            if actor.mp >= JUDGMENT_RESERVE_MP + action.mp // 2:
                value += 520

    elif action.is_skill(CHARACTER_ID, 3):
        fixed = _judgment_fixed_damage(target, balance) + balance
        value += fixed * 2.8 * hit_rate
        if expected_damage + fixed * hit_rate >= target.hp:
            value += 7200
        elif actor.mp < battle.effective_cost(actor, action) + 18:
            value -= 520
        if int(actor.counters.get(PRAYER, 0)) > 0:
            value += expected_damage * 0.85

    elif action.is_common_action("meditation"):
        if actor.mp < 50:
            value += 360 + max(0, 64 - actor.mp) * 9
        if battle.turn % 2 == 0 and _projected_equal(actor, action, own_attacks, own_non_attacks):
            value += 520
        if actor.mp >= 92:
            value -= 420

    elif action.is_common_action("normal_attack"):
        if balance >= 2 and int(actor.counters.get(PRAYER, 0)) > 0:
            value += expected_damage * 0.7

    return value


def would_condition_fail(battle: Any, actor: Any, target: Any, action: Any) -> bool | None:
    if action.is_skill(CHARACTER_ID, 2):
        return _balance(actor) < 1
    return None


def _balance(fighter: Any) -> int:
    return int(fighter.counters.get(BALANCE, 0))


def _judgment_fixed_damage(target: Any, balance: int) -> int:
    return floor_int(target.hp * (JUDGMENT_BASE_PERCENT + balance * 5) / 100)


def _selected_counts(battle: Any, fighter: Any) -> tuple[int, int]:
    attacks = 0
    non_attacks = 0
    for action_key in fighter.selected_history:
        if battle.action_key_is_attack(fighter, action_key):
            attacks += 1
        else:
            non_attacks += 1
    return attacks, non_attacks


def _projected_counts(action: Any, attacks: int, non_attacks: int) -> tuple[int, int]:
    if action.is_attack:
        return attacks + 1, non_attacks
    return attacks, non_attacks + 1


def _projected_equal(actor: Any, action: Any, attacks: int, non_attacks: int) -> bool:
    projected_attacks, projected_non_attacks = _projected_counts(action, attacks, non_attacks)
    return projected_attacks == projected_non_attacks


def _balance_timing_value(
    battle: Any,
    actor: Any,
    action: Any,
    attacks: int,
    non_attacks: int,
) -> float:
    projected_attacks, projected_non_attacks = _projected_counts(action, attacks, non_attacks)
    current_gap = abs(attacks - non_attacks)
    projected_gap = abs(projected_attacks - projected_non_attacks)
    if current_gap >= 2:
        if projected_gap < current_gap:
            return 920 + (current_gap - projected_gap) * 260
        return -min(1200, (projected_gap - current_gap + 1) * 360)
    if battle.turn % 2 == 0:
        if projected_gap == 0:
            return 760
        if projected_gap <= 2:
            return 640 - projected_gap * 50
        return -min(900, projected_gap * 240)
    if projected_gap < current_gap:
        return 340
    if projected_gap <= 2:
        return 150 - projected_gap * 45
    return -260
