from shorts_pipeline.config import slugify
from shorts_pipeline.models import Scene, VideoPlan, WordTiming
from shorts_pipeline.render import ass_time, subtitle_chunks


def test_slugify():
    assert slugify("Why IKEA is designed like a maze") == "why-ikea-is-designed-like-a-maze"


def test_subtitle_chunks_are_short():
    words = [WordTiming(word=f"word{i}", start=i * 0.2, end=i * 0.2 + 0.15) for i in range(9)]
    assert [len(chunk) for chunk in subtitle_chunks(words)] == [4, 4, 1]


def test_ass_time():
    assert ass_time(65.37) == "0:01:05.37"


def test_plan_word_count_validation():
    narration = " ".join(["word"] * 18)
    plan = VideoPlan(
        title="Title",
        hook="Hook",
        scenes=[Scene(narration=narration, visual_prompt="A detailed cinematic portrait visual prompt") for _ in range(6)],
    )
    assert len(plan.script.split()) == 108

