"""Loads config.yaml once. Paths are relative to the project root."""
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
_CFG = None


def cfg() -> dict:
    global _CFG
    if _CFG is None:
        _CFG = yaml.safe_load((ROOT / "config.yaml").read_text())
    return _CFG


def path(rel: str) -> Path:
    return ROOT / rel
