from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from openai import OpenAI

from .config import ROOT, Settings, require_preflight, slugify
from .models import VideoPlan, WordTiming
from .openai_pipeline import generate_image, generate_plan, generate_voiceover, save_json, transcribe_words
from .render import duration, make_music, make_visual_track, normalize_image, render, write_ass


def generate(topic: str, output_root: Path, force: bool = False) -> Path:
    require_preflight()
    settings = Settings()
    client = OpenAI()
    work = output_root / slugify(topic)
    assets = work / "assets"
    assets.mkdir(parents=True, exist_ok=True)

    plan_path = work / "plan.json"
    if force or not plan_path.exists():
        print("[1/6] Writing script and shot list...")
        plan = generate_plan(client, topic, settings)
        save_json(plan_path, plan)
        (work / "script.txt").write_text(plan.script + "\n", encoding="utf-8")
    else:
        print("[1/6] Reusing script and shot list")
        plan = VideoPlan.model_validate_json(plan_path.read_text(encoding="utf-8"))

    images = []
    print("[2/6] Creating visuals...")
    for index, scene in enumerate(plan.scenes, 1):
        raw = assets / f"scene-{index:02d}.png"
        ready = assets / f"scene-{index:02d}.jpg"
        if force or not raw.exists():
            print(f"      scene {index}/{len(plan.scenes)}")
            generate_image(client, scene.visual_prompt, raw, settings)
        if force or not ready.exists():
            normalize_image(raw, ready, settings)
        images.append(ready)

    voiceover = assets / "voiceover.mp3"
    if force or not voiceover.exists():
        print("[3/6] Generating voiceover...")
        generate_voiceover(client, plan.script, voiceover, settings)
    else:
        print("[3/6] Reusing voiceover")
    seconds = duration(voiceover)
    if not 35 <= seconds <= 65:
        print(f"Warning: voiceover is {seconds:.1f}s (target: 40-60s).", file=sys.stderr)

    timings_path = work / "word-timings.json"
    if force or not timings_path.exists():
        print("[4/6] Timing animated subtitles...")
        timings = transcribe_words(client, voiceover, settings)
        save_json(timings_path, [item.model_dump() for item in timings])
    else:
        print("[4/6] Reusing subtitle timings")
        timings = [WordTiming.model_validate(item) for item in json.loads(timings_path.read_text())]
    subtitles = assets / "subtitles.ass"
    write_ass(timings, subtitles, settings)

    visual_track = assets / "visuals.mp4"
    music = assets / "music.m4a"
    if force or not visual_track.exists():
        print("[5/6] Animating scenes and creating original music...")
        make_visual_track(images, seconds, visual_track, settings)
    if force or not music.exists():
        make_music(seconds, music)

    final = work / "final.mp4"
    print("[6/6] Rendering final 9:16 MP4...")
    render(visual_track, voiceover, music, subtitles, final, seconds)
    manifest = {
        "topic": topic,
        "duration_seconds": round(seconds, 3),
        "resolution": f"{settings.width}x{settings.height}",
        "fps": settings.fps,
        "output": str(final.resolve()),
    }
    save_json(work / "manifest.json", manifest)
    print(f"Done: {final.resolve()}")
    return final


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a complete vertical short from one topic.")
    sub = parser.add_subparsers(dest="command", required=True)
    doctor = sub.add_parser("doctor", help="Check local dependencies and configuration")
    doctor.add_argument("--no-key", action="store_true", help="Do not require an API key")
    make = sub.add_parser("generate", help="Generate a ready-to-publish MP4")
    make.add_argument("topic")
    make.add_argument("--output", type=Path, default=ROOT / "output")
    make.add_argument("--force", action="store_true", help="Regenerate cached API assets")
    args = parser.parse_args()
    try:
        if args.command == "doctor":
            require_preflight(require_key=not args.no_key)
            print("Ready: FFmpeg, ffprobe, and configuration are available.")
        else:
            generate(args.topic, args.output, args.force)
    except (RuntimeError, ValueError) as error:
        parser.exit(1, f"Error: {error}\n")


if __name__ == "__main__":
    main()

