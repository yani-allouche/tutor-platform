from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class Scene(BaseModel):
    narration: str = Field(min_length=10)
    visual_prompt: str = Field(min_length=20)


class VideoPlan(BaseModel):
    title: str
    hook: str
    scenes: list[Scene] = Field(min_length=6, max_length=8)

    @property
    def script(self) -> str:
        return " ".join(scene.narration.strip() for scene in self.scenes)

    @model_validator(mode="after")
    def validate_script_length(self) -> "VideoPlan":
        words = len(self.script.split())
        if not 105 <= words <= 145:
            raise ValueError(f"Script must contain 105-145 words, got {words}")
        return self


class WordTiming(BaseModel):
    word: str
    start: float
    end: float

