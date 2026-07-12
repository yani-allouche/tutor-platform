# Shorts Pipeline — Version 1

One topic in, one ready-to-publish 1080×1920 MP4 out.

## What it generates

- 40–60 second script and 6–8-scene shot list
- AI portrait visuals
- AI voiceover
- word-timed animated subtitles
- original procedural background music (no music license required)
- H.264/AAC MP4 with fast-start enabled

## Stack

- OpenAI Responses API: script + structured shot list (`gpt-5.6-luna`)
- OpenAI Images API: portrait visuals (`gpt-image-2`)
- OpenAI Audio API: voiceover (`tts-1-hd`)
- OpenAI transcription: word timestamps (`whisper-1`)
- FFmpeg: animation, subtitle burn-in, audio mix, MP4 export

All model IDs can be overridden in `.env` without code changes.

## Install (macOS)

From this folder:

```bash
brew install ffmpeg
make install
cp .env.example .env
```

Open `.env` and replace `sk-your-key-here` with your OpenAI API key.

Verify setup:

```bash
make check
```

## Generate the first video

```bash
make video TOPIC="Why IKEA is designed like a maze"
```

Final video:

```text
output/why-ikea-is-designed-like-a-maze/final.mp4
```

Or use the CLI directly:

```bash
.venv/bin/python -m shorts_pipeline.cli generate "Why IKEA is designed like a maze"
```

## Resume and regenerate

Every paid asset is cached under `output/<topic>/`. Rerun the same command to resume after a failure. To intentionally recreate everything:

```bash
.venv/bin/python -m shorts_pipeline.cli generate "Your topic" --force
```

## Output folder

```text
output/<topic>/
├── final.mp4
├── manifest.json
├── plan.json
├── script.txt
├── word-timings.json
└── assets/
    ├── scene-01.png ...
    ├── scene-01.jpg ...
    ├── voiceover.mp3
    ├── subtitles.ass
    ├── music.m4a
    └── visuals.mp4
```

## Notes

- API usage is billed by OpenAI. Image generation is normally the largest cost.
- AI voice disclosure may be required by the publishing platform or local law.
- Review factual claims and generated visuals before publishing.
- The generated music is synthesized locally and is not copied from a recording.

