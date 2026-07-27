"""Gandrick battle and AI hooks."""

from __future__ import annotations

from typing import Any


CHARACTER_ID = "gandrick"
HIDDEN_COUNTERS = {"탄환형태"}


def init_unique_state(fighter: Any, unique_names: set[str]) -> None:
    if "탄환" in unique_names:
        fighter.counters["탄환"] = 6
        fighter.counters["탄환형태"] = None


def extra_state_parts(battle: Any, fighter: Any) -> list[str]:
    return [f"{fighter.counters['탄환형태']} 형태"] if fighter.counters.get("탄환형태") else []


def setup_value(battle: Any, actor: Any, target: Any, action: Any) -> float:
    if not action.is_skill(CHARACTER_ID, 1):
        return 0.0
    bullets = int(actor.counters.get("탄환", 0))
    if bullets <= 0:
        return 1200
    if bullets <= 2:
        return 400
    return 0.0


def on_make_choice(battle: Any, fighter: Any, action: Any, choice: Any) -> None:
    if action.is_skill(CHARACTER_ID, 3):
        choice.selected_bullets = int(fighter.counters.get("탄환", 0))
    if action.is_attack and 1 <= battle.turn <= 5:
        fighter.attack_selection_count_1_to_5 += 1


def modify_cost(battle: Any, fighter: Any, action: Any, cost: int) -> int:
    if action.is_skill(CHARACTER_ID, 3):
        if fighter.counters.get("탄환형태") == "철의 탄환" and fighter.counters.get("탄환", 0) == 6:
            cost -= 8
    return cost


def on_action_start(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    action = choice.action
    if not action.is_attack:
        return False
    bullets = int(actor.counters.get("탄환", 0))
    if bullets <= 0:
        print("탄환이 0중첩이라 공격 행동에 실패했다.")
        return True
    actor.counters["탄환"] = bullets - 1
    print(f"탄환 1중첩 소모: {bullets} → {bullets - 1}")
    return False


def modify_accuracy_actor_after_target(battle: Any, choice: Any, target: Any, accuracy: float) -> float:
    actor = choice.actor
    if choice.action.is_skill(CHARACTER_ID, 2):
        if actor.counters.get("탄환형태") == "마의 탄환":
            accuracy += 20
    return accuracy


def apply_condition_effects(battle: Any, choice: Any) -> bool | None:
    actor = choice.actor
    action = choice.action
    if action.is_skill(CHARACTER_ID, 0):
        if actor.counters.get("탄환형태") == "철의 탄환":
            roll = battle.roll("정밀 사격 탄환")
            print(f"탄환 회수 판정 20% / 판정값 {roll:.2f}")
            if roll < 20:
                battle.add_counter(actor, "탄환", 1, max_value=6)
    if action.is_skill(CHARACTER_ID, 3):
        bullets = choice.selected_bullets if choice.selected_bullets is not None else int(actor.counters.get("탄환", 0))
        choice.hit_count = battle.rng.randint(1, max(1, bullets))
        print(f"[연격] 선택 시 탄환 {bullets}중첩, {choice.hit_count}회로 결정되었다.")
    return None


def attack_damage_multipliers(battle: Any, choice: Any) -> list[float]:
    actor = choice.actor
    action = choice.action
    multipliers: list[float] = []
    bullet_mult = 1.2
    if actor.counters.get("탄환형태") == "마의 탄환":
        bullet_mult = 1.2 + ((6 - int(actor.counters.get("탄환", 0))) * 0.1)
    multipliers.append(bullet_mult)
    if action.is_skill(CHARACTER_ID, 0):
        chance = 20
        if actor.counters.get("탄환형태") == "마의 탄환":
            chance += 30
        if actor.counters.get("탄환형태") != "철의 탄환":
            roll = battle.roll("정밀 사격 치명")
            print(f"정밀 사격 피해 증폭 {chance}% / 판정값 {roll:.2f}")
            if roll < chance:
                multipliers.append(1.5)
    if action.is_skill(CHARACTER_ID, 3):
        if actor.counters.get("탄환형태") == "마의 탄환" and choice.selected_bullets == 1:
            multipliers.append(7.0)
    return multipliers


def target_damage_multipliers(battle: Any, choice: Any, target: Any) -> list[float]:
    if target.counters.get("탄환형태") == "철의 탄환":
        return [max(0, 1 - int(target.counters.get("탄환", 0)) * 0.05)]
    return []


def estimated_hit_count(actor: Any, action: Any, use_max: bool) -> float | None:
    if not action.is_skill(CHARACTER_ID, 3):
        return None
    bullets = int(actor.counters.get("탄환", 0))
    return max(1, bullets) if use_max else (1 + max(1, bullets)) / 2


def estimated_damage_multipliers(battle: Any, actor: Any, target: Any, action: Any) -> list[float]:
    return [1.2] if action.is_attack else []


def on_hit_after_defense(battle: Any, choice: Any, total_damage: int) -> None:
    actor = choice.actor
    target = battle.opponent(actor)
    action = choice.action
    if action.is_skill(CHARACTER_ID, 2):
        battle.add_stat_effect(target, "def", 0.7, 3, action.name)
        if actor.counters.get("탄환형태") == "철의 탄환":
            battle.add_stat_effect(target, "atk", 0.7, 3, action.name)
    elif action.is_skill(CHARACTER_ID, 3):
        if not (actor.counters.get("탄환형태") == "철의 탄환" and choice.selected_bullets == 6):
            actor.counters["탄환"] = 0
            print("탄환을 모두 소모했다.")


def apply_non_attack_effects(battle: Any, choice: Any) -> bool:
    actor = choice.actor
    target = battle.opponent(actor)
    if not choice.action.is_skill(CHARACTER_ID, 1):
        return False
    form = actor.counters.get("탄환형태")
    if form == "마의 탄환":
        battle.add_counter(actor, "탄환", 2, max_value=6)
        battle.fixed_damage(target, 4, "재장전")
    elif form == "철의 탄환":
        battle.add_counter(actor, "탄환", 4, max_value=6)
    else:
        battle.add_counter(actor, "탄환", 3, max_value=6)
    return True


def on_turn_end(battle: Any, fighter: Any) -> None:
    if battle.turn == 5 and fighter.counters.get("탄환형태") is None:
        if fighter.attack_selection_count_1_to_5 >= 4:
            fighter.counters["탄환형태"] = "마의 탄환"
        else:
            fighter.counters["탄환형태"] = "철의 탄환"
        print(f"{fighter.name}은 {fighter.counters['탄환형태']} 형태로 변신했다.")
    form = fighter.counters.get("탄환형태")
    if form == "마의 탄환":
        battle.fixed_damage(fighter, 6 - int(fighter.counters.get("탄환", 0)), "마의 탄환")
    elif form == "철의 탄환":
        battle.heal(fighter, int(fighter.counters.get("탄환", 0)), "철의 탄환")


def would_condition_fail(battle: Any, actor: Any, target: Any, action: Any) -> bool | None:
    if action.is_attack:
        return int(actor.counters.get("탄환", 0)) <= 0
    return None


def ai_score(
    battle: Any,
    actor: Any,
    target: Any,
    action: Any,
    expected_damage: float,
    hit_rate: float,
) -> float:
    value = 0.0
    bullets = int(actor.counters.get("탄환", 0))
    form = actor.counters.get("탄환형태")

    if form is None and battle.turn <= 5:
        attacks = actor.attack_selection_count_1_to_5
        if action.is_attack:
            if attacks >= 3:
                value -= 8200
            elif attacks == 2 and battle.turn >= 4:
                value -= 1200
        else:
            if attacks >= 3:
                value += 2600
            elif attacks == 2 and battle.turn >= 4:
                value += 900
            if action.is_skill(CHARACTER_ID, 1):
                value += 260

    if form == "철의 탄환":
        if action.is_skill(CHARACTER_ID, 1):
            value += max(0, 6 - bullets) * 110
        if action.is_skill(CHARACTER_ID, 2):
            value += 180
        if action.is_skill(CHARACTER_ID, 3) and bullets == 6:
            value += 520
    elif form == "마의 탄환":
        if action.is_skill(CHARACTER_ID, 3) and bullets == 1:
            value += 2200
        if action.is_common_action("meditation") and bullets == 1 and actor.mp < 44:
            value += 700
        if action.is_skill(CHARACTER_ID, 1) and bullets <= 1:
            value += 260

    return value
