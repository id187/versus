#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Local web UI server for VERSUS."""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import mimetypes
import random
import re
import secrets
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from versus import AI_DATA, Battle, available_actions, load_json, render_action


ROOT = Path(__file__).resolve().parent
DATASET = ROOT / "dataset"
WEB_ROOT = ROOT / "web"
APP_ID = "VERSUS"
PVP_DEFAULT_PERSONALITY_ID = "R"
PVP_MAX_TURNS = 200


class PvpRoom:
    def __init__(self, code: str) -> None:
        self.code = code
        self.rng = random.Random()
        self.tokens: list[str | None] = [None, None]
        self.character_indices: list[int | None] = [None, None]
        self.battle: Battle | None = None
        self.pending_actions: dict[int, Any] = {}
        self.rematch_ready: set[int] = set()
        self.last_log: list[str] = []
        self.last_log_serial = 0
        self.last_log_turn = 0

    def slot_for_token(self, token: Any) -> int | None:
        token = str(token or "")
        if not token:
            return None
        for slot, current in enumerate(self.tokens):
            if current == token:
                return slot
        return None

    def first_empty_slot(self) -> int | None:
        for slot, token in enumerate(self.tokens):
            if token is None:
                return slot
        return None

    def is_ready(self) -> bool:
        return all(token is not None for token in self.tokens) and all(
            index is not None for index in self.character_indices
        )

    def is_rematch_lobby(self) -> bool:
        return bool(self.battle and self.battle.game_over and self.rematch_ready)


class GameStore:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.characters = load_json(DATASET / "characters.json")
        self.ai_data = AI_DATA
        self.battle: Battle | None = None
        self.pending_ai_action: Any | None = None
        self.pvp_rooms: dict[str, PvpRoom] = {}

    def options(self) -> dict[str, Any]:
        characters = [
            {
                "index": index,
                "id": char.get("id", str(index)),
                "name": char["name"],
                "title": char["title"],
                "stats": char["stats"],
                "uniqueStatuses": char.get("unique_statuses", []),
                "passive": char.get("passive"),
                "skills": char.get("skills", []),
            }
            for index, char in enumerate(self.characters)
        ]
        characters.sort(key=lambda item: item["name"])
        return {
            "characters": characters,
            "personalities": [
                {"id": item["id"], "name": item["name"]}
                for item in self.ai_data.get("personalities", [])
            ],
        }

    def new_battle(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            seed = payload.get("seed")
            rng = random.Random(None if seed in (None, "") else seed)
            player_index = self.resolve_character_index(payload.get("playerIndex"), rng)
            ai_index = self.resolve_character_index(payload.get("aiIndex"), rng)
            personality_value = payload.get("personalityId")
            hide_personality_until_game_over = self.is_random_personality_request(personality_value)
            personality_id = self.resolve_personality(personality_value, rng)
            self.battle = Battle(
                self.characters,
                self.ai_data,
                player_index,
                ai_index,
                personality_id,
                rng,
                auto_player=False,
                max_turns=int(payload.get("maxTurns") or 200),
                hide_personality_until_game_over=hide_personality_until_game_over,
            )
            self.battle.start_turn()
            self.lock_ai_action()
            personality = self.battle.visible_personality()
            log = [
                f"전투 시작: {self.battle.player.name} vs {self.battle.ai.name}",
                f"AI 성향: {personality['name']}",
            ]
            state = self.state_unlocked()
            state.update({"ok": True, "log": log})
            return state

    def choose_action(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            battle = self.require_battle()
            if battle.game_over:
                raise ValueError("Battle already ended.")

            raw = str(payload.get("action", "")).strip()
            action = battle.find_action_by_input(battle.player, raw)
            if action is None:
                raise ValueError("Unknown action.")
            if not battle.is_legal_choice(battle.player, action):
                raise ValueError("That action is not currently available.")

            def resolve() -> None:
                ai_action = self.consume_ai_action(battle)
                player_choice = battle.make_choice(battle.player, action)
                ai_choice = battle.make_choice(battle.ai, ai_action)
                battle.resolve_turn(player_choice, ai_choice)
                if battle.game_over:
                    self.pending_ai_action = None
                    battle.print_game_over()
                else:
                    battle.turn += 1
                    battle.start_turn()
                    self.lock_ai_action()

            log = web_log_lines(capture_lines(resolve))
            state = self.state_unlocked()
            state.update({"ok": True, "log": log})
            return state

    def state(self) -> dict[str, Any]:
        with self.lock:
            return self.state_unlocked()

    def state_unlocked(self) -> dict[str, Any]:
        battle = self.battle
        if battle is None:
            return {"started": False}
        return {
            "started": True,
            "turn": battle.turn,
            "is_over": battle.game_over,
            "gameOver": battle.game_over,
            "result": game_result_text(battle),
            "winner": fighter_summary(battle.winner) if battle.winner else None,
            "loser": fighter_summary(battle.loser) if battle.loser else None,
            "player": fighter_state(battle, battle.player),
            "ai": fighter_state(battle, battle.ai),
            "personality": battle.visible_personality(),
            "aiChoiceLocked": self.pending_ai_action is not None and not battle.game_over,
            "actions": action_states(battle),
        }

    def require_battle(self) -> Battle:
        if self.battle is None:
            raise ValueError("Battle has not started.")
        return self.battle

    def lock_ai_action(self) -> None:
        battle = self.require_battle()
        if battle.game_over:
            self.pending_ai_action = None
            return
        self.pending_ai_action = battle.select_ai_action(battle.ai, battle.player, battle.personality)

    def consume_ai_action(self, battle: Battle) -> Any:
        action = self.pending_ai_action
        if action is None or not battle.is_legal_choice(battle.ai, action):
            self.lock_ai_action()
            action = self.pending_ai_action
        if action is None:
            raise ValueError("AI action is not available.")
        self.pending_ai_action = None
        return action

    def resolve_character_index(self, value: Any, rng: random.Random) -> int:
        if value in (None, "", "random", -1):
            return rng.randrange(len(self.characters))
        index = int(value)
        if not 0 <= index < len(self.characters):
            raise ValueError("Character index is out of range.")
        return index

    def resolve_personality(self, value: Any, rng: random.Random) -> str:
        personalities = self.ai_data.get("personalities", [])
        ids = {item["id"] for item in personalities}
        if self.is_random_personality_request(value):
            return rng.choice(personalities)["id"]
        value = str(value).upper()
        if value not in ids:
            raise ValueError("Invalid AI personality id.")
        return value

    @staticmethod
    def is_random_personality_request(value: Any) -> bool:
        if value is None:
            return True
        return str(value).strip().lower() in {"", "0", "random", "랜덤"}

    def pvp_join(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            code = self.normalize_pvp_room_code(payload.get("roomCode"))
            room = self.pvp_rooms.get(code)
            if room is None:
                room = PvpRoom(code)
                self.pvp_rooms[code] = room

            token = str(payload.get("token") or "")
            slot = room.slot_for_token(token)
            if slot is None:
                slot = room.first_empty_slot()
                if slot is None:
                    raise ValueError("이미 두 명이 들어온 방입니다.")
                token = secrets.token_urlsafe(18)
                room.tokens[slot] = token

            notice = [f"PvP 방 {code}에 입장했습니다."]
            if room.battle is not None and room.battle.game_over:
                self.ready_pvp_rematch(room, slot, payload.get("playerIndex"))
                if room.battle is not None and not room.battle.game_over:
                    notice.append("재대전이 시작되었습니다.")
                else:
                    notice.append("재대전 준비 완료. 상대를 기다리는 중입니다.")
            elif room.battle is None:
                room.character_indices[slot] = self.resolve_character_index(payload.get("playerIndex"), room.rng)
                if room.is_ready():
                    self.start_pvp_battle(room)
                    notice.append("상대와 연결되었습니다.")
                else:
                    notice.append("상대 입장을 기다리는 중입니다.")
            else:
                notice.append("진행 중인 PvP 전투에 재접속했습니다.")

            state = self.pvp_state_unlocked(room, slot, int(payload.get("sinceLogSerial") or 0))
            state.update({"ok": True, "token": token, "noticeLog": notice})
            return state

    def pvp_state(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            room, slot = self.require_pvp_room(payload)
            state = self.pvp_state_unlocked(room, slot, int(payload.get("sinceLogSerial") or 0))
            state.update({"ok": True, "token": room.tokens[slot]})
            return state

    def pvp_choose_action(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            room, slot = self.require_pvp_room(payload)
            battle = room.battle
            if battle is None:
                raise ValueError("아직 상대가 입장하지 않았습니다.")
            if battle.game_over:
                state = self.pvp_state_unlocked(room, slot, int(payload.get("sinceLogSerial") or 0))
                state.update({"ok": True, "token": room.tokens[slot]})
                return state
            if slot in room.pending_actions:
                state = self.pvp_state_unlocked(room, slot, int(payload.get("sinceLogSerial") or 0))
                state.update({"ok": True, "token": room.tokens[slot], "noticeLog": ["이미 행동을 선택했습니다."]})
                return state

            fighter = self.pvp_fighter_for_slot(room, slot)
            raw = str(payload.get("action", "")).strip()
            action = battle.find_action_by_input(fighter, raw)
            if action is None:
                raise ValueError("Unknown action.")
            if not battle.is_legal_choice(fighter, action):
                raise ValueError("That action is not currently available.")

            room.pending_actions[slot] = action
            notice = ["행동을 선택했습니다. 상대 선택을 기다리는 중입니다."]
            if len(room.pending_actions) == 2:
                self.resolve_pvp_turn(room)
                notice = []

            state = self.pvp_state_unlocked(room, slot, int(payload.get("sinceLogSerial") or 0))
            state.update({"ok": True, "token": room.tokens[slot], "noticeLog": notice})
            return state

    def start_pvp_battle(self, room: PvpRoom) -> None:
        player_index, opponent_index = room.character_indices
        if player_index is None or opponent_index is None:
            raise ValueError("PvP character selection is incomplete.")
        room.battle = Battle(
            self.characters,
            self.ai_data,
            player_index,
            opponent_index,
            PVP_DEFAULT_PERSONALITY_ID,
            room.rng,
            auto_player=False,
            max_turns=PVP_MAX_TURNS,
            hide_personality_until_game_over=False,
        )
        room.battle.start_turn()
        room.pending_actions.clear()
        room.rematch_ready.clear()
        room.last_log_serial += 1
        room.last_log_turn = 0
        room.last_log = [
            f"PvP 전투 시작: {room.battle.player.name} vs {room.battle.ai.name}",
            "양쪽 플레이어가 행동을 선택합니다.",
        ]

    def ready_pvp_rematch(self, room: PvpRoom, slot: int, player_index_value: Any) -> None:
        next_index = self.resolve_character_index(player_index_value, room.rng)
        was_ready = slot in room.rematch_ready
        changed_character = room.character_indices[slot] != next_index
        room.character_indices[slot] = next_index
        room.pending_actions.clear()
        room.rematch_ready.add(slot)
        if room.rematch_ready == {0, 1}:
            self.start_pvp_battle(room)
            return
        if not was_ready or changed_character:
            room.last_log_serial += 1
            room.last_log_turn = 0
            room.last_log = ["재대전 준비 완료.", "상대 재입장을 기다리는 중입니다."]

    def resolve_pvp_turn(self, room: PvpRoom) -> None:
        battle = room.battle
        if battle is None:
            raise ValueError("PvP battle has not started.")
        player_action = room.pending_actions.get(0)
        opponent_action = room.pending_actions.get(1)
        if player_action is None or opponent_action is None:
            raise ValueError("Both players must choose an action.")

        previous_turn = battle.turn

        def resolve() -> None:
            player_choice = battle.make_choice(battle.player, player_action)
            opponent_choice = battle.make_choice(battle.ai, opponent_action)
            battle.resolve_turn(player_choice, opponent_choice)
            if battle.game_over:
                print_pvp_game_over(battle)
            else:
                battle.turn += 1
                battle.start_turn()

        room.last_log = web_log_lines(capture_lines(resolve))
        room.last_log_serial += 1
        room.last_log_turn = previous_turn
        room.pending_actions.clear()

    def pvp_state_unlocked(self, room: PvpRoom, slot: int, since_log_serial: int = 0) -> dict[str, Any]:
        battle = room.battle
        other_slot = 1 - slot
        rematch_lobby = room.is_rematch_lobby()
        data: dict[str, Any] = {
            "pvp": True,
            "started": battle is not None and not rematch_lobby,
            "roomCode": room.code,
            "playerSlot": slot,
            "personality": {"id": "pvp", "name": "PvP"},
            "logSerial": room.last_log_serial,
            "logTurn": room.last_log_turn,
        }
        if room.last_log_serial > since_log_serial:
            data["log"] = room.last_log

        if battle is None or rematch_lobby:
            own_character = self.characters[room.character_indices[slot]] if room.character_indices[slot] is not None else None
            data.update(
                {
                    "turn": 0,
                    "is_over": False,
                    "gameOver": False,
                    "result": None,
                    "winner": None,
                    "loser": None,
                    "player": character_preview_state(own_character, "player"),
                    "ai": empty_fighter_state(
                        "ai",
                        "상대 대기",
                        "재대전 대기" if rematch_lobby else "방 입장 대기",
                    ),
                    "actions": [],
                    "selectionLocked": False,
                    "opponentReady": False,
                    "waitingForOpponent": True,
                }
            )
            return data

        own = self.pvp_fighter_for_slot(room, slot)
        opponent = self.pvp_fighter_for_slot(room, other_slot)
        selection_locked = slot in room.pending_actions and not battle.game_over
        opponent_ready = other_slot in room.pending_actions and not battle.game_over
        data.update(
            {
                "turn": battle.turn,
                "is_over": battle.game_over,
                "gameOver": battle.game_over,
                "result": game_result_text(battle),
                "winner": pvp_fighter_summary(room, slot, battle.winner),
                "loser": pvp_fighter_summary(room, slot, battle.loser),
                "player": pvp_fighter_state(battle, own, "player"),
                "ai": pvp_fighter_state(battle, opponent, "ai"),
                "actions": action_states_for_fighter(battle, own, force_disabled=selection_locked),
                "selectionLocked": selection_locked,
                "opponentReady": opponent_ready,
                "waitingForOpponent": selection_locked and not opponent_ready,
            }
        )
        return data

    def pvp_fighter_for_slot(self, room: PvpRoom, slot: int) -> Any:
        battle = room.battle
        if battle is None:
            raise ValueError("PvP battle has not started.")
        return battle.player if slot == 0 else battle.ai

    def require_pvp_room(self, payload: dict[str, Any]) -> tuple[PvpRoom, int]:
        code = self.normalize_pvp_room_code(payload.get("roomCode"))
        room = self.pvp_rooms.get(code)
        if room is None:
            raise ValueError("존재하지 않는 PvP 방입니다.")
        slot = room.slot_for_token(payload.get("token"))
        if slot is None:
            raise ValueError("PvP 방 인증 정보가 올바르지 않습니다.")
        return room, slot

    @staticmethod
    def normalize_pvp_room_code(value: Any) -> str:
        code = str(value or "").strip().upper().replace(" ", "")
        if not 2 <= len(code) <= 24 or not re.fullmatch(r"[A-Z0-9_-]+", code):
            raise ValueError("방 코드는 숫자나 영문 2~24자로 입력해 주세요.")
        return code


def capture_lines(func: Any) -> list[str]:
    stream = io.StringIO()
    with contextlib.redirect_stdout(stream):
        func()
    return stream.getvalue().splitlines()


def web_log_lines(lines: list[str]) -> list[str]:
    result: list[str] = []
    skipping_info = False
    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        if "PLAYER 정보" in line or "AI 정보" in line:
            skipping_info = True
            continue
        if line.startswith("━━━━━━━━"):
            skipping_info = False
            continue
        if skipping_info:
            continue
        if line in {"고유 상태", "패시브", "액티브"}:
            continue
        if line == "[행동 순서]":
            continue
        if line.startswith("능력치:"):
            continue
        if "판정값" in line:
            continue
        if "선공 확률" in line or "회피 확률" in line:
            continue
        if "우선도" in line and "더 높다" in line:
            continue
        if "먼저 행동한다" in line:
            continue
        if "명중률" in line:
            if "명중 판정 성공" in line:
                result.append("→ 명중 판정 성공.")
            continue
        if line.startswith("[") and line.endswith("판정]"):
            continue
        result.append(polish_web_log_line(line).replace("⇒", "->"))
    return result


def polish_web_log_line(line: str) -> str:
    line = polish_stat_josa(line)

    action_match = re.match(r"^(.+)은 (.+)을 사용했다\.$", line)
    if action_match:
        actor, action = action_match.groups()
        return f"{with_josa(actor, '은', '는')} {with_josa(action, '을', '를')} 사용했다."

    return line


def polish_stat_josa(line: str) -> str:
    for stat in ("HP", "MP", "ATK", "DEF", "SPD"):
        line = line.replace(f"{stat}이", f"{stat}가")
    return line


def with_josa(text: str, consonant: str, vowel: str) -> str:
    return f"{text}{consonant if has_final_consonant(text) else vowel}"


def has_final_consonant(text: str) -> bool:
    for char in reversed(text.strip()):
        code = ord(char)
        if 0xAC00 <= code <= 0xD7A3:
            return (code - 0xAC00) % 28 != 0
        if char.isalnum():
            return True
    return False


def fighter_summary(fighter: Any) -> dict[str, Any] | None:
    if fighter is None:
        return None
    return {
        "side": fighter.side,
        "id": fighter.data.get("id"),
        "name": fighter.name,
        "title": fighter.title,
        "label": fighter.label,
    }


def fighter_state(battle: Battle, fighter: Any) -> dict[str, Any]:
    atk, defense, spd = battle.current_stats(fighter)
    atk = round_stat(atk)
    defense = round_stat(defense)
    spd = round_stat(spd)
    state_text = battle.current_state_text(fighter)
    return {
        "side": fighter.side,
        "id": fighter.data.get("id"),
        "name": fighter.name,
        "title": fighter.title,
        "label": fighter.label,
        "hp": fighter.hp,
        "max_hp": fighter.max_hp,
        "maxHp": fighter.max_hp,
        "mp": fighter.mp,
        "max_mp": 100,
        "maxMp": 100,
        "atk": atk,
        "defense": defense,
        "spd": spd,
        "stats": {"atk": atk, "def": defense, "spd": spd},
        "baseStats": {
            "hp": fighter.max_hp,
            "atk": fighter.base_atk,
            "def": fighter.base_def,
            "spd": fighter.base_spd,
        },
        "status_text": state_text,
        "stateText": state_text,
        "defenseText": battle.next_defense_reduction_text(fighter),
        "battleLog": fighter_battle_log(battle, fighter),
        "passive": fighter.data.get("passive"),
        "uniqueStatuses": fighter.data.get("unique_statuses", []),
    }


def pvp_fighter_state(battle: Battle, fighter: Any, side: str) -> dict[str, Any]:
    state = fighter_state(battle, fighter)
    state["side"] = side
    return state


def pvp_fighter_summary(room: PvpRoom, perspective_slot: int, fighter: Any) -> dict[str, Any] | None:
    if fighter is None or room.battle is None:
        return None
    summary = fighter_summary(fighter)
    if summary is None:
        return None
    own = room.battle.player if perspective_slot == 0 else room.battle.ai
    summary["side"] = "player" if fighter is own else "ai"
    return summary


def character_preview_state(character: dict[str, Any] | None, side: str) -> dict[str, Any]:
    if character is None:
        return empty_fighter_state(side, "-", "캐릭터 선택")
    stats = character.get("stats", {})
    hp = int(stats.get("hp", 0))
    return {
        "side": side,
        "id": character.get("id"),
        "name": character.get("name", "-"),
        "title": character.get("title", ""),
        "label": f"{character.get('name', '-')} — {character.get('title', '')}",
        "hp": hp,
        "max_hp": hp,
        "maxHp": hp,
        "mp": 0,
        "max_mp": 100,
        "maxMp": 100,
        "atk": stats.get("atk", "-"),
        "defense": stats.get("def", "-"),
        "spd": stats.get("spd", "-"),
        "stats": {"atk": stats.get("atk", "-"), "def": stats.get("def", "-"), "spd": stats.get("spd", "-")},
        "baseStats": stats,
        "status_text": "없음",
        "stateText": "없음",
        "defenseText": "0%",
        "battleLog": [],
        "passive": character.get("passive"),
        "uniqueStatuses": character.get("unique_statuses", []),
    }


def empty_fighter_state(side: str, name: str, title: str) -> dict[str, Any]:
    return {
        "side": side,
        "id": None,
        "name": name,
        "title": title,
        "label": f"{name} — {title}",
        "hp": 0,
        "max_hp": 0,
        "maxHp": 0,
        "mp": 0,
        "max_mp": 0,
        "maxMp": 0,
        "atk": "-",
        "defense": "-",
        "spd": "-",
        "stats": {"atk": "-", "def": "-", "spd": "-"},
        "baseStats": {"hp": 0, "atk": "-", "def": "-", "spd": "-"},
        "status_text": "없음",
        "stateText": "없음",
        "defenseText": "0%",
        "battleLog": [],
        "passive": None,
        "uniqueStatuses": [],
    }


def fighter_battle_log(battle: Battle, fighter: Any) -> list[str]:
    if not battle.needs_battle_log(fighter):
        return []
    return [
        line
        for line in battle.render_battle_log(fighter).splitlines()
        if line and line != "전투 기록"
    ]


def round_stat(value: Any) -> Any:
    if isinstance(value, (int, float)):
        rounded = round(value, 2)
        if isinstance(rounded, float) and rounded.is_integer():
            return int(rounded)
        return rounded
    return value


def game_result_text(battle: Battle) -> str | None:
    if not battle.game_over:
        return None
    if battle.winner is None:
        return "무승부"
    return f"{battle.winner.label} 승리"


def action_states(battle: Battle) -> list[dict[str, Any]]:
    return action_states_for_fighter(battle, battle.player)


def action_states_for_fighter(battle: Battle, fighter: Any, force_disabled: bool = False) -> list[dict[str, Any]]:
    result = []
    for action in available_actions(fighter):
        cost = battle.effective_cost(fighter, action)
        priority = battle.effective_priority(fighter, action)
        disabled = force_disabled or battle.game_over or not battle.is_legal_choice(fighter, action)
        power = "-" if action.power is None else str(action.power)
        accuracy = "-" if action.accuracy is None else str(action.accuracy)
        result.append(
            {
                "number": action.number,
                "name": action.name,
                "label": f"[{action.number}] {action.name}",
                "target": action.target,
                "cost": cost,
                "baseCost": action.mp,
                "cost_text": str(cost),
                "power": action.power,
                "accuracy": action.accuracy,
                "priority": priority,
                "basePriority": action.priority,
                "description": (
                    f"{action.target} / 위력 {power} / 명중률 {accuracy} / "
                    f"우선도 {priority}\n{action.description}"
                ),
                "isAttack": action.is_attack,
                "isDefense": action.is_defense,
                "disabled": disabled,
                "available": not disabled,
                "display": render_action(action, cost, priority),
            }
        )
    return result


def print_pvp_game_over(battle: Battle) -> None:
    print()
    print("━━━━━━━━ GAME OVER ━━━━━━━━")
    print(f"승자: {battle.winner.label if battle.winner else '없음'}")
    print(f"패자: {battle.loser.label if battle.loser else '없음'}")
    print(f"총 턴 수: {battle.turn}")
    print("━━━━━━━━━━━━━━━━━━━━━━━")


STORE = GameStore()


class VersusHandler(BaseHTTPRequestHandler):
    server_version = "VersusWeb/1.0"

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        try:
            if path == "/api/health":
                self.send_json({"ok": True, "app": APP_ID, "root": str(ROOT)})
            elif path == "/api/options":
                self.send_json(STORE.options())
            elif path == "/api/state":
                self.send_json(STORE.state())
            else:
                self.serve_static(path)
        except Exception as exc:
            self.send_json({"ok": False, "error": str(exc), "message": str(exc)}, status=500)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        try:
            payload = self.read_json()
            if path == "/api/new":
                self.send_json(STORE.new_battle(payload))
            elif path == "/api/action":
                self.send_json(STORE.choose_action(payload))
            elif path == "/api/pvp/join":
                self.send_json(STORE.pvp_join(payload))
            elif path == "/api/pvp/state":
                self.send_json(STORE.pvp_state(payload))
            elif path == "/api/pvp/action":
                self.send_json(STORE.pvp_choose_action(payload))
            elif path == "/api/exit":
                if not self.is_local_request():
                    self.send_json({"ok": False, "error": "Exit is only available locally."}, status=403)
                    return
                self.send_json({"ok": True})
                threading.Thread(target=self.server.shutdown, daemon=True).start()
            else:
                self.send_json({"ok": False, "error": "Unknown API.", "message": "Unknown API."}, status=404)
        except ValueError as exc:
            self.send_json({"ok": False, "error": str(exc), "message": str(exc)}, status=400)
        except Exception as exc:
            self.send_json({"ok": False, "error": str(exc), "message": str(exc)}, status=500)

    def read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw)

    def send_json(self, payload: dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def is_local_request(self) -> bool:
        host_header = self.headers.get("Host", "").lower()
        if host_header.startswith("["):
            host = host_header.split("]", 1)[0].strip("[]")
        else:
            host = host_header.split(":", 1)[0]
        return host in {"localhost", "127.0.0.1", "::1"}

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def serve_static(self, path: str) -> None:
        if path in ("", "/"):
            path = "/index.html"
        target = (WEB_ROOT / path.lstrip("/")).resolve()
        if not str(target).startswith(str(WEB_ROOT.resolve())) or not target.is_file():
            self.send_error(404)
            return
        body = target.read_bytes()
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        if target.suffix == ".js":
            content_type = "text/javascript; charset=utf-8"
        elif target.suffix in {".html", ".css", ".svg"}:
            content_type = f"{content_type}; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:
        return


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="VERSUS web server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), VersusHandler)
    print(f"VERSUS web server: http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
