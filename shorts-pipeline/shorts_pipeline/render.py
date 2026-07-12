from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path

from PIL import Image

from .config import Settings
from .models import WordTiming


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(json.loads(result.stdout)["format"]["duration"])


def normalize_image(source: Path, destination: Path, settings: Settings) -> None:
    with Image.open(source) as image:
        image = image.convert("RGB")
        scale = max(settings.width / image.width, settings.height / image.height)
        resized = image.resize((math.ceil(image.width * scale), math.ceil(image.height * scale)), Image.Resampling.LANCZOS)
        left = (resized.width - settings.width) // 2
        top = (resized.height - settings.height) // 2
        resized.crop((left, top, left + settings.width, top + settings.height)).save(destination, quality=95)


def ass_time(seconds: float) -> str:
    centis = max(0, round(seconds * 100))
    return f"{centis // 360000}:{(centis // 6000) % 60:02d}:{(centis // 100) % 60:02d}.{centis % 100:02d}"


def ass_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")


def subtitle_chunks(words: list[WordTiming], max_words: int = 4) -> list[list[WordTiming]]:
    chunks, current = [], []
    for word in words:
        current.append(word)
        terminal = word.word.rstrip().endswith((".", "!", "?", ",", ":", ";"))
        if len(current) >= max_words or (terminal and len(current) >= 2):
            chunks.append(current)
            current = []
    if current:
        chunks.append(current)
    return chunks


def write_ass(words: list[WordTiming], destination: Path, settings: Settings) -> None:
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {settings.width}
PlayResY: {settings.height}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,72,&H00FFFFFF,&H0000FFFF,&H00101010,&H70000000,-1,0,0,0,100,100,0,0,1,7,2,2,80,80,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for chunk in subtitle_chunks(words):
        text = ass_escape(" ".join(item.word.strip() for item in chunk).upper())
        events.append(
            f"Dialogue: 0,{ass_time(chunk[0].start)},{ass_time(chunk[-1].end)},Default,,0,0,0,,"
            f"{{\\fad(80,80)\\t(0,120,\\fscx108\\fscy108)}}{text}"
        )
    destination.write_text(header + "\n".join(events) + "\n", encoding="utf-8")


def make_visual_track(images: list[Path], total_seconds: float, destination: Path, settings: Settings) -> None:
    scene_seconds = total_seconds / len(images)
    clips = []
    for index, image in enumerate(images):
        clip = destination.parent / f"clip-{index:02d}.mp4"
        frames = math.ceil(scene_seconds * settings.fps)
        zoom = "min(zoom+0.00055,1.10)" if index % 2 == 0 else "if(eq(on,1),1.10,max(zoom-0.00055,1.0))"
        run([
            "ffmpeg", "-y", "-loop", "1", "-i", str(image), "-vf",
            f"zoompan=z='{zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={settings.width}x{settings.height}:fps={settings.fps},format=yuv420p",
            "-t", f"{scene_seconds:.3f}", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", str(clip),
        ])
        clips.append(clip)
    concat = destination.parent / "clips.txt"
    concat.write_text("".join(f"file '{clip.name}'\n" for clip in clips), encoding="utf-8")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", str(destination)])


def make_music(seconds: float, destination: Path) -> None:
    # Original procedural ambient bed: three soft tones, no external music license required.
    graph = (
        "sine=f=110:r=44100,volume=0.035[a];"
        "sine=f=164.81:r=44100,volume=0.022[b];"
        "sine=f=220:r=44100,volume=0.015[c];"
        "[a][b][c]amix=inputs=3,lowpass=f=900,afade=t=in:st=0:d=2,"
        f"afade=t=out:st={max(0, seconds - 3):.3f}:d=3"
    )
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", graph, "-t", f"{seconds:.3f}", "-c:a", "aac", "-b:a", "192k", str(destination)])


def render(video: Path, voiceover: Path, music: Path, subtitles: Path, destination: Path, seconds: float) -> None:
    run([
        "ffmpeg", "-y", "-i", str(video), "-i", str(voiceover), "-i", str(music),
        "-filter_complex",
        f"[0:v]subtitles='{str(subtitles).replace(chr(39), chr(92)+chr(39))}'[v];"
        "[1:a]volume=1.0[voice];[2:a]volume=0.55[music];"
        "[voice][music]amix=inputs=2:duration=first:dropout_transition=2,alimiter=limit=0.95[a]",
        "-map", "[v]", "-map", "[a]", "-t", f"{seconds:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(destination),
    ])

