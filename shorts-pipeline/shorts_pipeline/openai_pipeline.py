from __future__ import annotations

import base64
import json
from pathlib import Path

from openai import OpenAI

from .config import Settings
from .models import VideoPlan, WordTiming


PLAN_PROMPT = """Create a punchy factual vertical-video plan about: {topic}

Requirements:
- Exactly 6 to 8 scenes and 105 to 145 spoken words total (about 40-60 seconds).
- Scene 1 is a curiosity-gap hook. Final scene lands a memorable payoff.
- Conversational narration only: no headings, stage directions, citations, or emoji.
- Every scene's visual_prompt describes a distinct, cinematic portrait 9:16 image.
- Images must contain no text, captions, logos, watermarks, UI, or brand marks.
- Prefer concrete visual metaphors, strong foreground/background separation, and variety.
- Do not invent precise claims. Phrase uncertain claims carefully.
"""


def generate_plan(client: OpenAI, topic: str, settings: Settings) -> VideoPlan:
    response = client.responses.parse(
        model=settings.script_model,
        input=[
            {"role": "system", "content": "You are an expert short-form documentary writer and visual director."},
            {"role": "user", "content": PLAN_PROMPT.format(topic=topic)},
        ],
        text_format=VideoPlan,
    )
    if not response.output_parsed:
        raise RuntimeError("The script model returned no parsed video plan.")
    return response.output_parsed


def generate_image(client: OpenAI, prompt: str, destination: Path, settings: Settings) -> None:
    response = client.images.generate(
        model=settings.image_model,
        prompt=(
            prompt
            + " Cinematic editorial photography, portrait composition, visually accurate, "
            + "rich depth, natural lighting, no text, no typography, no watermark, no logo."
        ),
        size="1024x1536",
        quality="medium",
        output_format="png",
    )
    item = response.data[0]
    if getattr(item, "b64_json", None):
        destination.write_bytes(base64.b64decode(item.b64_json))
        return
    raise RuntimeError("Image API returned no base64 image data.")


def generate_voiceover(client: OpenAI, text: str, destination: Path, settings: Settings) -> None:
    with client.audio.speech.with_streaming_response.create(
        model=settings.tts_model,
        voice=settings.voice,
        input=text,
        response_format="mp3",
    ) as response:
        response.stream_to_file(destination)


def transcribe_words(client: OpenAI, audio: Path, settings: Settings) -> list[WordTiming]:
    with audio.open("rb") as source:
        result = client.audio.transcriptions.create(
            model=settings.transcribe_model,
            file=source,
            response_format="verbose_json",
            timestamp_granularities=["word"],
        )
    words = getattr(result, "words", None) or []
    normalized = []
    for word in words:
        if hasattr(word, "model_dump"):
            word = word.model_dump()
        normalized.append(WordTiming.model_validate(word))
    if not normalized:
        raise RuntimeError("Transcription returned no word timestamps.")
    return normalized


def save_json(path: Path, value: object) -> None:
    if hasattr(value, "model_dump"):
        value = value.model_dump()
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding="utf-8")

