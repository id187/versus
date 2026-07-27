"""Small shared helpers for character logic modules."""

from __future__ import annotations

import math
from typing import Any


PHASES = ["삭월", "초승", "상현", "만월", "하현", "그믐"]
PHASE_MULT = {
    "삭월": 0.9,
    "초승": 1.2,
    "상현": 1.5,
    "만월": 1.8,
    "하현": 1.5,
    "그믐": 1.2,
}
WEATHERS = ["천둥", "흐림", "맑음"]


def floor_int(value: int | float) -> int:
    return math.floor(value)


def skill_key(character_id: str, slot: int) -> str:
    return f"{character_id}:{slot}"


def common_action_key(kind: str) -> str:
    return f"common:{kind}"


def kind_is_attack(kind: str | None) -> bool:
    return kind in {"공격", "액티브 공격"}


def status_stacks(fighter: Any, name: str) -> int:
    status = fighter.statuses.get(name)
    return int(status.stacks) if status else 0


def status_remaining(fighter: Any, name: str) -> int:
    status = fighter.statuses.get(name)
    return int(status.remaining) if status else 0
