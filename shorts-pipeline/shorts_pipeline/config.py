from __future__ import annotations

import os
import re
import shutil
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    script_model: str = os.getenv("SCRIPT_MODEL", "gpt-5.6-luna")
    image_model: str = os.getenv("IMAGE_MODEL", "gpt-image-2")
    tts_model: str = os.getenv("TTS_MODEL", "tts-1-hd")
    transcribe_model: str = os.getenv("TRANSCRIBE_MODEL", "whisper-1")
    voice: str = os.getenv("VOICE", "onyx")
    width: int = 1080
    height: int = 1920
    fps: int = 30


def slugify(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return (value[:60] or "short-video").strip("-")


def require_preflight(require_key: bool = True) -> None:
    missing = [name for name in ("ffmpeg", "ffprobe") if not shutil.which(name)]
    if missing:
        raise RuntimeError(
            "Missing FFmpeg. Install it with: brew install ffmpeg\n"
            "Then rerun: make check"
        )
    if require_key and not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is missing. Copy .env.example to .env and add your key.")

