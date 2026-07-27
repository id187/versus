#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Playable command-line implementation of VERSUS.

The source data stays in dataset/.  This file implements the shared battle
rules plus the character-specific effects from those data files.
"""

from __future__ import annotations

import argparse
import builtins
import contextlib
import copy
import io
import json
import math
import random
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

import character_logic


MAX_MP = 100
START_MP = 30

DEFENSE_MULTIPLIERS = [0.5, 0.6, 0.7, 0.8, 0.9]
DEFENSE_EFFECT_FRAGMENTS = (
    "자신이 이 턴에 입는 공격 피해를 경감",
)

AI_PERSONALITY_TUNING = {
    "R": {"temperature": 35.0, "top_gap": 120.0, "exploration": 0.02, "repeat_penalty": 45.0},
    "C": {"temperature": 60.0, "top_gap": 220.0, "exploration": 0.05, "repeat_penalty": 30.0},
    "D": {"temperature": 30.0, "top_gap": 100.0, "exploration": 0.015, "repeat_penalty": 25.0},
    "G": {"temperature": 110.0, "top_gap": 420.0, "exploration": 0.12, "repeat_penalty": 20.0},
    "E": {"temperature": 55.0, "top_gap": 180.0, "exploration": 0.04, "repeat_penalty": 35.0},
    "J": {"temperature": 85.0, "top_gap": 280.0, "exploration": 0.08, "repeat_penalty": 80.0},
    "A": {"temperature": 65.0, "top_gap": 220.0, "exploration": 0.05, "repeat_penalty": 55.0},
}

AI_SEARCH_TUNING = {
    "R": {"depth": 2, "beam": 4, "responses": 5, "time_limit": 1.25, "discount": 0.68},
    "C": {"depth": 2, "beam": 5, "responses": 4, "time_limit": 1.15, "discount": 0.62},
    "D": {"depth": 2, "beam": 4, "responses": 6, "time_limit": 1.35, "discount": 0.7},
    "G": {"depth": 2, "beam": 5, "responses": 4, "time_limit": 1.2, "discount": 0.64},
    "E": {"depth": 3, "beam": 4, "responses": 5, "time_limit": 2.6, "discount": 0.78},
    "J": {"depth": 2, "beam": 4, "responses": 5, "time_limit": 1.35, "discount": 0.7},
    "A": {"depth": 2, "beam": 4, "responses": 6, "time_limit": 1.45, "discount": 0.7},
}

AI_PERSONALITIES = [
    {"id": "R", "name": "합리"},
    {"id": "C", "name": "돌격"},
    {"id": "D", "name": "방어"},
    {"id": "M", "name": "광기"},
    {"id": "G", "name": "도박"},
    {"id": "E", "name": "인내"},
    {"id": "J", "name": "교란"},
    {"id": "A", "name": "적응"},
]
AI_DATA = {"personalities": AI_PERSONALITIES}


def clamp(value: int | float, low: int | float, high: int | float) -> int | float:
    return max(low, min(high, value))


def floor_int(value: int | float) -> int:
    return math.floor(value)


def pct(value: float) -> str:
    return f"{value:.1f}%"


def stat_text(value: float) -> str:
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.1f}"


def yn(flag: bool) -> str:
    return "성공" if flag else "실패"


def josa_ro(text: str) -> str:
    for char in reversed(text.strip()):
        code = ord(char)
        if 0xAC00 <= code <= 0xD7A3:
            final = (code - 0xAC00) % 28
            return "로" if final in {0, 8} else "으로"
        if char.isalnum():
            return "로"
    return "로"


@dataclass
class Action:
    number: int
    name: str
    target: str
    mp: int
    power: int | None
    accuracy: int | None
    priority: int
    description: str
    common: bool = False
    kind: str = "skill"
    character_id: str | None = None
    slot: int | None = None

    @property
    def is_attack(self) -> bool:
        return self.power is not None

    @property
    def is_active(self) -> bool:
        return not self.common

    @property
    def is_defense(self) -> bool:
        return self.name == "일반 방어" or any(
            fragment in self.description for fragment in DEFENSE_EFFECT_FRAGMENTS
        )

    @property
    def key(self) -> str:
        if self.common:
            return f"common:{self.kind}"
        if self.character_id is not None and self.slot is not None:
            return skill_key(self.character_id, self.slot)
        return self.name

    def is_common_action(self, kind: str) -> bool:
        return self.common and self.kind == kind

    def is_skill(self, character_id: str, slot: int) -> bool:
        return self.character_id == character_id and self.slot == slot


@dataclass
class TimedStatus:
    name: str
    remaining: int
    stacks: int = 1
    source: str = ""

    def copy(self) -> "TimedStatus":
        return TimedStatus(self.name, self.remaining, self.stacks, self.source)


@dataclass
class StatEffect:
    stat: str
    multiplier: float
    remaining: int
    source: str

    def copy(self) -> "StatEffect":
        return StatEffect(self.stat, self.multiplier, self.remaining, self.source)


@dataclass
class CostEffect:
    multiplier: float
    remaining: int
    source: str

    def copy(self) -> "CostEffect":
        return CostEffect(self.multiplier, self.remaining, self.source)


@dataclass
class Choice:
    actor: "Fighter"
    action: Action
    cost: int
    priority: int
    power: int | None = None
    accuracy: int | None = None
    hit_count: int = 1
    selected_bullets: int | None = None
    prev_attack_active: str | None = None
    copied_from: str | None = None
    consumed_mp_extra: int = 0

    @property
    def total_cost(self) -> int:
        return self.cost + self.consumed_mp_extra


@dataclass
class TurnRecord:
    selected: dict[str, str] = field(default_factory=dict)
    selected_key: dict[str, str] = field(default_factory=dict)
    selected_kind: dict[str, str] = field(default_factory=dict)
    action_success: dict[str, bool] = field(default_factory=dict)
    attack_hit: dict[str, bool] = field(default_factory=dict)
    attack_damage_taken: dict[str, int] = field(default_factory=dict)
    active_attack_mp_spent: dict[str, int] = field(default_factory=dict)
    freeze_removed: dict[str, bool] = field(default_factory=dict)
    defense_reduced: dict[str, int] = field(default_factory=dict)
    gained_insight: dict[str, bool] = field(default_factory=dict)


@dataclass
class Fighter:
    side: str
    data: dict[str, Any]
    hp: int = field(init=False)
    mp: int = START_MP
    statuses: dict[str, TimedStatus] = field(default_factory=dict)
    stat_effects: list[StatEffect] = field(default_factory=list)
    cost_effects: list[CostEffect] = field(default_factory=list)
    counters: dict[str, Any] = field(default_factory=dict)
    defense_streak: int = 0
    defense_mult: float | None = None
    defense_name: str | None = None
    evasion_chance: float = 0.0
    guaranteed_evasion: bool = False
    selected_history: list[str] = field(default_factory=list)
    selected_attack_active_history: list[str] = field(default_factory=list)
    hit_records: set[str] = field(default_factory=set)
    last_successful_action_key: str | None = None
    forbidden_action_key: str | None = None
    forbidden_remaining: int = 0
    attack_selection_count_1_to_5: int = 0
    last_meditation_success_turn: int | None = None

    def __post_init__(self) -> None:
        stats = self.data["stats"]
        self.max_hp = int(stats["hp"])
        self.hp = self.max_hp
        self.base_atk = float(stats["atk"])
        self.base_def = float(stats["def"])
        self.base_spd = float(stats["spd"])
        character_logic.adjust_initial_stats(self)
        self.init_unique_state()

    @property
    def name(self) -> str:
        return self.data["name"]

    @property
    def title(self) -> str:
        return self.data["title"]

    @property
    def character_id(self) -> str:
        return str(self.data.get("id", ""))

    @property
    def label(self) -> str:
        return f"{self.name} — {self.title}"

    def init_unique_state(self) -> None:
        unique_names = {item["name"] for item in self.data.get("unique_statuses", [])}
        character_logic.init_unique_state(self, unique_names)

    def has_unique(self, name: str) -> bool:
        return name in {item["name"] for item in self.data.get("unique_statuses", [])}

    def has_passive(self, name: str) -> bool:
        return self.data.get("passive", {}).get("name") == name

    def skill_by_key(self, key: str) -> Action | None:
        for index, skill in enumerate(self.data.get("skills", []), start=4):
            action = action_from_skill(index, skill, self.character_id)
            if action.key == key:
                return action
        return None

    def clone(self) -> "Fighter":
        return copy.deepcopy(self)


class Battle:
    def __init__(
        self,
        characters: list[dict[str, Any]],
        ai_data: dict[str, Any],
        player_index: int,
        ai_index: int,
        personality_id: str,
        rng: random.Random,
        auto_player: bool = False,
        max_turns: int = 200,
        hide_personality_until_game_over: bool = False,
    ) -> None:
        self.characters = characters
        self.ai_data = ai_data
        self.player = Fighter("PLAYER", copy.deepcopy(characters[player_index]))
        self.ai = Fighter("AI", copy.deepcopy(characters[ai_index]))
        self.personality = self.find_personality(personality_id)
        self.rng = rng
        self.turn = 1
        self.record = TurnRecord()
        self.logs: list[str] = []
        self.auto_player = auto_player
        self.max_turns = max_turns
        self.hide_personality_until_game_over = hide_personality_until_game_over
        self.game_over = False
        self.winner: Fighter | None = None
        self.loser: Fighter | None = None
        self.turn_order: dict[str, int] = {}

    def find_personality(self, personality_id: str) -> dict[str, Any]:
        for item in self.ai_data.get("personalities", []):
            if item["id"] == personality_id:
                return item
        raise ValueError(f"Unknown personality id: {personality_id}")

    def visible_personality(self) -> dict[str, str]:
        if self.hide_personality_until_game_over and not self.game_over:
            return {"id": "random", "name": "RANDOM"}
        return {"id": self.personality["id"], "name": self.personality["name"]}

    def skill_key(self, character_id: str, slot: int) -> str:
        return skill_key(character_id, slot)

    def common_action_key(self, kind: str) -> str:
        return common_action_key(kind)

    def kind_is_attack(self, kind: str | None) -> bool:
        return kind_is_attack(kind)

    def opponent(self, fighter: Fighter) -> Fighter:
        return self.ai if fighter is self.player else self.player

    def run(self) -> None:
        self.print_initial_info()
        while not self.game_over and self.turn <= self.max_turns:
            self.start_turn()
            print(self.render_turn_screen())
            player_choice = (
                self.choose_ai_action(self.player, self.ai, {"id": "R", "name": "자동"})
                if self.auto_player
                else self.ask_player_choice()
            )
            ai_choice = self.choose_ai_action(self.ai, self.player, self.personality)
            self.resolve_turn(player_choice, ai_choice)
            self.turn += 1
        if not self.game_over:
            print("최대 턴 수에 도달했습니다. 무승부로 종료합니다.")
            if self.hide_personality_until_game_over:
                print(f"AI 성격: {self.personality['name']}")
        else:
            self.print_game_over()

    def start_turn(self) -> None:
        self.record = TurnRecord()
        self.reset_turn_flags()

    def reset_turn_flags(self) -> None:
        self.turn_order = {}
        for fighter in (self.player, self.ai):
            fighter.defense_mult = None
            fighter.defense_name = None
            fighter.evasion_chance = 0.0
            fighter.guaranteed_evasion = False
            character_logic.reset_turn_flags(self, fighter)
            self.record.attack_damage_taken[fighter.side] = 0
            self.record.freeze_removed[fighter.side] = False
            self.record.defense_reduced[fighter.side] = 0
            self.record.gained_insight[fighter.side] = False

    def print_initial_info(self) -> None:
        print("VERSUS 전투를 시작합니다.")
        print()
        print(self.render_full_info(self.player, "PLAYER"))
        print()
        print(self.render_full_info(self.ai, "AI"))
        print(f"AI 성격: {self.visible_personality()['name']}")
        print()

    def render_full_info(self, fighter: Fighter, heading: str) -> str:
        lines = [f"━━━━━━━━ {heading} 정보 ━━━━━━━━", fighter.label]
        s = fighter.data["stats"]
        lines.append(f"능력치: HP {s['hp']} | ATK {s['atk']} | DEF {s['def']} | SPD {s['spd']}")
        lines.append("고유 상태")
        for status in fighter.data.get("unique_statuses", []):
            lines.append(f"{status['name']}: {status['description']}")
        passive = fighter.data.get("passive")
        if passive:
            lines.append("패시브")
            lines.append(f"{passive['name']}: {passive['description']}")
        lines.append("액티브")
        for index, skill in enumerate(fighter.data.get("skills", []), start=4):
            action = action_from_skill(index, skill)
            lines.append(render_action(action))
            lines.append("")
        return "\n".join(lines).rstrip()

    def render_turn_screen(self) -> str:
        lines = [f"TURN {self.turn}", ""]
        lines.extend(self.render_status_block(self.player))
        lines.append("")
        lines.extend(self.render_status_block(self.ai))
        lines.append(f"AI 성격: {self.visible_personality()['name']}")
        lines.append("")
        lines.append("패시브")
        passive = self.player.data.get("passive")
        if passive:
            lines.append(f"{passive['name']}: {passive['description']}")
        lines.append("")
        if self.needs_battle_log(self.player):
            lines.append(self.render_battle_log(self.player))
            lines.append("")
        lines.append("행동을 선택하세요.")
        for action in available_actions(self.player):
            cost = self.effective_cost(self.player, action)
            priority = self.effective_priority(self.player, action)
            lines.append(render_action(action, cost, priority))
            if not self.is_legal_choice(self.player, action):
                lines.append("사용 불가")
            lines.append("")
        return "\n".join(lines).rstrip()

    def render_status_block(self, fighter: Fighter) -> list[str]:
        atk, df, spd = self.current_stats(fighter)
        lines = [
            fighter.side,
            fighter.label,
            f"HP {fighter.hp}/{fighter.max_hp} | MP {fighter.mp}/{MAX_MP}",
            f"ATK {stat_text(atk)} | DEF {stat_text(df)} | SPD {stat_text(spd)}",
            f"현재 상태: {self.current_state_text(fighter)}",
            f"[방어]: 다음 사용 시 {self.next_defense_reduction_text(fighter)}",
        ]
        return lines

    def current_state_text(self, fighter: Fighter) -> str:
        parts: list[str] = []
        for name, value in fighter.counters.items():
            handled, text = character_logic.counter_state_text(fighter, name, value)
            if handled:
                if text:
                    parts.append(text)
                continue
            parts.append(f"{name} {value}중첩")
        parts.extend(character_logic.extra_state_parts(self, fighter))
        for status in fighter.statuses.values():
            if status.stacks == 1:
                parts.append(f"{status.name} {status.remaining}턴")
            else:
                parts.append(f"{status.name} {status.stacks}중첩 · {status.remaining}턴")
        for effect in fighter.stat_effects:
            parts.append(f"{effect.stat.upper()} x{effect.multiplier:g} · {effect.remaining}턴 ({effect.source})")
        for effect in fighter.cost_effects:
            parts.append(f"액티브 MP x{effect.multiplier:g} · {effect.remaining}턴")
        if fighter.forbidden_action_key and fighter.forbidden_remaining > 0:
            forbidden = self.display_action_name(fighter, fighter.forbidden_action_key)
            parts.append(f"{forbidden} 선택 불가 · {fighter.forbidden_remaining}턴")
        return ", ".join(parts) if parts else "없음"

    def next_defense_reduction_text(self, fighter: Fighter) -> str:
        reduction = defense_reduction_percent_for_streak(fighter.defense_streak + 1)
        return f"{reduction}%"

    def needs_battle_log(self, fighter: Fighter) -> bool:
        return character_logic.needs_battle_log(fighter)

    def render_battle_log(self, fighter: Fighter) -> str:
        lines = ["전투 기록"]
        character_logic.render_battle_log(self, fighter, lines)
        return "\n".join(lines)

    def display_action_name(self, fighter: Fighter, action_key: str | None) -> str:
        if not action_key:
            return ""
        for action in available_actions(fighter):
            if action.key == action_key:
                return action.name
        return action_key

    def ask_player_choice(self) -> Choice:
        while True:
            raw = input("> ").strip()
            action = self.find_action_by_input(self.player, raw)
            if action is None:
                print("존재하지 않는 행동입니다. 번호 또는 행동 이름을 입력하세요.")
                continue
            if not self.is_legal_choice(self.player, action):
                print("현재 MP 또는 규칙상 선택할 수 없습니다.")
                continue
            return self.make_choice(self.player, action)

    def find_action_by_input(self, fighter: Fighter, raw: str) -> Action | None:
        for action in available_actions(fighter):
            if raw == str(action.number) or raw == action.name:
                return action
        return None

    def choose_ai_action(self, actor: Fighter, target: Fighter, personality: dict[str, Any]) -> Choice:
        return self.make_choice(actor, self.select_ai_action(actor, target, personality))

    def select_ai_action(self, actor: Fighter, target: Fighter, personality: dict[str, Any]) -> Action:
        legal = [action for action in available_actions(actor) if self.is_legal_choice(actor, action)]
        if not legal:
            return normal_actions()[0]
        viable = [action for action in legal if not self.would_condition_fail(actor, target, action)]
        if viable:
            legal = viable
        if personality["id"] == "M":
            return self.rng.choice(legal)
        search_tuning = AI_SEARCH_TUNING.get(personality["id"], AI_SEARCH_TUNING["R"])
        deadline = time.perf_counter() + search_tuning["time_limit"]
        scored = [
            (self.score_ai_candidate(actor, target, action, personality, search_tuning, deadline), action)
            for action in legal
        ]
        return self.weighted_personality_choice(scored, personality["id"])

    def score_ai_candidate(
        self,
        actor: Fighter,
        target: Fighter,
        action: Action,
        personality: dict[str, Any],
        search_tuning: dict[str, float],
        deadline: float,
    ) -> float:
        tactical = self.score_action(actor, target, action, personality, add_noise=False)
        search = self.search_action_score(actor, target, action, personality, search_tuning, deadline)
        return search + tactical * 0.18

    def search_action_score(
        self,
        actor: Fighter,
        target: Fighter,
        action: Action,
        personality: dict[str, Any],
        search_tuning: dict[str, float],
        deadline: float,
    ) -> float:
        responses = [candidate for candidate in available_actions(target) if self.is_legal_choice(target, candidate)]
        if not responses:
            responses = [normal_actions()[0]]
        weights = self.response_weights(target, actor, responses)
        outcomes: list[tuple[float, float, Action]] = []
        for response, weight in zip(responses, weights):
            simulation = self.simulate_action_pair(actor.side, action, response)
            value = self.evaluate_simulation(simulation, actor, target, action, response, personality["id"])
            if search_tuning["depth"] > 1 and not simulation.game_over and time.perf_counter() < deadline:
                simulation.turn += 1
                simulation.start_turn()
                future = simulation.lookahead_position_value(
                    actor.side,
                    personality["id"],
                    int(search_tuning["depth"]) - 1,
                    search_tuning,
                    deadline,
                )
                discount = search_tuning["discount"]
                value = value * (1 - discount) + future * discount
            outcomes.append((value, weight, response))

        expected = sum(value * weight for value, weight, _ in outcomes)
        worst = min(value for value, _, _ in outcomes)
        best = max(value for value, _, _ in outcomes)
        likely_value, _, likely_response = max(outcomes, key=lambda item: item[1])
        pid = personality["id"]

        if pid == "D":
            return expected * 0.35 + worst * 0.65
        if pid == "G":
            return expected * 0.35 + best * 0.65
        if pid == "C":
            return expected * 0.7 + best * 0.3 + (180 if action.is_attack else -80)
        if pid == "E":
            return expected * 0.82 + best * 0.12 - action.mp * 0.35
        if pid == "J":
            return expected * 0.65 + likely_value * 0.35 + self.disruption_bonus(action, likely_response)
        if pid == "A":
            return expected + self.adaptive_bonus(actor, target, action) * 1.6
        return expected

    def lookahead_position_value(
        self,
        actor_side: str,
        personality_id: str,
        depth: int,
        search_tuning: dict[str, float],
        deadline: float,
    ) -> float:
        actor = self.fighter_by_side(actor_side)
        target = self.opponent(actor)
        if self.game_over or depth <= 0 or time.perf_counter() >= deadline:
            return self.evaluate_position(actor_side, personality_id)

        legal = [action for action in available_actions(actor) if self.is_legal_choice(actor, action)]
        if not legal:
            legal = [normal_actions()[0]]
        legal = self.prioritized_actions(actor, target, legal, personality_id, int(search_tuning["beam"]))

        values = [
            self.lookahead_action_value(actor_side, action, personality_id, depth, search_tuning, deadline)
            for action in legal
            if time.perf_counter() < deadline
        ]
        if not values:
            return self.evaluate_position(actor_side, personality_id)

        if personality_id == "D":
            return max(values) * 0.78 + min(values) * 0.22
        if personality_id == "G":
            return max(values)
        if personality_id == "E":
            values.sort(reverse=True)
            return values[0] * 0.82 + (sum(values[:3]) / min(3, len(values))) * 0.18
        return max(values)

    def lookahead_action_value(
        self,
        actor_side: str,
        action: Action,
        personality_id: str,
        depth: int,
        search_tuning: dict[str, float],
        deadline: float,
    ) -> float:
        actor = self.fighter_by_side(actor_side)
        target = self.opponent(actor)
        responses = [candidate for candidate in available_actions(target) if self.is_legal_choice(target, candidate)]
        if not responses:
            responses = [normal_actions()[0]]
        responses = self.prioritized_actions(target, actor, responses, "R", int(search_tuning["responses"]))
        weights = self.response_weights(target, actor, responses)

        outcomes: list[float] = []
        for response, weight in zip(responses, weights):
            if time.perf_counter() >= deadline:
                break
            simulation = self.simulate_action_pair(actor_side, action, response)
            immediate = self.evaluate_simulation(simulation, actor, target, action, response, personality_id)
            value = immediate
            if depth > 1 and not simulation.game_over and time.perf_counter() < deadline:
                simulation.turn += 1
                simulation.start_turn()
                future = simulation.lookahead_position_value(
                    actor_side,
                    personality_id,
                    depth - 1,
                    search_tuning,
                    deadline,
                )
                discount = search_tuning["discount"]
                value = immediate * (1 - discount) + future * discount
            outcomes.append(value * weight)

        if not outcomes:
            return self.evaluate_position(actor_side, personality_id)
        value = sum(outcomes)
        if personality_id == "C" and action.is_attack:
            value += 120
        if personality_id == "E" and not action.is_attack:
            value += 90
        return value

    def prioritized_actions(
        self,
        actor: Fighter,
        target: Fighter,
        actions: list[Action],
        personality_id: str,
        limit: int,
    ) -> list[Action]:
        if len(actions) <= limit:
            return actions
        personality = {"id": personality_id, "name": "search"}
        scored = [
            (self.score_action(actor, target, action, personality, add_noise=False), index, action)
            for index, action in enumerate(actions)
        ]
        scored.sort(key=lambda item: item[0], reverse=True)
        return [action for _, _, action in scored[:limit]]

    def response_weights(self, actor: Fighter, target: Fighter, actions: list[Action]) -> list[float]:
        scored = [self.score_action(actor, target, action, {"id": "R", "name": "예측"}, add_noise=False) for action in actions]
        best = max(scored)
        temperature = 95.0
        weights = [math.exp((score - best) / temperature) for score in scored]
        total = sum(weights)
        if total <= 0:
            return [1 / len(actions) for _ in actions]
        return [weight / total for weight in weights]

    def simulate_action_pair(self, actor_side: str, actor_action: Action, target_action: Action) -> "Battle":
        simulation = copy.deepcopy(self)
        sim_actor = simulation.fighter_by_side(actor_side)
        sim_target = simulation.opponent(sim_actor)
        sim_actor_action = simulation.match_action(sim_actor, actor_action)
        sim_target_action = simulation.match_action(sim_target, target_action)
        with contextlib.redirect_stdout(io.StringIO()):
            actor_choice = simulation.make_choice(sim_actor, sim_actor_action)
            target_choice = simulation.make_choice(sim_target, sim_target_action)
            if sim_actor is simulation.player:
                simulation.resolve_turn(actor_choice, target_choice)
            else:
                simulation.resolve_turn(target_choice, actor_choice)
        return simulation

    def fighter_by_side(self, side: str) -> Fighter:
        return self.player if self.player.side == side else self.ai

    def match_action(self, fighter: Fighter, action: Action) -> Action:
        for candidate in available_actions(fighter):
            if candidate.number == action.number and candidate.name == action.name:
                return candidate
        for candidate in available_actions(fighter):
            if candidate.name == action.name:
                return candidate
        return normal_actions()[0]

    def evaluate_simulation(
        self,
        simulation: "Battle",
        actor: Fighter,
        target: Fighter,
        action: Action,
        response: Action,
        personality_id: str,
    ) -> float:
        me = simulation.fighter_by_side(actor.side)
        opponent = simulation.opponent(me)
        if simulation.game_over:
            if simulation.winner and simulation.winner.side == actor.side:
                return 240000 - simulation.turn * 250
            if simulation.loser and simulation.loser.side == actor.side:
                return -240000 + simulation.turn * 250
            return 0

        damage_dealt = max(0, target.hp - opponent.hp)
        damage_taken = max(0, actor.hp - me.hp)
        hp_score = (me.hp / me.max_hp - opponent.hp / opponent.max_hp) * 6200
        mp_score = (me.mp - opponent.mp) * 14
        stat_score = self.stat_advantage_value(simulation, me, opponent)
        status_score = self.status_pressure_value(opponent) - self.status_pressure_value(me) * 1.15
        resource_score = self.resource_value(me) - self.resource_value(opponent) * 0.85
        tempo_score = damage_dealt * 48 - damage_taken * 58
        value = hp_score + mp_score + stat_score + status_score + resource_score + tempo_score

        if personality_id == "C":
            value += damage_dealt * 42 - damage_taken * 18
            value += (opponent.max_hp - opponent.hp) * 12
        elif personality_id == "D":
            value += (me.hp / me.max_hp) * 2600 - damage_taken * 52
            if action.is_defense:
                value += 320
        elif personality_id == "G":
            value += damage_dealt * (70 if action.accuracy is not None and action.accuracy < 90 else 35)
            if action.accuracy is not None and action.accuracy < 85:
                value += 260
        elif personality_id == "E":
            value += me.mp * 18 + self.resource_value(me) * 1.5 + status_score * 0.6
            value += self.future_potential_score(me.side, opponent.side, simulation) * 0.55
        elif personality_id == "J":
            value += self.status_pressure_value(opponent) * 1.8
            value += max(0, target.mp - opponent.mp) * 28
            value += self.disruption_bonus(action, response)
        elif personality_id == "A":
            value += self.matchup_bonus(action_kind(action), action_kind(response)) * 360
        return value

    def evaluate_position(self, actor_side: str, personality_id: str) -> float:
        me = self.fighter_by_side(actor_side)
        opponent = self.opponent(me)
        if self.game_over:
            if self.winner and self.winner.side == actor_side:
                return 240000 - self.turn * 250
            if self.loser and self.loser.side == actor_side:
                return -240000 + self.turn * 250
            return 0.0

        hp_score = (me.hp / me.max_hp - opponent.hp / opponent.max_hp) * 6200
        mp_score = (me.mp - opponent.mp) * 14
        stat_score = self.stat_advantage_value(self, me, opponent)
        status_score = self.status_pressure_value(opponent) - self.status_pressure_value(me) * 1.15
        resource_score = self.resource_value(me) - self.resource_value(opponent) * 0.85
        value = hp_score + mp_score + stat_score + status_score + resource_score

        if personality_id == "C":
            value += (opponent.max_hp - opponent.hp) * 32
            value -= (me.max_hp - me.hp) * 10
        elif personality_id == "D":
            value += (me.hp / me.max_hp) * 2600
            value -= self.estimate_best_incoming_damage(opponent, me) * 42
        elif personality_id == "G":
            value += (opponent.max_hp - opponent.hp) * 18
            value += max(
                (self.estimate_action_damage(me, opponent, action, use_max=True) for action in available_actions(me)),
                default=0,
            ) * 40
        elif personality_id == "E":
            value += me.mp * 24 + self.resource_value(me) * 1.7
            value += self.future_potential_score(me.side, opponent.side, self) * 0.5
        elif personality_id == "J":
            value += self.status_pressure_value(opponent) * 1.9
            value -= self.status_pressure_value(me) * 0.55
        elif personality_id == "A":
            value += self.pattern_read_value(me, opponent) * 320
        return value

    def stat_advantage_value(self, battle: "Battle", me: Fighter, opponent: Fighter) -> float:
        my_atk, my_def, my_spd = battle.current_stats(me)
        op_atk, op_def, op_spd = battle.current_stats(opponent)
        return (my_atk - op_atk) * 10 + (my_def - op_def) * 7 + (my_spd - op_spd) * 4

    def status_pressure_value(self, fighter: Fighter) -> float:
        value = 0.0
        for status in fighter.statuses.values():
            base = 60 + status.remaining * 24 + status.stacks * 36
            if status.name in {"마비", "빙결"}:
                base *= 1.8
            elif status.name in {"화상", "역병", "갈증"}:
                base *= 1.35
            value += base
        return value

    def resource_value(self, fighter: Fighter) -> float:
        value = 0.0
        for name, raw in fighter.counters.items():
            handled = character_logic.counter_resource_value(fighter, name, raw)
            if handled is not None:
                value += handled
                continue
            if isinstance(raw, bool) or raw is None:
                continue
            if isinstance(raw, int):
                mult = 35
                if name in {"탄환", "집광", "과령", "권류", "통찰"}:
                    mult = 70
                value += raw * mult
            elif isinstance(raw, str):
                value += 45
        return value

    def disruption_bonus(self, action: Action, response: Action) -> float:
        bonus = 0.0
        text = action.description
        if any(word in text for word in ("실패", "선택할 수 없다", "MP", "감소", "회피", "상태")):
            bonus += 260
        bonus += self.matchup_bonus(action_kind(action), action_kind(response)) * 180
        return bonus

    def matchup_bonus(self, own_kind: str | None, opponent_kind: str | None) -> float:
        if opponent_kind == "명상" and kind_is_attack(own_kind):
            return 1.0
        if kind_is_attack(opponent_kind) and own_kind == "방어":
            return 1.0
        if opponent_kind == "방어" and own_kind == "명상":
            return 1.0
        return 0.0

    def future_potential_score(
        self,
        actor_side: str,
        target_side: str,
        base: "Battle | None" = None,
    ) -> float:
        future = copy.deepcopy(base or self)
        if future.game_over:
            return 0.0
        future.start_turn()
        actor = future.fighter_by_side(actor_side)
        target = future.fighter_by_side(target_side)
        actor_actions = [action for action in available_actions(actor) if future.is_legal_choice(actor, action)]
        target_actions = [action for action in available_actions(target) if future.is_legal_choice(target, action)]
        actor_best = max(
            (
                future.score_action(actor, target, action, {"id": "E", "name": "미래"}, add_noise=False)
                for action in actor_actions
            ),
            default=0.0,
        )
        target_best = max(
            (
                future.score_action(target, actor, action, {"id": "R", "name": "예측"}, add_noise=False)
                for action in target_actions
            ),
            default=0.0,
        )
        resource_gap = future.resource_value(actor) - future.resource_value(target) * 0.85
        mp_gap = (actor.mp - target.mp) * 14
        status_gap = future.status_pressure_value(target) - future.status_pressure_value(actor)
        return actor_best - target_best * 0.45 + resource_gap * 1.2 + mp_gap + status_gap * 0.6

    def weighted_personality_choice(
        self,
        scored: list[tuple[float, Action]],
        personality_id: str,
    ) -> Action:
        tuning = AI_PERSONALITY_TUNING.get(personality_id, AI_PERSONALITY_TUNING["R"])
        best_score = max(score for score, _ in scored)
        top_gap = tuning["top_gap"]
        candidates = [(score, action) for score, action in scored if best_score - score <= top_gap]
        if len(candidates) == 1:
            return candidates[0][1]
        if self.rng.random() < tuning["exploration"]:
            return self.rng.choice([action for _, action in candidates])

        temperature = max(1.0, tuning["temperature"])
        weights = [math.exp((score - best_score) / temperature) for score, _ in candidates]
        total = sum(weights)
        point = self.rng.random() * total
        upto = 0.0
        for weight, (_, action) in zip(weights, candidates):
            upto += weight
            if point <= upto:
                return action
        return candidates[-1][1]

    def score_action(
        self,
        actor: Fighter,
        target: Fighter,
        action: Action,
        personality: dict[str, Any],
        add_noise: bool = True,
    ) -> float:
        base_damage = self.estimate_action_damage(actor, target, action, use_max=False)
        max_damage = self.estimate_action_damage(actor, target, action, use_max=True)
        hit_rate = self.estimate_hit_rate(actor, target, action)
        expected_damage = base_damage * hit_rate
        condition_fails = self.would_condition_fail(actor, target, action)
        score = expected_damage * 3

        if not condition_fails and max_damage >= target.hp and action.is_attack:
            score += 10000 + (max_damage - target.hp)
        elif not condition_fails and expected_damage >= target.hp and action.is_attack:
            score += 7000

        if action.is_defense:
            incoming = self.estimate_best_incoming_damage(target, actor)
            mult = defense_multiplier_for_streak(actor.defense_streak + 1)
            bonus_reduction = character_logic.defense_score_bonus_reduction(actor, action)
            if bonus_reduction:
                mult = defense_multiplier_for_streak(actor.defense_streak + 1, bonus_reduction=bonus_reduction)
            prevented = incoming * (1 - mult)
            score += prevented * 1.8
            if actor.hp <= incoming and actor.hp > incoming * mult:
                score += 2500

        if action.is_common_action("meditation"):
            missing_mp = MAX_MP - actor.mp
            score += min(15, missing_mp) * 8
            if actor.mp < 40:
                score += 80

        if not action.is_attack and action.is_active:
            score += self.setup_value(actor, target, action)

        if "마비" in action.description or "빙결" in action.description or "회진" in action.description:
            score += 120 * hit_rate
        if "ATK" in action.description or "DEF" in action.description or "SPD" in action.description:
            score += 80
        if action.is_defense and action.is_active:
            score += 60
        if "[연격]" in action.description:
            score += max_damage * 0.5
        if "고정 피해" in action.description:
            score += 70
        score += self.character_ai_bonus(actor, target, action, expected_damage, hit_rate)

        cost = self.effective_cost(actor, action)
        score -= cost * 1.2
        if cost > actor.mp:
            score -= 9999
        if condition_fails:
            score -= 12000
        score -= self.repetition_penalty(actor, action, personality["id"])

        pid = personality["id"]
        if pid == "C":
            score += expected_damage * 1.4 + max_damage
            if action.is_attack:
                score += 120
        elif pid == "D":
            if actor.hp < actor.max_hp * 0.45:
                if action.is_defense or "회복" in action.description or action.is_common_action("meditation"):
                    score += 350
            score -= cost * 0.4
        elif pid == "G":
            score += max_damage * 2.0
            if action.accuracy is not None and action.accuracy < 85:
                score += 160
        elif pid == "E":
            if not action.is_attack:
                score += 230
            if any(word in action.description for word in ("중첩", "4턴", "3턴", "MP")):
                score += 160
        elif pid == "J":
            if any(word in action.description for word in ("실패", "선택할 수 없", "회피", "감소", "상태")):
                score += 260
        elif pid == "A":
            score += self.adaptive_bonus(actor, target, action)

        if add_noise:
            score += self.rng.random() * 0.01
        return score

    def character_ai_bonus(
        self,
        actor: Fighter,
        target: Fighter,
        action: Action,
        expected_damage: float,
        hit_rate: float,
    ) -> float:
        return character_logic.ai_score(self, actor, target, action, expected_damage, hit_rate)

    def recent_kind_counts(self, fighter: Fighter, limit: int = 4) -> dict[str, int]:
        counts = {"attack": 0, "defense": 0, "meditation": 0}
        history = fighter.selected_history
        if fighter.side in self.record.selected:
            history = history[:-1]
        for action_key in history[-limit:]:
            if action_key == common_action_key("meditation"):
                counts["meditation"] += 1
            elif self.action_key_is_defense(fighter, action_key):
                counts["defense"] += 1
            elif self.action_key_is_attack(fighter, action_key):
                counts["attack"] += 1
        return counts

    def repetition_penalty(self, actor: Fighter, action: Action, personality_id: str) -> float:
        history = actor.selected_history
        if not history:
            return 0.0
        streak = 0
        action_key = action.key
        for previous in reversed(history):
            if previous != action_key:
                break
            streak += 1
        if streak == 0:
            return 0.0

        tuning = AI_PERSONALITY_TUNING.get(personality_id, AI_PERSONALITY_TUNING["R"])
        penalty = tuning["repeat_penalty"] * (1 + (streak - 1) * 1.4)
        if personality_id == "D" and action.is_defense:
            penalty *= 0.45
        if personality_id == "C" and action.is_attack:
            penalty *= 0.65
        if personality_id == "E" and any(word in action.description for word in ("중첩", "4턴", "3턴", "MP")):
            penalty *= 0.55
        if personality_id == "J":
            penalty *= 1.25
        if action.is_common_action("meditation") and actor.mp >= 70:
            penalty *= 1.8
        return penalty

    def setup_value(self, actor: Fighter, target: Fighter, action: Action) -> float:
        value = 0.0
        desc = action.description
        if "ATK" in desc:
            value += 120
        if "DEF" in desc:
            value += 70
        if "SPD" in desc or "우선도" in desc:
            value += 80
        if "회복" in desc:
            value += 70
        if "중첩" in desc:
            value += 90
        value += character_logic.setup_value(self, actor, target, action)
        if target.hp < self.estimate_best_incoming_damage(actor, target):
            value -= 150
        return value

    def adaptive_bonus(self, actor: Fighter, target: Fighter, action: Action) -> float:
        if not target.selected_history:
            return 0.0
        history = target.selected_history
        if target.side in self.record.selected:
            history = history[:-1]
        recent = history[-3:]
        attacks = sum(1 for action_key in recent if self.action_key_is_attack(target, action_key))
        defenses = sum(1 for action_key in recent if self.action_key_is_defense(target, action_key))
        meditations = recent.count(common_action_key("meditation"))
        bonus = 0.0
        if attacks >= 2 and action.is_defense:
            bonus += 350
        if defenses >= 2 and (action.is_defense or action.priority >= 1):
            bonus += 120
        if meditations >= 1 and action.is_attack:
            bonus += 180
        return bonus

    def pattern_read_value(self, actor: Fighter, target: Fighter) -> float:
        if not target.selected_history:
            return 0.0
        recent = target.selected_history[-4:]
        attacks = sum(1 for action_key in recent if self.action_key_is_attack(target, action_key))
        defenses = sum(1 for action_key in recent if self.action_key_is_defense(target, action_key))
        repeats = 0
        for previous, current in zip(recent, recent[1:]):
            if previous == current:
                repeats += 1
        value = attacks * 0.35 + defenses * 0.18 + repeats * 0.45
        if actor.selected_history and target.selected_history[-1:] == actor.selected_history[-1:]:
            value -= 0.15
        return value

    def action_key_is_attack(self, fighter: Fighter, action_key: str) -> bool:
        action = next((a for a in available_actions(fighter) if a.key == action_key), None)
        return bool(action and action.is_attack)

    def action_key_is_defense(self, fighter: Fighter, action_key: str) -> bool:
        action = next((a for a in available_actions(fighter) if a.key == action_key), None)
        return bool(action and action.is_defense)

    def make_choice(self, fighter: Fighter, action: Action) -> Choice:
        cost = self.effective_cost(fighter, action)
        priority = self.effective_priority(fighter, action)
        choice = Choice(fighter, action, cost, priority, action.power, action.accuracy)
        character_logic.on_make_choice(self, fighter, action, choice)
        self.record.selected[fighter.side] = action.name
        self.record.selected_key[fighter.side] = action.key
        self.record.selected_kind[fighter.side] = action_kind(action)
        fighter.selected_history.append(action.key)
        return choice

    def is_legal_choice(self, fighter: Fighter, action: Action) -> bool:
        if fighter.forbidden_action_key == action.key and fighter.forbidden_remaining > 0:
            return False
        character_result = character_logic.is_legal_choice(self, fighter, action)
        if character_result is not None:
            return character_result
        return fighter.mp >= self.effective_cost(fighter, action)

    def effective_cost(self, fighter: Fighter, action: Action) -> int:
        cost = int(action.mp)
        if action.is_active:
            cost = character_logic.modify_cost(self, fighter, action, cost)
            for effect in fighter.cost_effects:
                cost = floor_int(cost * effect.multiplier)
        return max(0, cost)

    def effective_priority(self, fighter: Fighter, action: Action) -> int:
        priority = int(action.priority)
        return character_logic.modify_priority(self, fighter, action, priority)

    def resolve_turn(self, player_choice: Choice, ai_choice: Choice) -> None:
        order = self.action_order(player_choice, ai_choice)
        for index, choice in enumerate(order):
            if self.game_over:
                break
            self.turn_order[choice.actor.side] = index
            self.execute_action(choice)
        if not self.game_over:
            self.end_turn()

    def action_order(self, a: Choice, b: Choice) -> list[Choice]:
        if a.priority != b.priority:
            first, second = (a, b) if a.priority > b.priority else (b, a)
            return [first, second]
        a_spd = self.current_stats(a.actor)[2]
        b_spd = self.current_stats(b.actor)[2]
        total = a_spd + b_spd
        a_prob = 50.0 if total <= 0 else a_spd / total * 100
        roll = self.roll("turn order")
        if roll < a_prob:
            return [a, b]
        return [b, a]

    def execute_action(self, choice: Choice, depth: int = 0) -> None:
        actor = choice.actor
        target = self.opponent(actor)
        action = choice.action
        if actor.hp <= 0:
            return
        print()
        print(f"[{actor.name}의 행동]")
        print(f"{actor.name}은 {action.name}을 사용했다.")

        failed_pre_mp = self.apply_action_start_effects(choice)
        if failed_pre_mp:
            self.finish_action(choice, success=False, hit=False)
            return
        if actor.mp < choice.cost:
            print(f"MP 부족으로 행동에 실패했다. MP {actor.mp}/{choice.cost}")
            self.finish_action(choice, success=False, hit=False)
            return
        before_mp = actor.mp
        actor.mp -= choice.cost
        if choice.cost:
            print(f"MP {before_mp} → {actor.mp}")
        if action.is_active and choice.cost > 0:
            if action.is_attack:
                self.record.active_attack_mp_spent[actor.side] = choice.cost
            self.on_active_mp_spent(actor)

        hit = True
        if action.accuracy is not None:
            hit = self.accuracy_check(choice)
            if not hit:
                self.finish_action(choice, success=False, hit=False, miss_not_failure=True)
                return

        condition_ok = self.apply_condition_effects(choice)
        if not condition_ok:
            print("→ 조건을 만족하지 못해 행동이 실패했다.")
            self.finish_action(choice, success=False, hit=hit)
            return

        if action.is_attack:
            total_damage = self.apply_attack_damage(choice)
            if self.game_over:
                return
            self.apply_on_hit_effects(choice, total_damage)
            if self.game_over:
                return
            self.finish_action(choice, success=True, hit=True)
        else:
            self.apply_non_attack_effects(choice)
            if self.game_over:
                return
            self.finish_action(choice, success=True, hit=hit)

    def apply_action_start_effects(self, choice: Choice) -> bool:
        actor = choice.actor
        action = choice.action

        if character_logic.on_action_start_before_common(self, choice):
            return True

        if "마비" in actor.statuses:
            roll = self.roll("마비")
            print(f"마비 판정 20% / 판정값 {roll:.2f}")
            if roll < 20:
                print("→ 마비로 행동에 실패했다.")
                return True

        if character_logic.on_action_start_after_paralysis(self, choice):
            return True

        if character_logic.on_action_start_after_common(self, choice):
            return True

        return False

    def on_active_mp_spent(self, actor: Fighter) -> None:
        character_logic.on_active_mp_spent(self, actor)
        if any(status["name"] == "잔류" for status in actor.data.get("unique_statuses", [])):
            actor.counters["잔류"] = min(4, int(actor.counters.get("잔류", 0)) + 1)

    def accuracy_check(self, choice: Choice) -> bool:
        actor = choice.actor
        target = self.opponent(actor)
        accuracy = self.modified_accuracy(choice)
        if accuracy >= 100:
            print(f"명중률 {pct(accuracy)} → 명중 판정 성공.")
        else:
            roll = self.roll("명중")
            print(f"명중률 {pct(accuracy)} / 판정값 {roll:.2f}")
            if roll >= accuracy:
                print("→ 명중 판정 실패. 공격이 빗나갔다.")
                return False
            print("→ 명중 판정 성공.")

        evasion = self.target_evasion(target, choice)
        if target.guaranteed_evasion and choice.action.is_attack:
            print("상대의 회피 판정이 반드시 성공한다.")
            print("→ 공격이 회피되었다.")
            return False
        if evasion > 0:
            roll = self.roll("회피")
            print(f"{target.name} 회피 확률 {pct(evasion)} / 판정값 {roll:.2f}")
            if roll < evasion:
                print("→ 공격이 회피되었다.")
                return False
            print("→ 회피 판정 실패.")
        return True

    def modified_accuracy(self, choice: Choice) -> float:
        actor = choice.actor
        target = self.opponent(actor)
        action = choice.action
        if action.accuracy is None:
            return 100.0
        accuracy = float(action.accuracy)
        accuracy = character_logic.modify_accuracy(self, choice, target, accuracy)
        return float(clamp(accuracy, 0, 100))

    def target_evasion(self, target: Fighter, choice: Choice) -> float:
        evasion = target.evasion_chance
        evasion = character_logic.target_evasion(self, target, choice, evasion)
        return float(clamp(evasion, 0, 100))

    def apply_condition_effects(self, choice: Choice) -> bool:
        action = choice.action
        choice.power = action.power
        return character_logic.apply_condition_effects(self, choice)

    def apply_attack_damage(self, choice: Choice) -> int:
        actor = choice.actor
        target = self.opponent(actor)
        total = 0
        hits = max(1, choice.hit_count)
        for hit_index in range(1, hits + 1):
            damage = self.calculate_attack_damage(choice)
            before = target.hp
            applied, after_hp, revived = self.damage(target, damage, f"{choice.action.name} 공격 피해", attack=True, source=actor)
            total += applied
            if hits > 1:
                print(f"{hit_index}타: {target.name}에게 {applied}의 피해. HP {before} → {after_hp}")
            else:
                print(f"{target.name}에게 {total}의 피해. {target.name} HP {before} → {after_hp}")
            if revived:
                character_logic.print_defeat_escape(self, target, revived)
            if self.game_over:
                self.record.attack_hit[actor.side] = True
                return total
        self.record.attack_hit[actor.side] = True
        return total

    def calculate_attack_damage(self, choice: Choice) -> int:
        actor = choice.actor
        target = self.opponent(actor)
        action = choice.action
        atk, _, _ = self.current_stats(actor)
        _, target_def, _ = self.current_stats(target)
        power = max(0, int(choice.power or 0))
        power = character_logic.modify_attack_power(self, choice, power)

        multipliers = []
        multipliers.extend(character_logic.attack_damage_multipliers(self, choice))

        mult = 1.0
        for value in multipliers:
            mult *= value
        raw = power * (atk + 50) / (target_def + 50) * mult
        return max(1, floor_int(raw))

    def apply_on_hit_effects(self, choice: Choice, total_damage: int) -> None:
        actor = choice.actor

        character_logic.on_hit_pre_defense(self, choice, total_damage)
        if self.game_over:
            return
        self.apply_defense_hit_reactions(choice, total_damage)
        if self.game_over:
            return

        character_logic.on_hit_after_defense(self, choice, total_damage)

    def apply_non_attack_effects(self, choice: Choice) -> None:
        actor = choice.actor
        action = choice.action

        if action.is_common_action("defense"):
            self.apply_defense(actor, action.name)
        elif action.is_common_action("meditation"):
            self.restore_mp(actor, 15, "명상")
            character_logic.on_meditation_effect(self, choice)
        elif not character_logic.apply_non_attack_effects(self, choice):
            print("효과를 처리했다.")

    def apply_defense_hit_reactions(self, choice: Choice, total_damage: int) -> None:
        character_logic.on_defense_hit(self, choice, total_damage)

    def finish_action(self, choice: Choice, success: bool, hit: bool, miss_not_failure: bool = False) -> None:
        actor = choice.actor
        action = choice.action
        failed = not success and not miss_not_failure
        if success:
            self.record.action_success[actor.side] = True
            actor.last_successful_action_key = action.key
        else:
            self.record.action_success[actor.side] = False

        if action.is_defense and success:
            actor.defense_streak += 1
        elif not failed:
            actor.defense_streak = 0

        character_logic.finish_action(self, choice, success, hit, miss_not_failure)

    def apply_defense(self, actor: Fighter, name: str, bonus_reduction: float = 0.0) -> None:
        actor.defense_name = name
        actor.defense_mult = defense_multiplier_for_streak(actor.defense_streak + 1, bonus_reduction)
        reduction = defense_reduction_percent_for_streak(actor.defense_streak + 1, bonus_reduction)
        print(f"[방어] 성공. 이번 턴 공격 피해를 {reduction}% 경감한다.")

    def end_turn(self) -> None:
        print()
        print("[턴 종료]")
        for fighter in (self.player, self.ai):
            if self.game_over:
                return
            self.apply_pre_mp_turn_end(fighter)
        for fighter in (self.player, self.ai):
            if self.game_over:
                return
            base = 10 + character_logic.turn_end_mp_bonus(fighter)
            self.restore_mp(fighter, base, "턴 종료 기본 회복")
        for fighter in (self.player, self.ai):
            if self.game_over:
                return
            self.apply_other_turn_end(fighter)
        if not self.game_over:
            for fighter in (self.player, self.ai):
                self.decrement_durations(fighter)

    def apply_pre_mp_turn_end(self, fighter: Fighter) -> None:
        character_logic.apply_pre_mp_turn_end(self, fighter)

    def apply_other_turn_end(self, fighter: Fighter) -> None:
        character_logic.apply_other_turn_end(self, fighter)

    def decrement_durations(self, fighter: Fighter) -> None:
        for status in list(fighter.statuses.values()):
            status.remaining -= 1
            if status.remaining <= 0 or status.stacks <= 0:
                fighter.statuses.pop(status.name, None)
                print(f"{fighter.name}의 {status.name} 효과가 사라졌다.")
        for effect in list(fighter.stat_effects):
            effect.remaining -= 1
            if effect.remaining <= 0:
                fighter.stat_effects.remove(effect)
        for effect in list(fighter.cost_effects):
            effect.remaining -= 1
            if effect.remaining <= 0:
                fighter.cost_effects.remove(effect)
        if fighter.forbidden_remaining > 0:
            fighter.forbidden_remaining -= 1
            if fighter.forbidden_remaining <= 0:
                fighter.forbidden_action_key = None
        character_logic.decrement_counters(fighter)

    def current_stats(self, fighter: Fighter) -> tuple[float, float, float]:
        atk = fighter.base_atk
        df = fighter.base_def
        spd = fighter.base_spd
        if "마비" in fighter.statuses:
            spd *= 0.8
        atk, df, spd = character_logic.modify_stats(self, fighter, atk, df, spd)
        for effect in fighter.stat_effects:
            if effect.stat == "atk":
                atk *= effect.multiplier
            elif effect.stat == "def":
                df *= effect.multiplier
            elif effect.stat == "spd":
                spd *= effect.multiplier
        return atk, df, spd

    def damage(
        self,
        target: Fighter,
        amount: int,
        reason: str,
        attack: bool = False,
        source: Fighter | None = None,
    ) -> tuple[int, int, tuple[int, int, int, int] | None]:
        amount = max(0, int(amount))
        if amount <= 0:
            return 0, target.hp, None
        original = amount
        if attack and target.defense_mult is not None:
            amount = max(1, floor_int(amount * target.defense_mult))
            reduced = max(0, original - amount)
            self.record.defense_reduced[target.side] = self.record.defense_reduced.get(target.side, 0) + reduced
        before = target.hp
        target.hp = max(0, target.hp - amount)
        actual = before - target.hp
        if attack:
            self.record.attack_damage_taken[target.side] = self.record.attack_damage_taken.get(target.side, 0) + actual
        self.on_damage_taken(target, actual, attack, source)
        after_damage_hp = target.hp
        revived = None
        if target.hp <= 0:
            revived = character_logic.consume_defeat_escape(self, target)
            if revived is None:
                self.end_battle(winner=source or self.opponent(target), loser=target)
        return actual, after_damage_hp, revived

    def fixed_damage(self, target: Fighter, amount: int, reason: str) -> None:
        before = target.hp
        actual, after_hp, revived = self.damage(target, amount, reason, attack=False, source=self.opponent(target))
        if amount > 0:
            print(f"{target.name}은 {reason}{josa_ro(reason)} {actual}의 고정 피해를 입었다. HP {before} → {after_hp}")
        if revived:
            character_logic.print_defeat_escape(self, target, revived)
        if not self.game_over:
            opponent = self.opponent(target)
            character_logic.on_fixed_damage_to_opponent(self, opponent, target, amount)

    def on_damage_taken(self, target: Fighter, amount: int, attack: bool, source: Fighter | None) -> None:
        if amount <= 0:
            return
        character_logic.on_damage_taken(self, target, amount, attack, source)

    def heal(self, fighter: Fighter, amount: int, reason: str) -> None:
        amount = max(0, int(amount))
        if amount <= 0:
            return
        before = fighter.hp
        fighter.hp = min(fighter.max_hp, fighter.hp + amount)
        print(f"{fighter.name} HP 회복 {before} → {fighter.hp} ({reason})")

    def restore_mp(self, fighter: Fighter, amount: int, reason: str) -> None:
        amount = max(0, int(amount))
        if amount <= 0:
            return
        before = fighter.mp
        fighter.mp = min(MAX_MP, fighter.mp + amount)
        print(f"{fighter.name} MP {before} → {fighter.mp} ({reason})")

    def reduce_mp(self, fighter: Fighter, amount: int, reason: str) -> int:
        amount = max(0, int(amount))
        before = fighter.mp
        fighter.mp = max(0, fighter.mp - amount)
        actual = before - fighter.mp
        if actual > 0:
            print(f"{fighter.name} MP {before} → {fighter.mp} ({reason})")
        return actual

    def add_status(self, fighter: Fighter, name: str, turns: int, stacks: int, source: str, stack: bool = False) -> None:
        if stacks <= 0:
            return
        current = fighter.statuses.get(name)
        if current:
            if stack:
                current.stacks += stacks
            else:
                current.stacks = max(current.stacks, stacks)
            current.remaining = max(current.remaining, turns)
        else:
            fighter.statuses[name] = TimedStatus(name, turns, stacks, source)
        status = fighter.statuses[name]
        if status.stacks == 1:
            print(f"{fighter.name}에게 {name} 상태가 {status.remaining}턴 동안 적용되었다.")
        else:
            print(f"{fighter.name}에게 {name} {status.stacks}중첩이 {status.remaining}턴 동안 적용되었다.")

    def add_stat_effect(self, fighter: Fighter, stat: str, multiplier: float, turns: int, source: str) -> None:
        for effect in fighter.stat_effects:
            if effect.stat == stat and effect.source == source:
                effect.multiplier = multiplier
                effect.remaining = max(effect.remaining, turns)
                print(f"{fighter.name}의 {stat.upper()} x{multiplier:g} 효과가 갱신되었다.")
                return
        fighter.stat_effects.append(StatEffect(stat, multiplier, turns, source))
        print(f"{fighter.name}의 {stat.upper()}이 {turns}턴 동안 x{multiplier:g}가 된다.")

    def add_cost_effect(self, fighter: Fighter, multiplier: float, turns: int, source: str) -> None:
        fighter.cost_effects.append(CostEffect(multiplier, turns, source))
        print(f"{fighter.name}의 액티브 MP 소모량이 {turns}턴 동안 {multiplier:g}배가 된다.")

    def add_counter(self, fighter: Fighter, name: str, amount: int, max_value: int | None = None) -> None:
        before = int(fighter.counters.get(name, 0))
        after = before + amount
        if max_value is not None:
            after = min(max_value, after)
        fighter.counters[name] = after
        print(f"{fighter.name}의 {name} {before} → {after}중첩")

    def add_vengeance(self, fighter: Fighter) -> None:
        before = int(fighter.counters.get("과령", 0))
        fighter.counters["과령"] = before + 1
        print(f"{fighter.name}의 과령 {before} → {fighter.counters['과령']}중첩")
        if fighter.counters["과령"] >= 6 and int(fighter.counters.get("거포 강령", 0)) <= 0:
            self.trigger_vengeance_overflow(fighter, "과령 폭주")

    def trigger_vengeance_overflow(self, fighter: Fighter, reason: str) -> None:
        stacks = int(fighter.counters.get("과령", 0))
        fighter.counters["과령"] = 0
        self.fixed_damage(fighter, 25, reason)
        print(f"과령 {stacks}중첩이 모두 소모되었다.")

    def end_battle(self, winner: Fighter, loser: Fighter) -> None:
        if self.game_over:
            return
        self.game_over = True
        self.winner = winner
        self.loser = loser

    def print_game_over(self) -> None:
        print()
        print("━━━━━━━━ GAME OVER ━━━━━━━━")
        print(f"승자: {self.winner.label if self.winner else '없음'}")
        print(f"패자: {self.loser.label if self.loser else '없음'}")
        print(f"총 턴 수: {self.turn}")
        print(f"AI 성격: {self.personality['name']}")
        print("━━━━━━━━━━━━━━━━━━━━━━━")

    def roll(self, label: str) -> float:
        return self.rng.random() * 100

    def is_actor_first(self, choice: Choice) -> bool:
        return self.turn_order.get(choice.actor.side, 99) == 0

    def estimate_hit_rate(self, actor: Fighter, target: Fighter, action: Action) -> float:
        if action.accuracy is None:
            return 1.0
        clone_actor = actor.clone()
        clone_target = target.clone()
        choice = Choice(clone_actor, action, self.effective_cost(actor, action), self.effective_priority(actor, action), action.power, action.accuracy)
        acc = self.modified_accuracy_for_estimate(choice, clone_target)
        evasion = clone_target.evasion_chance
        evasion = character_logic.estimate_target_evasion(self, clone_target, action, evasion)
        return clamp(acc / 100 * (1 - evasion / 100), 0, 1)

    def modified_accuracy_for_estimate(self, choice: Choice, target: Fighter) -> float:
        action = choice.action
        if action.accuracy is None:
            return 100
        acc = float(action.accuracy)
        acc = character_logic.modify_accuracy(self, choice, target, acc)
        return float(clamp(acc, 0, 100))

    def estimate_action_damage(self, actor: Fighter, target: Fighter, action: Action, use_max: bool) -> float:
        if not action.is_attack:
            return 0.0
        choice = Choice(actor, action, self.effective_cost(actor, action), self.effective_priority(actor, action), action.power, action.accuracy)
        if "[연격]" in action.description:
            character_hits = character_logic.estimated_hit_count(actor, action, use_max)
            if character_hits is None:
                hits = 3 if use_max else 2
            else:
                hits = character_hits
        else:
            hits = 1
        try:
            damage = self.calculate_estimated_damage(actor, target, action)
        except Exception:
            damage = 0
        return damage * hits

    def calculate_estimated_damage(self, actor: Fighter, target: Fighter, action: Action) -> int:
        atk, _, _ = self.current_stats(actor)
        _, target_def, _ = self.current_stats(target)
        power = action.power or 0
        power = character_logic.estimated_power(self, actor, target, action, power)
        mult = 1.0
        for value in character_logic.estimated_damage_multipliers(self, actor, target, action):
            mult *= value
        if target.defense_mult is not None:
            mult *= target.defense_mult
        return max(1, floor_int(power * (atk + 50) / (target_def + 50) * mult))

    def estimate_best_incoming_damage(self, attacker: Fighter, defender: Fighter) -> float:
        legal = [a for a in available_actions(attacker) if self.is_legal_choice(attacker, a) and a.is_attack]
        if not legal:
            return 0
        return max(self.estimate_action_damage(attacker, defender, action, use_max=True) for action in legal)

    def would_condition_fail(self, actor: Fighter, target: Fighter, action: Action) -> bool:
        return character_logic.would_condition_fail(self, actor, target, action)


def defense_multiplier_for_streak(streak: int, bonus_reduction: float = 0.0) -> float:
    base = DEFENSE_MULTIPLIERS[streak - 1] if 1 <= streak <= len(DEFENSE_MULTIPLIERS) else 1.0
    reduction = 1 - base
    reduction = clamp(reduction + bonus_reduction, 0, 1)
    return float(1 - reduction)


def defense_reduction_percent_for_streak(streak: int, bonus_reduction: float = 0.0) -> int:
    mult = defense_multiplier_for_streak(streak, bonus_reduction)
    return int(round((1 - mult) * 100))


def skill_key(character_id: str, slot: int) -> str:
    return f"{character_id}:{slot}"


def common_action_key(kind: str) -> str:
    return f"common:{kind}"


def action_from_skill(number: int, skill: dict[str, Any], character_id: str | None = None) -> Action:
    slot = number - 4
    return Action(
        number=number,
        name=skill["name"],
        target=skill["target"],
        mp=int(skill["mp"]),
        power=skill.get("power"),
        accuracy=skill.get("accuracy"),
        priority=int(skill["priority"]),
        description=skill["description"],
        common=False,
        character_id=character_id,
        slot=slot,
    )


def normal_actions() -> list[Action]:
    return [
        Action(1, "일반 공격", "상대", 0, 10, 100, 0, "효과 없음.", True, "normal_attack"),
        Action(2, "일반 방어", "자신", 0, None, None, 3, "[방어] 자신이 이 턴에 입는 공격 피해를 경감한다.", True, "defense"),
        Action(3, "명상", "자신", 0, None, None, 0, "자신의 MP를 15 회복한다.", True, "meditation"),
    ]


def available_actions(fighter: Fighter) -> list[Action]:
    return normal_actions() + [
        action_from_skill(i, skill, fighter.character_id)
        for i, skill in enumerate(fighter.data.get("skills", []), start=4)
    ]


def action_kind(action: Action) -> str:
    if action.is_common_action("meditation"):
        return "명상"
    if action.is_defense:
        return "방어"
    if action.is_attack:
        return "액티브 공격" if action.is_active else "공격"
    return "액티브 비공격" if action.is_active else "비공격"


def kind_is_attack(kind: str | None) -> bool:
    return kind in {"공격", "액티브 공격"}


def render_action(action: Action, cost: int | None = None, priority: int | None = None) -> str:
    mp = action.mp if cost is None else cost
    pr = action.priority if priority is None else priority
    power = "-" if action.power is None else str(action.power)
    accuracy = "-" if action.accuracy is None else str(action.accuracy)
    if cost is not None and cost != action.mp:
        mp_text = f"MP {mp} (기본 {action.mp})"
    else:
        mp_text = f"MP {mp}"
    if priority is not None and priority != action.priority:
        priority_text = f"우선도 {pr} (기본 {action.priority})"
    else:
        priority_text = f"우선도 {pr}"
    return (
        f"[{action.number}] {action.name}\n"
        f"{action.target} / {mp_text} / 위력 {power} / 명중률 {accuracy} / {priority_text}\n"
        f"{action.description}"
    )


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def choose_index(prompt: str, characters: list[dict[str, Any]], rng: random.Random) -> int:
    print(prompt)
    print("[000] 랜덤")
    for index, char in enumerate(characters, start=1):
        print(f"[{index:03d}] {char['name']} — {char['title']}")
    while True:
        raw = input("> ").strip()
        if raw in {"0", "000", "랜덤"}:
            index = rng.randrange(len(characters))
            print(f"랜덤 선택: {characters[index]['name']} — {characters[index]['title']}")
            return index
        try:
            value = int(raw)
        except ValueError:
            value = -1
        if 1 <= value <= len(characters):
            return value - 1
        print("올바른 번호를 입력하세요.")


def choose_personality(ai_data: dict[str, Any], rng: random.Random) -> tuple[str, bool]:
    personalities = ai_data.get("personalities", [])
    print("AI 성격을 선택하세요.")
    print("[0] 랜덤")
    for index, personality in enumerate(personalities, start=1):
        print(f"[{index}] {personality['id']} — {personality['name']}")
    while True:
        raw = input("> ").strip().upper()
        if raw in {"0", "RANDOM", "랜덤"}:
            personality = rng.choice(personalities)
            print("랜덤 선택: RANDOM")
            return personality["id"], True
        for index, personality in enumerate(personalities, start=1):
            if raw == str(index) or raw == personality["id"]:
                return personality["id"], False
        print("올바른 번호 또는 성격 ID를 입력하세요.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="VERSUS 턴제 PvE 전투 진행기")
    parser.add_argument("--seed", type=int, default=None, help="난수 시드")
    parser.add_argument("--player", type=int, default=None, help="플레이어 캐릭터 번호(1부터)")
    parser.add_argument("--ai", type=int, default=None, help="AI 캐릭터 번호(1부터)")
    parser.add_argument("--personality", default=None, help="AI 성격 ID: R/C/D/M/G/E/J/A 또는 0/RANDOM")
    parser.add_argument("--auto", action="store_true", help="플레이어도 자동 선택으로 진행")
    parser.add_argument("--max-turns", type=int, default=200, help="최대 턴 수")
    parser.add_argument(
        "--line-delay",
        type=float,
        default=None,
        help="출력 한 줄마다 기다릴 초. 기본값은 수동 플레이 0.08, --auto 0",
    )
    parser.add_argument("--fast", action="store_true", help="출력 지연 없이 빠르게 진행")
    return parser.parse_args()


def install_line_pacing(delay: float) -> None:
    if delay <= 0:
        return
    original_print = builtins.print

    def paced_print(*args: Any, **kwargs: Any) -> None:
        sep = kwargs.get("sep", " ")
        end = kwargs.get("end", "\n")
        file = kwargs.get("file", sys.stdout)
        flush = kwargs.get("flush", False)
        if file not in (None, sys.stdout) or end != "\n":
            original_print(*args, **kwargs)
            return

        text = sep.join(str(arg) for arg in args)
        lines = text.split("\n")
        for index, line in enumerate(lines):
            original_print(line, end="\n", file=file, flush=True or flush)
            if index != len(lines) - 1 or text:
                time.sleep(delay)

    builtins.print = paced_print


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stdin, "reconfigure"):
        sys.stdin.reconfigure(encoding="utf-8")
    args = parse_args()
    if args.fast:
        line_delay = 0.0
    elif args.line_delay is not None:
        line_delay = max(0.0, args.line_delay)
    else:
        line_delay = 0.0 if args.auto else 0.08
    install_line_pacing(line_delay)
    root = Path(__file__).resolve().parent
    dataset = root / "dataset"
    characters = load_json(dataset / "characters.json")
    ai_data = AI_DATA
    rng = random.Random(args.seed)

    if args.player is None:
        player_index = choose_index("플레이어 캐릭터를 선택하세요.", characters, rng)
    else:
        player_index = args.player - 1
    if args.ai is None:
        ai_index = choose_index("AI 캐릭터를 선택하세요.", characters, rng)
    else:
        ai_index = args.ai - 1
    if not (0 <= player_index < len(characters)) or not (0 <= ai_index < len(characters)):
        raise SystemExit("캐릭터 번호가 범위를 벗어났습니다.")

    personalities = ai_data.get("personalities", [])
    personality_ids = {item["id"] for item in personalities}
    hide_personality_until_game_over = False
    if args.personality is None:
        personality_id, hide_personality_until_game_over = choose_personality(ai_data, rng)
    else:
        personality_id = args.personality.upper()
        if personality_id in {"0", "RANDOM", "랜덤"}:
            personality_id = rng.choice(personalities)["id"]
            hide_personality_until_game_over = True
    if personality_id not in personality_ids:
        raise SystemExit("AI 성격 ID가 올바르지 않습니다.")

    battle = Battle(
        characters,
        ai_data,
        player_index,
        ai_index,
        personality_id,
        rng,
        auto_player=args.auto,
        max_turns=args.max_turns,
        hide_personality_until_game_over=hide_personality_until_game_over,
    )
    battle.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
