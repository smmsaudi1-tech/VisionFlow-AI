# ✂️ ملف كود ميزة المونتاج والكليبات (Clips & Montage Feature)

يحتوي هذا الملف على الكود الكامل لجميع الملفات المسؤلة عن قسم المونتاج والكليبات في مشروع **VisionFlow-AI** (مقسمة بين Backend و Frontend).

---

## 📁 هيكل الملفات المسؤول عن الميزة
```text
يوتيوب/
├── backend/
│   ├── models/
│   │   └── montage_schemas.py      # Pydantic Schemas للـ API
│   ├── services/
│   │   ├── clip_cutter.py          # خدمة تحميل وقص الفيديو بـ FFmpeg
│   │   └── montage_analyzer.py     # خط المعالجة الرئيسي للـ clips
│   ├── routers/
│   │   └── montage.py              # مسارات FastAPI للـ Montage
│   └── state_montage.py            # إدارة حالة الجوبز في الذاكرة (In-memory state)
│
└── frontend/
    ├── app/
    │   └── montage/
    │       ├── layout.tsx          # تخطيط الصفحة و الـ Metadata
    │       └── page.tsx            # واجهة المونتاج الرئيسية
    └── components/
        └── montage/
            ├── MontageInput.tsx    # مربع الإدخال (رابط أو ملف) والبريف واللغة
            ├── ClipCard.tsx        # بطاقة عرض الكليب والتقييمات ونص التفريغ
            └── ScoreBar.tsx        # شريط تقييم المؤشرات (Hook, Story, Payoff)
```

---

## 🐍 Backend Code

### 1. [backend/models/montage_schemas.py](file:///c:/Users/youse/OneDrive/Desktop/يوتيوب/backend/models/montage_schemas.py)
```python
"""
Pydantic Schemas for Montage (Clip Detection) API
Completely separate from main VisionFlow schemas.
"""
from pydantic import BaseModel
from typing import Optional, List


# --- Request ---
class MontageAnalyzeRequest(BaseModel):
    url: Optional[str] = None          # YouTube / podcast / stream URL
    language: Optional[str] = "auto"   # auto | ar | en | ...
    brief: Optional[str] = None        # Campaign brief text (from PDF/TXT upload)
    min_clip_duration: Optional[int] = 20   # seconds
    max_clip_duration: Optional[int] = 90   # seconds
    max_clips: Optional[int] = 10           # max number of clips to return


# --- Job State ---
class MontageJobResponse(BaseModel):
    job_id: str
    status: str   # queued | processing | done | failed
    message: str


class MontageStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int        # 0-100
    message: str
    stage: str           # download | transcribe | analyze | cut | done
    total_clips: Optional[int] = None
    error: Optional[str] = None


# --- Clip Scores ---
class ClipScore(BaseModel):
    hook: int          # 0-10 — strength of opening line
    story: int         # 0-10 — narrative coherence
    payoff: int        # 0-10 — clarity of conclusion
    virality: int      # 0-100 — composite virality score


# --- Single Clip Result ---
class ClipResult(BaseModel):
    clip_id: str
    job_id: str
    index: int                         # 1-based
    title: str                         # AI-written on-screen title
    start: float                       # seconds in source video
    end: float                         # seconds in source video
    duration: float                    # end - start
    transcript: str                    # text of this segment
    scores: ClipScore
    download_url: str                  # /api/montage/download/{job_id}/{clip_id}
    language: str


# --- Clips Response ---
class MontageClipsResponse(BaseModel):
    job_id: str
    total: int
    clips: List[ClipResult]
```

---

### 2. [backend/state_montage.py](file:///c:/Users/youse/OneDrive/Desktop/يوتيوب/backend/state_montage.py)
```python
"""
In-memory job store for Montage (clip detection) pipeline.
Completely separate from the main VisionFlow state.py.
"""
import asyncio
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

# job_id → dict
_montage_jobs: dict[str, dict] = {}


def create_montage_job(job_id: str, data: dict) -> None:
    _montage_jobs[job_id] = {"created_at": time.time(), **data}


def get_montage_job(job_id: str) -> Optional[dict]:
    return _montage_jobs.get(job_id)


def update_montage_job(job_id: str, updates: dict) -> None:
    if job_id in _montage_jobs:
        _montage_jobs[job_id].update(updates)


def delete_montage_job(job_id: str) -> None:
    _montage_jobs.pop(job_id, None)


async def start_montage_cleanup_loop():
    """Remove montage jobs older than 2 hours"""
    while True:
        await asyncio.sleep(3600)
        now = time.time()
        for jid in list(_montage_jobs.keys()):
            if now - _montage_jobs[jid].get("created_at", now) > 7200:
                del _montage_jobs[jid]
        logger.info(f"[Montage] Cleanup done. Active jobs: {len(_montage_jobs)}")
```

---

### 3. [backend/services/clip_cutter.py](file:///c:/Users/youse/OneDrive/Desktop/يوتيوب/backend/services/clip_cutter.py)
```python
"""
Clip Cutter Service — uses FFmpeg to cut clips from a source video.
Part of the Montage pipeline. Independent from main ffmpeg.py render service.
"""
import asyncio
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

FFMPEG = os.getenv("FFMPEG_PATH", "ffmpeg")
MONTAGE_OUTPUT_DIR = Path(os.getenv("MONTAGE_OUTPUT_DIR", "/tmp/montage_outputs"))


async def cut_clip(
    source_path: str,
    start: float,
    end: float,
    out_path: str,
    vertical_crop: bool = True,
) -> Optional[str]:
    """
    Cut a single clip from source_path [start, end] seconds.
    If vertical_crop=True, applies a center crop to 9:16 aspect ratio.
    Returns out_path on success, None on failure.
    """
    duration = end - start

    if vertical_crop:
        # Center-crop to 9:16 without face tracking (Phase 1)
        # Takes the center vertical strip of the video
        vf = (
            "scale=iw*min(1080/iw\\,1920/ih):ih*min(1080/iw\\,1920/ih),"
            "crop=1080:1920:(iw-1080)/2:(ih-1920)/2,"
            "scale=1080:1920"
        )
    else:
        vf = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"

    cmd = [
        FFMPEG, "-y",
        "-ss", str(start),
        "-i", source_path,
        "-t", str(duration),
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        out_path,
    ]

    try:
        await _run_ffmpeg(cmd, timeout=300)
        if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
            return out_path
    except Exception as e:
        logger.warning(f"[ClipCutter] Failed to cut clip {start:.1f}-{end:.1f}: {e}")
    return None


async def download_video_audio(url: str, out_dir: Path, job_id: str) -> Optional[str]:
    """
    Download a video from URL using yt-dlp.
    Returns path to downloaded video file, or None on failure.
    Includes SSL bypass flags needed for HuggingFace Spaces.
    """
    out_template = str(out_dir / "source.%(ext)s")

    # Multiple format attempts: best → fallback mp4 → worst
    format_attempts = [
        "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best[height<=720]",
        "best[ext=mp4]/best",
        "worst",
    ]

    base_flags = [
        "yt-dlp",
        "--no-playlist",
        "--merge-output-format", "mp4",
        "-o", out_template,
        "--no-warnings",
        "--no-check-certificate",          # bypass SSL verification
        "--prefer-insecure",               # HTTP fallback
        "--legacy-server-connect",         # fixes EOF SSL on some servers
        "--retries", "3",
        "--fragment-retries", "3",
        "--socket-timeout", "30",
    ]

    for fmt in format_attempts:
        cmd = base_flags + ["--format", fmt, url]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)
            if proc.returncode == 0:
                for f in out_dir.glob("source.*"):
                    if f.suffix in (".mp4", ".mkv", ".webm", ".mov"):
                        logger.info(f"[{job_id}] Video downloaded: {f} (format={fmt})")
                        return str(f)
            else:
                err_text = stderr.decode()[-300:]
                logger.warning(f"[{job_id}] yt-dlp attempt failed (fmt={fmt}): {err_text}")
        except asyncio.TimeoutError:
            logger.error(f"[{job_id}] yt-dlp timed out (fmt={fmt})")
        except Exception as e:
            logger.error(f"[{job_id}] yt-dlp error (fmt={fmt}): {e}")

    return None



async def download_audio_only(url: str, out_dir: Path, job_id: str) -> Optional[str]:
    """
    Download audio only (WAV) for transcription — faster than full video.
    Includes SSL bypass flags needed for HuggingFace Spaces.
    """
    out_path = str(out_dir / "audio.wav")
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "-x",
        "--audio-format", "wav",
        "--audio-quality", "0",
        "-o", out_path,
        "--no-warnings",
        "--no-check-certificate",
        "--prefer-insecure",
        "--legacy-server-connect",
        "--retries", "3",
        "--socket-timeout", "30",
        url,
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)
        if proc.returncode == 0 and os.path.exists(out_path):
            logger.info(f"[{job_id}] Audio downloaded: {out_path}")
            return out_path
        else:
            logger.warning(f"[{job_id}] Audio download failed: {stderr.decode()[-200:]}")
    except asyncio.TimeoutError:
        logger.error(f"[{job_id}] Audio download timed out")
    except Exception as e:
        logger.error(f"[{job_id}] Audio download error: {e}")
    return None


def get_job_dir(job_id: str) -> Path:
    """Return (and create) the output directory for a montage job."""
    d = MONTAGE_OUTPUT_DIR / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d


async def _run_ffmpeg(cmd: list[str], timeout: int = 300) -> None:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        if proc.returncode != 0:
            logger.warning(f"[ClipCutter FFmpeg] {stderr.decode()[-400:]}")
    except asyncio.TimeoutError:
        proc.kill()
        raise RuntimeError(f"FFmpeg timed out after {timeout}s")
```

---

### 4. [backend/services/montage_analyzer.py](file:///c:/Users/youse/OneDrive/Desktop/يوتيوب/backend/services/montage_analyzer.py)
```python
"""
Montage Analyzer — Full Pipeline
1. Download audio with yt-dlp
2. Transcribe with faster-whisper
3. Score moments with Gemini AI
4. Cut clip files with FFmpeg
Returns list of ClipResult dicts.
"""
import asyncio
import logging
import os
import uuid
from pathlib import Path
from typing import Optional

from services.clip_cutter import (
    download_audio_only,
    download_video_audio,
    cut_clip,
    get_job_dir,
)
from services.gemini import generate_json
from services.whisper_service import whisper_service
from state_montage import update_montage_job

logger = logging.getLogger(__name__)


# ── Helper for Youtube timestamp link ─────────────────────────────────────────
def _build_youtube_timestamp_url(url: str, seconds: int) -> str:
    """Helper to format a YouTube URL with a specific start time in seconds."""
    import re
    m = re.search(r"(?:v=|youtu\.be/|shorts/)([a-zA-Z0-9_-]{11})", url)
    if m:
        video_id = m.group(1)
        return f"https://youtube.com/watch?v={video_id}&t={seconds}s"
    return url


# ── Main entry ─────────────────────────────────────────────────────────────────

async def run_montage_pipeline(
    job_id: str,
    url: Optional[str] = None,
    uploaded_file_path: Optional[str] = None,
    language: str = "auto",
    brief: Optional[str] = None,
    min_clip_duration: int = 20,
    max_clip_duration: int = 90,
    max_clips: int = 10,
) -> None:
    """
    Background task — runs the full montage pipeline and stores results in state.
    """
    job_dir = get_job_dir(job_id)

    def progress(stage: str, pct: int, msg: str):
        update_montage_job(job_id, {
            "status": "processing",
            "stage": stage,
            "progress": pct,
            "message": msg,
        })
        logger.info(f"[{job_id}] [{pct}%] {stage}: {msg}")

    try:
        # ── Step 1: Get video + transcript (in parallel for YT URLs) ──────────
        progress("download", 5, "جاري تحميل الفيديو...")

        video_path: Optional[str] = None
        segments: list = []
        full_text: str = ""
        detected_lang: str = language if language != "auto" else "ar"

        if uploaded_file_path and os.path.exists(uploaded_file_path):
            video_path = uploaded_file_path
            logger.info(f"[{job_id}] Using uploaded file: {video_path}")

        elif url:
            is_youtube = any(x in url for x in ("youtube.com", "youtu.be"))

            # For YouTube: get transcript first (works on HF, no download needed)
            if is_youtube:
                progress("transcribe", 10, "جاري جلب التفريغ من يوتيوب...")
                yt_segments, yt_text, yt_lang = await _try_youtube_transcript_api(url, language)
                if yt_segments:
                    segments = yt_segments
                    full_text = yt_text
                    detected_lang = yt_lang
                    logger.info(
                        f"[{job_id}] Got {len(segments)} segments from YouTube Transcript API"
                    )

            # Try video download (may fail on HuggingFace due to YouTube blocks)
            progress("download", 15, "محاولة تحميل الفيديو للقص...")
            video_path = await download_video_audio(url, job_dir, job_id)

            if not video_path:
                if segments:
                    # We have transcript — continue in transcript-only mode
                    logger.warning(
                        f"[{job_id}] Video download failed, continuing in transcript-only mode"
                    )
                    progress("analyze", 20, "التفريغ جاهز — جاري تحليل اللحظات...")
                else:
                    raise RuntimeError(
                        "فشل تحميل الفيديو — جرب رفع الملف مباشرة بدل الرابط"
                    )
        else:
            raise RuntimeError("لازم تبعت رابط أو ملف فيديو")

        # ── Step 2: Transcribe (if we don't have segments yet) ────────────────
        if not segments:
            progress("transcribe", 25, "جاري تفريغ الصوت بـ Whisper...")
            lang_arg = None if language == "auto" else language
            transcript_data = await whisper_service.transcribe(video_path, language=lang_arg)
            segments = transcript_data.get("segments", [])
            full_text = transcript_data.get("text", "")
            detected_lang = transcript_data.get("language", language)
        else:
            progress("transcribe", 30, f"تم التفريغ — {len(segments)} مقطع")

        if not segments:
            raise RuntimeError("مفيش كلام اتلقى في الفيديو — جرب فيديو تاني")

        logger.info(f"[{job_id}] Transcribed {len(segments)} segments, lang={detected_lang}")


        # ── Step 3: Score moments with Gemini ──────────────────────────────────
        progress("analyze", 45, "الذكاء الاصطناعي بيلاقي أحسن اللحظات...")

        scored_clips = await _score_moments_with_gemini(
            segments=segments,
            full_text=full_text,
            brief=brief,
            min_dur=min_clip_duration,
            max_dur=max_clip_duration,
            max_clips=max_clips,
            language=detected_lang,
        )

        if not scored_clips:
            raise RuntimeError("مش لاقي لحظات تستاهل النشر — جرب فيديو أطول أو أغنى بمحتوى")

        logger.info(f"[{job_id}] Gemini selected {len(scored_clips)} clips")

        # ── Step 4: Cut clips (or build virtual YouTube links) ────────────────
        progress("cut", 65, f"بيجهّز {len(scored_clips)} كليب...")

        results = []
        source_url = url  # may be None for uploads

        for i, clip_info in enumerate(scored_clips):
            clip_id = str(uuid.uuid4())[:8]
            pct = 65 + int((i + 1) / len(scored_clips) * 25)

            if video_path:
                # ── Real FFmpeg cut ────────────────────────────────────────────
                out_path = str(job_dir / f"clip_{i+1:02d}_{clip_id}.mp4")
                cut_result = await cut_clip(
                    source_path=video_path,
                    start=clip_info["start"],
                    end=clip_info["end"],
                    out_path=out_path,
                    vertical_crop=True,
                )
                progress("cut", pct, f"قص الكليب {i+1}/{len(scored_clips)}...")

                if cut_result:
                    results.append({
                        "clip_id": clip_id,
                        "job_id": job_id,
                        "index": i + 1,
                        "title": clip_info.get("title", f"كليب {i+1}"),
                        "start": clip_info["start"],
                        "end": clip_info["end"],
                        "duration": clip_info["end"] - clip_info["start"],
                        "transcript": clip_info.get("transcript", ""),
                        "scores": {
                            "hook": clip_info.get("hook", 7),
                            "story": clip_info.get("story", 7),
                            "payoff": clip_info.get("payoff", 7),
                            "virality": clip_info.get("virality", 70),
                        },
                        "download_url": f"/api/montage/download/{job_id}/{clip_id}",
                        "file_path": out_path,
                        "youtube_url": None,
                        "language": detected_lang,
                        "mode": "video",
                    })
                else:
                    logger.warning(f"[{job_id}] Clip {i+1} cutting failed, skipping")
            else:
                # ── Transcript-only mode: YouTube deep-link ────────────────────
                yt_link = _build_youtube_timestamp_url(source_url or "", int(clip_info["start"]))
                progress("cut", pct, f"جهّز الكليب {i+1}/{len(scored_clips)} (وضع التحليل)...")
                results.append({
                    "clip_id": clip_id,
                    "job_id": job_id,
                    "index": i + 1,
                    "title": clip_info.get("title", f"كليب {i+1}"),
                    "start": clip_info["start"],
                    "end": clip_info["end"],
                    "duration": clip_info["end"] - clip_info["start"],
                    "transcript": clip_info.get("transcript", ""),
                    "scores": {
                        "hook": clip_info.get("hook", 7),
                        "story": clip_info.get("story", 7),
                        "payoff": clip_info.get("payoff", 7),
                        "virality": clip_info.get("virality", 70),
                    },
                    "download_url": "",
                    "file_path": None,
                    "youtube_url": yt_link,
                    "language": detected_lang,
                    "mode": "transcript",
                })

        if not results:
            raise RuntimeError("مفيش كليبات — تأكد من إن الفيديو فيه كلام واضح")

        # Sort by virality descending
        results.sort(key=lambda c: c["scores"]["virality"], reverse=True)

        # Determine mode for user message
        modes = {c.get("mode", "video") for c in results}
        is_transcript_mode = modes == {"transcript"}
        msg = (
            f"✅ {len(results)} كليب جاهز — افتح كل كليب على يوتيوب بضغطة!"
            if is_transcript_mode
            else f"✅ {len(results)} كليب جاهز للتحميل!"
        )

        # ── Done ───────────────────────────────────────────────────────────────
        update_montage_job(job_id, {
            "status": "done",
            "stage": "done",
            "progress": 100,
            "message": msg,
            "clips": results,
            "total_clips": len(results),
            "detected_language": detected_lang,
            "transcript_only": is_transcript_mode,
        })
        logger.info(f"[{job_id}] Pipeline done: {len(results)} clips (mode={'transcript' if is_transcript_mode else 'video'})")

    except Exception as e:
        logger.error(f"[{job_id}] Pipeline failed: {e}", exc_info=True)
        update_montage_job(job_id, {
            "status": "failed",
            "stage": "error",
            "progress": 0,
            "message": f"فشل التشغيل: {str(e)}",
            "error": str(e),
        })


# ── YouTube Transcript API Helper ─────────────────────────────────────────────

async def _try_youtube_transcript_api(
    url: str,
    language: str = "auto",
) -> tuple[list, str, str]:
    """
    Try to get transcript from YouTube Transcript API (no download needed).
    Returns (segments, full_text, detected_lang) — empty list on failure.
    """
    import re

    def _extract_video_id(u: str):
        m = re.search(r"(?:v=|youtu\.be/|shorts/)([a-zA-Z0-9_-]{11})", u)
        return m.group(1) if m else None

    video_id = _extract_video_id(url)
    if not video_id:
        return [], "", language

    def _fetch_sync():
        from youtube_transcript_api import YouTubeTranscriptApi
        # Try requested language first, then common ones
        lang_priority = []
        if language and language != "auto":
            lang_priority.append([language])
        lang_priority += [["ar"], ["en"], ["ar-SA"], ["ar-EG"]]

        for langs in lang_priority:
            try:
                entries = YouTubeTranscriptApi.get_transcript(video_id, languages=langs)
                segs = [
                    {
                        "start": round(e["start"], 2),
                        "end": round(e["start"] + e["duration"], 2),
                        "text": e["text"].strip(),
                    }
                    for e in entries
                    if e.get("text", "").strip()
                ]
                full = " ".join(s["text"] for s in segs)
                detected = langs[0] if langs else "ar"
                return segs, full, detected
            except Exception:
                continue

        # Try without language filter (gets auto-generated)
        try:
            entries = YouTubeTranscriptApi.get_transcript(video_id)
            segs = [
                {
                    "start": round(e["start"], 2),
                    "end": round(e["start"] + e["duration"], 2),
                    "text": e["text"].strip(),
                }
                for e in entries
                if e.get("text", "").strip()
            ]
            full = " ".join(s["text"] for s in segs)
            return segs, full, "auto"
        except Exception:
            return [], "", language

    try:
        return await asyncio.to_thread(_fetch_sync)
    except Exception as e:
        logger.warning(f"YouTube Transcript API failed for {video_id}: {e}")
        return [], "", language


# ── Gemini Scoring ─────────────────────────────────────────────────────────────

async def _score_moments_with_gemini(
    segments: list[dict],
    full_text: str,
    brief: Optional[str],
    min_dur: int,
    max_dur: int,
    max_clips: int,
    language: str,
) -> list[dict]:
    """
    Ask Gemini to identify the best moments in the transcript and score them.
    Returns a list of clip dicts with start/end/title/scores.
    """

    # Build a compact transcript for the prompt
    # Format: [start-end] text
    compact = []
    for seg in segments:
        compact.append(f"[{seg['start']:.1f}-{seg['end']:.1f}] {seg['text']}")
    transcript_str = "\n".join(compact[:800])  # limit context

    brief_section = ""
    if brief:
        brief_section = f"\n\nCAMPAIGN BRIEF (prioritize moments that serve this):\n{brief[:500]}"

    prompt = f"""You are an expert short-form video editor. Analyze this transcript and find the {max_clips} BEST moments to turn into viral short clips.

TRANSCRIPT (format: [start_seconds-end_seconds] text):
{transcript_str}
{brief_section}

RULES:
1. Each clip MUST be {min_dur}-{max_dur} seconds long
2. Clips MUST start and end on complete sentences — never mid-sentence
3. Each clip needs a strong hook (first sentence grabs attention), a coherent story, and a clear payoff/conclusion
4. Score every clip independently (don't normalize relative to each other)
5. Write titles in the SAME language as the transcript (detected: {language})
6. If a campaign brief is provided, prioritize moments that serve it

Return ONLY valid JSON (no markdown):
{{
  "clips": [
    {{
      "start": 12.5,
      "end": 45.2,
      "title": "Short punchy on-screen title (max 8 words)",
      "transcript": "Exact text of this segment",
      "hook": 8,
      "story": 7,
      "payoff": 9,
      "virality": 82,
      "reason": "One sentence why this clip is viral-worthy"
    }}
  ]
}}

Return {max_clips} clips maximum. Quality over quantity — only include clips scoring virality >= 55."""

    try:
        result = await generate_json(prompt, max_tokens=4096)
        clips = result.get("clips", [])

        # Validate and clean up
        valid_clips = []
        for c in clips:
            start = float(c.get("start", 0))
            end = float(c.get("end", 0))
            duration = end - start
            if duration < min_dur or duration > max_dur:
                continue
            if end <= start:
                continue
            valid_clips.append({
                "start": start,
                "end": end,
                "title": str(c.get("title", ""))[:80],
                "transcript": str(c.get("transcript", "")),
                "hook": max(0, min(10, int(c.get("hook", 7)))),
                "story": max(0, min(10, int(c.get("story", 7)))),
                "payoff": max(0, min(10, int(c.get("payoff", 7)))),
                "virality": max(0, min(100, int(c.get("virality", 70)))),
            })

        # Sort by virality, take top max_clips
        valid_clips.sort(key=lambda x: x["virality"], reverse=True)
        return valid_clips[:max_clips]

    except Exception as e:
        logger.error(f"Gemini scoring failed: {e}")
        # Fallback: create chunks from segments
        return _fallback_chunk_segments(segments, min_dur, max_dur, max_clips)


def _fallback_chunk_segments(
    segments: list[dict],
    min_dur: int,
    max_dur: int,
    max_clips: int,
) -> list[dict]:
    """Simple fallback: chunk segments into clips without AI scoring."""
    clips = []
    chunk_start = None
    chunk_texts = []
    chunk_segs = []

    for seg in segments:
        if chunk_start is None:
            chunk_start = seg["start"]

        chunk_texts.append(seg["text"])
        chunk_segs.append(seg)
        current_dur = seg["end"] - chunk_start

        if current_dur >= min_dur:
            clips.append({
                "start": chunk_start,
                "end": seg["end"],
                "title": chunk_texts[0][:60] if chunk_texts else "كليب",
                "transcript": " ".join(chunk_texts),
                "hook": 6,
                "story": 6,
                "payoff": 6,
                "virality": 60,
            })
            chunk_start = None
            chunk_texts = []
            chunk_segs = []

            if len(clips) >= max_clips:
                break

    return clips
```

---

### 5. [backend/routers/montage.py](file:///c:/Users/youse/OneDrive/Desktop/يوتيوب/backend/routers/montage.py)
```python
"""
Montage Router — Clip Detection & Cutting API
Prefix: /api/montage
Completely separate from existing VisionFlow routers.
"""
import logging
import os
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import Optional

from models.montage_schemas import (
    MontageAnalyzeRequest,
    MontageJobResponse,
    MontageStatusResponse,
    MontageClipsResponse,
    ClipResult,
    ClipScore,
)
from state_montage import create_montage_job, get_montage_job, update_montage_job
from services.clip_cutter import get_job_dir, MONTAGE_OUTPUT_DIR
from services.montage_analyzer import run_montage_pipeline

router = APIRouter(prefix="/api/montage", tags=["Montage"])
logger = logging.getLogger(__name__)

# Temp upload dir
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/tmp/montage_uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ── Analyze from URL ───────────────────────────────────────────────────────────

@router.post("/analyze", response_model=MontageJobResponse)
async def analyze_from_url(
    request: MontageAnalyzeRequest,
    background_tasks: BackgroundTasks,
):
    """Start clip detection from a video URL (YouTube, podcast, stream, etc.)"""
    if not request.url:
        raise HTTPException(status_code=400, detail="URL مطلوب")

    job_id = str(uuid.uuid4())
    create_montage_job(job_id, {
        "status": "queued",
        "stage": "queued",
        "progress": 0,
        "message": "في الطابور...",
        "url": request.url,
        "language": request.language,
        "clips": [],
        "total_clips": 0,
    })

    background_tasks.add_task(
        run_montage_pipeline,
        job_id=job_id,
        url=request.url,
        language=request.language or "auto",
        brief=request.brief,
        min_clip_duration=request.min_clip_duration or 20,
        max_clip_duration=request.max_clip_duration or 90,
        max_clips=request.max_clips or 10,
    )

    return MontageJobResponse(
        job_id=job_id,
        status="queued",
        message="جاري البدء... هيرجعلك الكليبات لما يخلص",
    )


# ── Analyze from Upload ────────────────────────────────────────────────────────

@router.post("/analyze/upload", response_model=MontageJobResponse)
async def analyze_from_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: str = Form("auto"),
    brief: Optional[str] = Form(None),
    min_clip_duration: int = Form(20),
    max_clip_duration: int = Form(90),
    max_clips: int = Form(10),
):
    """Start clip detection from an uploaded video file."""
    # Validate extension
    allowed = {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"}
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"نوع الملف مش مدعوم. المسموح: {', '.join(allowed)}"
        )

    job_id = str(uuid.uuid4())
    job_dir = get_job_dir(job_id)

    # Save uploaded file
    upload_path = str(job_dir / f"upload{ext}")
    with open(upload_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    logger.info(f"[{job_id}] File uploaded: {upload_path} ({os.path.getsize(upload_path)} bytes)")

    create_montage_job(job_id, {
        "status": "queued",
        "stage": "queued",
        "progress": 0,
        "message": "في الطابور...",
        "uploaded_file": upload_path,
        "language": language,
        "clips": [],
        "total_clips": 0,
    })

    background_tasks.add_task(
        run_montage_pipeline,
        job_id=job_id,
        uploaded_file_path=upload_path,
        language=language,
        brief=brief,
        min_clip_duration=min_clip_duration,
        max_clip_duration=max_clip_duration,
        max_clips=max_clips,
    )

    return MontageJobResponse(
        job_id=job_id,
        status="queued",
        message="تم رفع الملف — جاري التحليل...",
    )


# ── Status Polling ─────────────────────────────────────────────────────────────

@router.get("/status/{job_id}", response_model=MontageStatusResponse)
async def get_status(job_id: str):
    """Poll job status. Frontend polls every 3-5 seconds."""
    job = get_montage_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job مش موجود")

    return MontageStatusResponse(
        job_id=job_id,
        status=job.get("status", "queued"),
        progress=job.get("progress", 0),
        message=job.get("message", "..."),
        stage=job.get("stage", "queued"),
        total_clips=job.get("total_clips"),
        error=job.get("error"),
    )


# ── Get Clips ──────────────────────────────────────────────────────────────────

@router.get("/clips/{job_id}", response_model=MontageClipsResponse)
async def get_clips(job_id: str):
    """Get all scored clip results for a completed job."""
    job = get_montage_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job مش موجود")

    if job.get("status") != "done":
        raise HTTPException(
            status_code=400,
            detail=f"الجوب لسه مش خلص — حالته الحالية: {job.get('status', 'processing')}"
        )

    raw_clips = job.get("clips", [])
    clips = []
    for c in raw_clips:
        scores_raw = c.get("scores", {})
        clips.append(ClipResult(
            clip_id=c["clip_id"],
            job_id=job_id,
            index=c["index"],
            title=c["title"],
            start=c["start"],
            end=c["end"],
            duration=c["duration"],
            transcript=c["transcript"],
            scores=ClipScore(
                hook=scores_raw.get("hook", 7),
                story=scores_raw.get("story", 7),
                payoff=scores_raw.get("payoff", 7),
                virality=scores_raw.get("virality", 70),
            ),
            download_url=c["download_url"],
            language=c.get("language", ""),
        ))

    return MontageClipsResponse(
        job_id=job_id,
        total=len(clips),
        clips=clips,
    )


# ── Download Clip ──────────────────────────────────────────────────────────────

@router.get("/download/{job_id}/{clip_id}")
async def download_clip(job_id: str, clip_id: str):
    """Download a specific clip MP4 file."""
    job = get_montage_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job مش موجود")

    clips = job.get("clips", [])
    target = next((c for c in clips if c["clip_id"] == clip_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="الكليب مش موجود")

    file_path = target.get("file_path", "")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="ملف الكليب مش موجود — ربما اتمسح")

    filename = f"clip_{target['index']:02d}_{job_id[:8]}.mp4"
    return FileResponse(
        path=file_path,
        media_type="video/mp4",
        filename=filename,
    )
```

---

## 💻 Frontend Code (TypeScript & CSS)

### 6. [frontend/app/montage/layout.tsx](file:///c:/Users/youse/OneDrive/Desktop/يوتيوب/frontend/app/montage/layout.tsx)
```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "مونتاج — كليبات جاهزة للنشر | VisionFlow-AI",
  description:
    "الصق رابط فيديو أو ارفع ملف — الذكاء الاصطناعي يلاقي أحسن اللحظات، يقيّمها، ويقصّها كليبات عمودية جاهزة للنشر.",
  keywords: [
    "مونتاج تلقائي",
    "كليبات قصيرة",
    "يوتيوب شورتس",
    "تيك توك",
    "ذكاء اصطناعي",
    "clip detection",
  ],
};

export default function MontageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

---

### 7. [frontend/app/montage/page.tsx](file:///c:/Users/youse/OneDrive/Desktop/يوتيوب/frontend/app/montage/page.tsx)
```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Scissors,
  Lightning,
  Star,
  ArrowLeft,
  Spinner,
  CheckCircle,
  XCircle,
  SortAscending,
} from "@phosphor-icons/react";
import MontageInput from "@/components/montage/MontageInput";
import ClipCard from "@/components/montage/ClipCard";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClipScores {
  hook: number;
  story: number;
  payoff: number;
  virality: number;
}

interface Clip {
  clip_id: string;
  job_id: string;
  index: number;
  title: string;
  start: number;
  end: number;
  duration: number;
  transcript: string;
  scores: ClipScores;
  download_url: string;
  language: string;
}

interface JobStatus {
  status: "queued" | "processing" | "done" | "failed";
  progress: number;
  message: string;
  stage: string;
  total_clips?: number;
  error?: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://yousef891238-088098.hf.space";

const STAGE_LABELS: Record<string, string> = {
  queued: "في الطابور...",
  download: "⬇️ جاري تحميل الفيديو",
  transcribe: "🎙 جاري تفريغ الصوت",
  analyze: "🧠 الذكاء الاصطناعي بيلاقي اللحظات",
  cut: "✂️ جاري قص الكليبات",
  done: "✅ خلص!",
  error: "❌ فشل",
};

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressDisplay({ status }: { status: JobStatus }) {
  return (
    <div className="glass-card p-6 max-w-2xl mx-auto text-right">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-zinc-300 font-medium">
          {STAGE_LABELS[status.stage] || status.message}
        </span>
        {status.status === "processing" && (
          <Spinner size={18} className="text-violet-400 animate-spin" />
        )}
        {status.status === "done" && (
          <CheckCircle size={18} className="text-green-400" weight="fill" />
        )}
        {status.status === "failed" && (
          <XCircle size={18} className="text-red-400" weight="fill" />
        )}
      </div>

      {status.status !== "failed" && (
        <div className="progress-bar mb-3">
          <div
            className="progress-fill transition-all duration-500"
            style={{ width: `${status.progress}%` }}
          />
        </div>
      )}

      <p className="text-xs text-zinc-500">{status.message}</p>

      {status.status === "failed" && status.error && (
        <p className="mt-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-3 border border-red-500/20">
          {status.error}
        </p>
      )}
    </div>
  );
}

// ── Sort control ──────────────────────────────────────────────────────────────
type SortKey = "virality" | "hook" | "story" | "payoff" | "duration";

function sortClips(clips: Clip[], key: SortKey): Clip[] {
  return [...clips].sort((a, b) => {
    if (key === "duration") return b.duration - a.duration;
    return b.scores[key] - a.scores[key];
  });
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MontagePage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("virality");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Polling ────────────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/montage/status/${id}`);
      if (!res.ok) return;
      const data: JobStatus = await res.json();
      setJobStatus(data);

      if (data.status === "done") {
        stopPolling();
        // Fetch clips
        const clipRes = await fetch(`${API_BASE}/api/montage/clips/${id}`);
        if (clipRes.ok) {
          const clipData = await clipRes.json();
          setClips(clipData.clips || []);
        }
      } else if (data.status === "failed") {
        stopPolling();
      }
    } catch {
      // network hiccup — keep polling
    }
  }, []);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    if (!jobId) return;
    stopPolling();
    fetchStatus(jobId);
    pollingRef.current = setInterval(() => fetchStatus(jobId), 4000);
    return () => stopPolling();
  }, [jobId, fetchStatus]);

  const handleJobStart = (id: string) => {
    setClips([]);
    setJobStatus({
      status: "queued",
      progress: 0,
      message: "في الطابور...",
      stage: "queued",
    });
    setJobId(id);
  };

  const handleReset = () => {
    stopPolling();
    setJobId(null);
    setJobStatus(null);
    setClips([]);
  };

  const sortedClips = sortClips(clips, sortBy);
  const isProcessing =
    jobStatus && jobStatus.status !== "done" && jobStatus.status !== "failed";

  return (
    <main className="min-h-[100dvh] overflow-x-hidden relative">
      {/* Background orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 w-[350px] h-[350px] bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 h-16 border-b border-white/5 bg-[#0A0A0F]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Back to home */}
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ArrowLeft size={14} />
              الرئيسية
            </Link>
          </div>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-orange-500 flex items-center justify-center">
              <Scissors size={16} weight="fill" className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">مونتاج</span>
            <span className="text-zinc-600 text-sm">by VisionFlow</span>
          </div>

          {/* New session */}
          {jobId && (
            <button
              onClick={handleReset}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors border border-white/10 px-3 py-1.5 rounded-lg hover:border-white/20"
            >
              تشغيلة جديدة
            </button>
          )}
        </div>
      </nav>

      {/* Content */}
      <div className="pt-24 pb-16 px-4">
        {/* ── IDLE STATE ── */}
        {!jobId && (
          <>
            {/* Hero */}
            <section className="max-w-3xl mx-auto text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs font-semibold mb-6">
                <Star size={14} weight="fill" />
                قسم المونتاج — مدعوم بالذكاء الاصطناعي
              </div>

              <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
                رابط{" "}
                <span
                  className="text-gradient"
                  style={{
                    background: "linear-gradient(135deg, #FF6B35, #6C63FF)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  واحد
                </span>
                . فولدر كليبات.
              </h1>
              <p className="text-zinc-400 text-base max-w-xl mx-auto leading-relaxed">
                الذكاء الاصطناعي بيراجع كل ثانية في الفيديو، يلاقي اللحظات اللي
                تستاهل النشر، يقيّمها بدرجات Hook وStory وPayoff — وبترجعلك
                مجموعة كليبات عمودية جاهزة للتحميل.
              </p>
            </section>

            {/* Input */}
            <MontageInput onJobStart={handleJobStart} />

            {/* How it works */}
            <section className="max-w-4xl mx-auto mt-20">
              <h2 className="text-center text-2xl font-bold mb-8 text-zinc-300">
                بيشتغل إزاي؟
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    num: "01",
                    title: "الإدخال",
                    desc: "رابط أو ملف — يوتيوب، بودكاست، بث، أو mp4 مباشر",
                    color: "#FF6B35",
                  },
                  {
                    num: "02",
                    title: "التفريغ",
                    desc: "Whisper AI بيحوّل الكلام لنص مع timestamps دقيقة",
                    color: "#6C63FF",
                  },
                  {
                    num: "03",
                    title: "التقييم",
                    desc: "Gemini بيقيّم كل لحظة على Hook وStory وPayoff",
                    color: "#00D9FF",
                  },
                  {
                    num: "04",
                    title: "القص",
                    desc: "FFmpeg يقص الكليبات 9:16 جاهزة للتحميل والنشر",
                    color: "#10B981",
                  },
                ].map((step) => (
                  <div
                    key={step.num}
                    className="glass-card p-5 text-right relative"
                  >
                    <span className="font-mono text-3xl font-black text-zinc-700/30 absolute top-3 left-4">
                      {step.num}
                    </span>
                    <div
                      className="w-2 h-2 rounded-full mb-3"
                      style={{ background: step.color }}
                    />
                    <h3
                      className="text-sm font-bold mb-1.5"
                      style={{ color: step.color }}
                    >
                      {step.title}
                    </h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ── PROCESSING / DONE ── */}
        {jobId && (
          <div className="max-w-6xl mx-auto">
            {/* Status display */}
            {jobStatus && isProcessing && (
              <div className="mb-10">
                <h2 className="text-center text-xl font-bold mb-6 text-zinc-300">
                  جاري المعالجة...
                </h2>
                <ProgressDisplay status={jobStatus} />
              </div>
            )}

            {/* Failed state */}
            {jobStatus?.status === "failed" && (
              <div className="mb-10">
                <ProgressDisplay status={jobStatus} />
                <div className="text-center mt-6">
                  <button onClick={handleReset} className="btn-ghost">
                    حاول تاني
                  </button>
                </div>
              </div>
            )}

            {/* Clips grid */}
            {clips.length > 0 && (
              <>
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                  <div className="text-right">
                    <h2 className="text-2xl font-bold">
                      <span
                        style={{
                          background:
                            "linear-gradient(135deg, #FF6B35, #6C63FF)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        {clips.length}
                      </span>{" "}
                      كليب جاهز
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      مترتبة حسب الانتشار — الأعلى تقييماً أول
                    </p>
                  </div>

                  {/* Sort control */}
                  <div className="flex items-center gap-2 text-xs">
                    <SortAscending
                      size={14}
                      className="text-zinc-500"
                    />
                    <span className="text-zinc-500">ترتيب حسب:</span>
                    <select
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(e.target.value as SortKey)
                      }
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-zinc-300 text-xs"
                    >
                      <option value="virality">الانتشار</option>
                      <option value="hook">Hook</option>
                      <option value="story">Story</option>
                      <option value="payoff">Payoff</option>
                      <option value="duration">المدة</option>
                    </select>
                  </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {sortedClips.map((clip) => (
                    <ClipCard
                      key={clip.clip_id}
                      clipId={clip.clip_id}
                      jobId={clip.job_id}
                      index={clip.index}
                      title={clip.title}
                      duration={clip.duration}
                      transcript={clip.transcript}
                      scores={clip.scores}
                      downloadUrl={clip.download_url}
                      language={clip.language}
                    />
                  ))}
                </div>

                {/* New session CTA */}
                <div className="text-center mt-12">
                  <button onClick={handleReset} className="btn-ghost">
                    تشغيلة جديدة
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between gap-4 text-xs text-zinc-600">
          <span>قسم المونتاج — VisionFlow-AI</span>
          <span>Whisper · Gemini · FFmpeg</span>
        </div>
      </footer>
    </main>
  );
}
```

---

### 8. [frontend/components/montage/MontageInput.tsx](file:///c:/Users/youse/OneDrive/Desktop/يوتيوب/frontend/components/montage/MontageInput.tsx)
```tsx
"use client";

import { useState, useRef, useCallback } from "react";
import {
  Link,
  UploadSimple,
  Sparkle,
  FileText,
  X,
  Warning,
} from "@phosphor-icons/react";

interface MontageInputProps {
  onJobStart: (jobId: string) => void;
}

const LANGS = [
  { code: "auto", label: "تلقائي (Auto)" },
  { code: "ar", label: "عربي" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "tr", label: "Türkçe" },
];

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://yousef891238-088098.hf.space";

export default function MontageInput({ onJobStart }: MontageInputProps) {
  const [tab, setTab] = useState<"url" | "file">("url");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("auto");
  const [brief, setBrief] = useState<string | null>(null);
  const [briefFile, setBriefFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const briefInputRef = useRef<HTMLInputElement>(null);

  // ── Brief file reader ───────────────────────────────────────────────────────
  const handleBriefChange = async (f: File) => {
    setBriefFile(f);
    const text = await f.text();
    setBrief(text.slice(0, 2000));
  };

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith("video/")) {
        setVideoFile(f);
        setTab("file");
      }
    },
    []
  );

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      let jobId: string;

      if (tab === "url") {
        if (!url.trim()) {
          setError("الزق رابط الفيديو الأول");
          setLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/api/montage/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url.trim(),
            language,
            brief: brief || null,
            min_clip_duration: 20,
            max_clip_duration: 90,
            max_clips: 10,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "فشل البدء");
        }
        const data = await res.json();
        jobId = data.job_id;
      } else {
        if (!videoFile) {
          setError("ارفع ملف الفيديو الأول");
          setLoading(false);
          return;
        }
        const form = new FormData();
        form.append("file", videoFile);
        form.append("language", language);
        if (brief) form.append("brief", brief);
        form.append("min_clip_duration", "20");
        form.append("max_clip_duration", "90");
        form.append("max_clips", "10");

        const res = await fetch(`${API_BASE}/api/montage/analyze/upload`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "فشل الرفع");
        }
        const data = await res.json();
        jobId = data.job_id;
      }

      onJobStart(jobId);
    } catch (e: any) {
      setError(e.message || "حصل خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6 max-w-2xl mx-auto text-right">
      {/* Tab switcher */}
      <div className="flex gap-2 mb-5 bg-white/3 p-1 rounded-xl border border-white/5">
        {[
          { key: "url", icon: Link, label: "رابط فيديو" },
          { key: "file", icon: UploadSimple, label: "رفع ملف" },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as "url" | "file")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? "bg-violet-600/20 text-violet-300 border border-violet-600/30"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Icon size={16} weight={tab === key ? "fill" : "regular"} />
            {label}
          </button>
        ))}
      </div>

      {/* URL Input */}
      {tab === "url" && (
        <input
          type="url"
          dir="ltr"
          className="input-field mb-4 font-mono text-sm"
          placeholder="https://youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      )}

      {/* File Drop Zone */}
      {tab === "file" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mb-4 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragging
              ? "border-violet-500 bg-violet-500/10"
              : "border-white/10 hover:border-white/20 bg-white/2"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-m4v,video/avi,.mp4,.mov,.mkv,.webm,.m4v,.avi"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setVideoFile(f);
            }}
          />
          {videoFile ? (
            <div className="flex items-center justify-center gap-2 text-violet-300">
              <UploadSimple size={20} weight="fill" />
              <span className="text-sm font-medium">{videoFile.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setVideoFile(null); }}
                className="text-zinc-500 hover:text-red-400 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div>
              <UploadSimple size={32} className="mx-auto mb-2 text-zinc-600" />
              <p className="text-sm text-zinc-400">
                اسحب ملف هنا أو اضغط للاختيار
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                mp4 · mov · mkv · webm · m4v · avi
              </p>
            </div>
          )}
        </div>
      )}

      {/* Settings row */}
      <div className="flex gap-3 mb-4">
        {/* Language */}
        <div className="flex-1">
          <label className="text-xs text-zinc-500 block mb-1.5">اللغة</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="input-field text-sm py-2.5"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Brief upload */}
        <div className="flex-1">
          <label className="text-xs text-zinc-500 block mb-1.5">
            بريف حملة (اختياري)
          </label>
          <button
            onClick={() => briefInputRef.current?.click()}
            className={`w-full input-field text-sm py-2.5 flex items-center gap-2 cursor-pointer ${
              briefFile ? "border-violet-600/40 text-violet-300" : "text-zinc-500"
            }`}
          >
            <FileText size={15} weight={briefFile ? "fill" : "regular"} />
            {briefFile ? briefFile.name.slice(0, 18) + "…" : "رفع .txt أو .pdf"}
          </button>
          <input
            ref={briefInputRef}
            type="file"
            accept=".txt,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleBriefChange(f);
            }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
          <Warning size={16} />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="btn-primary w-full justify-center text-base"
        style={{
          opacity: loading ? 0.7 : 1,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            جاري البدء...
          </>
        ) : (
          <>
            <Sparkle size={18} weight="fill" />
            شغّل التحليل
          </>
        )}
      </button>

      <p className="text-center text-xs text-zinc-600 mt-3">
        يوتيوب · بودكاست · بث · أو رفع مباشر — عشرات اللغات
      </p>
    </div>
  );
}
```

---

### 9. [frontend/components/montage/ClipCard.tsx](file:///c:/Users/youse/OneDrive/Desktop/يوتيوب/frontend/components/montage/ClipCard.tsx)
```tsx
"use client";

import { useState } from "react";
import {
  DownloadSimple,
  Timer,
  Globe,
  Lightning,
  Sparkle,
  Copy,
  CheckCircle,
} from "@phosphor-icons/react";
import ScoreBar from "./ScoreBar";

interface ClipScores {
  hook: number;
  story: number;
  payoff: number;
  virality: number;
}

interface ClipCardProps {
  clipId: string;
  jobId: string;
  index: number;
  title: string;
  duration: number;
  transcript: string;
  scores: ClipScores;
  downloadUrl: string;
  language: string;
}

function ViralityBadge({ score }: { score: number }) {
  const tier =
    score >= 80
      ? { label: "🔥 فايرال", color: "#FF6B35", bg: "rgba(255,107,53,0.12)" }
      : score >= 65
      ? { label: "⚡ قوي", color: "#6C63FF", bg: "rgba(108,99,255,0.12)" }
      : { label: "✓ جيد", color: "#10B981", bg: "rgba(16,185,129,0.12)" };

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ color: tier.color, background: tier.bg, border: `1px solid ${tier.color}30` }}
    >
      {tier.label} {score}
    </span>
  );
}

export default function ClipCard({
  clipId,
  jobId,
  index,
  title,
  duration,
  transcript,
  scores,
  downloadUrl,
  language,
}: ClipCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://yousef891238-088098.hf.space";
  const fullDownloadUrl = `${API_BASE}${downloadUrl}`;

  const durationStr =
    duration >= 60
      ? `${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, "0")}`
      : `${Math.round(duration)}ث`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card p-5 group relative flex flex-col gap-4 text-right">
      {/* Index + Virality */}
      <div className="flex items-center justify-between">
        <ViralityBadge score={scores.virality} />
        <span className="font-mono text-2xl font-black text-zinc-700/40">
          {String(index).padStart(2, "0")}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-bold text-zinc-100 leading-snug line-clamp-2">{title}</h3>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <Timer size={12} />
          {durationStr}
        </span>
        <span className="flex items-center gap-1">
          <Globe size={12} />
          {language || "auto"}
        </span>
      </div>

      {/* Score bars */}
      <div className="space-y-2">
        <ScoreBar label="Hook" value={scores.hook} color="#FF6B35" delay={0} />
        <ScoreBar label="Story" value={scores.story} color="#6C63FF" delay={80} />
        <ScoreBar label="Payoff" value={scores.payoff} color="#00D9FF" delay={160} />
      </div>

      {/* Transcript toggle */}
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {expanded ? "▲ إخفاء النص" : "▼ عرض النص"}
        </button>
        {expanded && (
          <div className="mt-2 relative">
            <p className="text-xs text-zinc-400 leading-relaxed bg-white/3 rounded-lg p-3 pr-4 line-clamp-6">
              {transcript}
            </p>
            <button
              onClick={handleCopy}
              className="absolute top-2 left-2 p-1 rounded text-zinc-500 hover:text-zinc-200 transition-colors"
              title="نسخ النص"
            >
              {copied ? (
                <CheckCircle size={14} className="text-green-400" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Download */}
      <a
        href={fullDownloadUrl}
        download
        className="btn-primary w-full justify-center text-sm mt-auto"
        style={{
          background: "linear-gradient(135deg, #6C63FF, #00D9FF)",
          boxShadow: "0 4px 20px rgba(108,99,255,0.3)",
        }}
      >
        <DownloadSimple size={16} weight="bold" />
        تحميل MP4
      </a>
    </div>
  );
}
```

---

### 10. [frontend/components/montage/ScoreBar.tsx](file:///c:/Users/youse/OneDrive/Desktop/يوتيوب/frontend/components/montage/ScoreBar.tsx)
```tsx
"use client";

interface ScoreBarProps {
  label: string;
  value: number; // 0-10
  color: string;
  delay?: number;
}

export default function ScoreBar({ label, value, color, delay = 0 }: ScoreBarProps) {
  const pct = (value / 10) * 100;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-zinc-400 w-14 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: color,
            transitionDelay: `${delay}ms`,
            boxShadow: `0 0 6px ${color}60`,
          }}
        />
      </div>
      <span className="text-zinc-300 font-mono w-5 text-left">{value}</span>
    </div>
  );
}
```
