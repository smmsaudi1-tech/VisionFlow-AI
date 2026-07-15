# 🎥 توثيق خادم VidAI Studio (Backend & Rendering Engine)

يحتوي هذا المستند على الهيكل الكامل لملفات الباك إند (الخادم) ومحرك معالجة ورندر الفيديو، متضمناً شرحاً تفصيلياً لكل ملف، وهيكل المجلدات، مع الأكواد البرمجية الكاملة لكل ملف.

---

## 📁 هيكل مجلدات الباك إند (Directory Structure)

```text
backend/
├── app.py                     # نقطة دخول خادم Hugging Face (Gradio SDK wrapper)
├── main.py                    # تطبيق FastAPI الرئيسي وإعداد الـ CORS والـ WebSockets
├── state.py                   # إدارة الذاكرة المؤقتة للبيانات والـ TTL لحفظ موارد الخادم
├── requirements.txt           # مكتبات وحزم البايثون المطلوبة
├── README.md                  # إعدادات الـ Space على Hugging Face
│
├── models/
│   └── schemas.py             # جميع هياكل البيانات (Pydantic Schemas) للطلبات والاستجابات
│
├── routers/
│   ├── analyze.py             # راوتر التحليل بدون تحميل (Zero-Download YouTube Scraper)
│   ├── script.py              # راوتر صياغة السكربتات بـ 3 أساليب وتوليد العناوين
│   ├── media.py               # راوتر البحث عن الميديا والموسيقى
│   ├── tts.py                 # راوتر تحويل النصوص لصوت (TTS)
│   └── render.py              # راوتر المونتاج وتركيب المشاهد والرندر وإرسال تليجرام
│
└── services/
    ├── gemini_service.py      # الاتصال بنموذج جيميناي وصياغة الأفكار والسيناريوهات
    ├── telegram_service.py    # إرسال الفيديو المكتمل مباشرة إلى تليجرام عبر البوت
    ├── youtube.py             # جلب تفاصيل وبيانات فيديوهات اليوتيوب
    ├── whisper_service.py     # خدمة تحويل الكلام لنصوص محلياً (Whisper)
    ├── ffmpeg_service.py      # محرك تعديل وتركيب الفيديوهات والمونتاج (FFmpeg Engine)
    └── tts_service.py         # توليد الفويس أوفر الذكي بجودة عالية (Kokoro TTS)
```

---

## 📄 الأكواد البرمجية الكاملة للملفات مع الشرح

### 1. `backend/app.py`
**الشرح:** نقطة الانطلاق الأساسية لـ Hugging Face Spaces. يقوم بتشغيل الـ FastAPI app بداخل Gradio wrapper ويفتحه على المنفذ `7860`.

```python
"""
VidAI Studio Backend — Hugging Face Spaces entry point
Gradio SDK wrapper that serves our FastAPI app on port 7860
"""

import gradio as gr
import uvicorn
from main import app  # FastAPI app with all routers

# Minimal Gradio UI (required for Gradio SDK recognition)
with gr.Blocks(title="VidAI Studio Backend") as demo:
    gr.Markdown("""
    # 🎥 VidAI Studio — Backend API

    The backend is **running** on this Hugging Face Space.

    | Endpoint | Description |
    |---|---|
    | [/docs](/docs) | Interactive API documentation (Swagger) |
    | [/health](/health) | Health check |
    | [/api/analyze](/docs#/Analyze) | Video analysis |
    | [/api/script](/docs#/Script) | Script generation |
    | [/api/tts](/docs#/TTS) | Text-to-speech |
    | [/api/render](/docs#/Render) | Video rendering |
    """)

# Mount Gradio UI into our FastAPI app at /ui path
app = gr.mount_gradio_app(app, demo, path="/ui")

# Start the server — HF Spaces runs this file directly via `python app.py`
uvicorn.run(app, host="0.0.0.0", port=7860)
```

---

### 2. `backend/main.py`
**الشرح:** الملف الرئيسي لتطبيق FastAPI. يُهيئ جدار الحماية للطلبات الخارجية (CORS Middleware)، ويضم كل الرواترز للمسارات المختلفة، كما يدير الـ WebSockets لإرسال حالة تقدم المونتاج والرندر بشكل لحظي للفرونت إند.

```python
"""
VidAI Studio — Backend API
FastAPI app with WebSocket support for real-time progress tracking
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict
import os

from routers import analyze, script, media, tts, render
from models.schemas import HealthResponse
from state import start_cleanup_loop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup + shutdown lifecycle"""
    logger.info("VidAI Studio API starting up...")
    # Start background cleanup loop
    cleanup_task = asyncio.create_task(start_cleanup_loop())
    yield
    # Shutdown
    cleanup_task.cancel()
    logger.info("VidAI Studio API shutting down.")


app = FastAPI(
    title="VidAI Studio API",
    description="AI-powered video creation platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ─── CORS ──────────────────────────────────────────────────────────────────────
_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:3001,https://vision-flow-ai-tawny.vercel.app,https://youseffds-vidai-backend.hf.space",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)

# ─── Routers ───────────────────────────────────────────────────────────────────
app.include_router(analyze.router, prefix="/api/analyze", tags=["Analyze"])
app.include_router(script.router, prefix="/api/script", tags=["Script"])
app.include_router(media.router, prefix="/api/media", tags=["Media"])
app.include_router(tts.router, prefix="/api/tts", tags=["TTS"])
app.include_router(render.router, prefix="/api/render", tags=["Render"])


# ─── WebSocket Manager ─────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, project_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[project_id] = websocket
        logger.debug(f"WS connected: {project_id}")

    def disconnect(self, project_id: str) -> None:
        self.active_connections.pop(project_id, None)
        logger.debug(f"WS disconnected: {project_id}")

    async def send_progress(self, project_id: str, data: dict) -> None:
        ws = self.active_connections.get(project_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception as e:
                logger.warning(f"WS send failed ({project_id}): {e}")
                self.disconnect(project_id)

    async def broadcast(self, data: dict) -> None:
        dead = []
        for pid, ws in self.active_connections.items():
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(pid)
        for pid in dead:
            self.disconnect(pid)


manager = ConnectionManager()
app.state.ws_manager = manager


@app.websocket("/ws/progress/{project_id}")
async def websocket_progress(websocket: WebSocket, project_id: str):
    """Real-time progress updates via WebSocket"""
    await manager.connect(project_id, websocket)
    try:
        while True:
            # Keep-alive ping every 30s
            await asyncio.sleep(30)
            await websocket.send_json({
                "type": "ping",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
    except WebSocketDisconnect:
        manager.disconnect(project_id)
    except Exception as e:
        logger.warning(f"WS error ({project_id}): {e}")
        manager.disconnect(project_id)


# ─── Health / Root ─────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(timezone.utc).isoformat(),
        version="1.0.0",
    )


@app.get("/", tags=["System"])
async def root():
    return {
        "name": "VidAI Studio API",
        "version": "1.0.0",
        "docs": "/docs",
    }
```

---

### 3. `backend/state.py`
**الشرح:** إدارة الذاكرة المؤقتة للبيانات محلياً. يستخدم نظام الـ TTL (Time-To-Live) لحذف المشاريع والرندرات القديمة تلقائياً بعد مرور ساعتين لتجنب استهلاك مساحة الذاكرة (Memory Leak).

```python
"""
Shared State Module — Central store for all in-memory project/render data
Replaces the scattered _projects/_renders dicts across routers.
Uses a TTL-aware store to prevent memory leaks on long-running processes.
"""

import time
import asyncio
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# TTL in seconds — projects expire after 2 hours
_PROJECT_TTL = 7200
_RENDER_TTL = 7200


class TTLStore:
    """Thread-safe in-memory store with TTL expiry"""

    def __init__(self, ttl: int = 3600):
        self._data: Dict[str, dict] = {}
        self._timestamps: Dict[str, float] = {}
        self._ttl = ttl

    def set(self, key: str, value: dict) -> None:
        self._data[key] = value
        self._timestamps[key] = time.time()

    def get(self, key: str) -> Optional[dict]:
        if key not in self._data:
            return None
        if time.time() - self._timestamps[key] > self._ttl:
            self.delete(key)
            return None
        return self._data[key]

    def update(self, key: str, updates: dict) -> bool:
        """Update existing entry. Returns False if not found/expired."""
        entry = self.get(key)
        if entry is None:
            return False
        entry.update(updates)
        self._timestamps[key] = time.time()
        return True

    def delete(self, key: str) -> None:
        self._data.pop(key, None)
        self._timestamps.pop(key, None)

    def exists(self, key: str) -> bool:
        return self.get(key) is not None

    def cleanup_expired(self) -> int:
        """Remove expired entries. Returns count removed."""
        now = time.time()
        expired = [
            k for k, ts in self._timestamps.items()
            if now - ts > self._ttl
        ]
        for k in expired:
            self.delete(k)
        return len(expired)

    def __contains__(self, key: str) -> bool:
        return self.exists(key)


# Global stores
projects_store = TTLStore(ttl=_PROJECT_TTL)
renders_store = TTLStore(ttl=_RENDER_TTL)


async def start_cleanup_loop(interval: int = 1800):
    """Background task: clean expired entries every 30 minutes"""
    while True:
        await asyncio.sleep(interval)
        p = projects_store.cleanup_expired()
        r = renders_store.cleanup_expired()
        if p or r:
            logger.info(f"TTL cleanup: removed {p} projects, {r} renders")
```

---

### 4. `backend/models/schemas.py`
**الشرح:** يحتوي على جميع نماذج الحقق (Pydantic Models) التي تتحقق من صحة المدخلات والمخرجات لكل API في المشروع.

```python
"""
Pydantic schemas for VidAI Studio
"""

from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Any
from datetime import datetime


# ─── Health ──────────────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str


# ─── Transcript ──────────────────────────────────────────────────────────────
class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str


class SceneDescription(BaseModel):
    timestamp: float
    frame_url: Optional[str] = None
    description: str
    objects: List[str] = []
    mood: Optional[str] = None


# ─── Analyze ─────────────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    url: str
    language: Optional[str] = "auto"


class AnalyzeResponse(BaseModel):
    project_id: str
    status: str
    message: str


class AnalysisResult(BaseModel):
    project_id: str
    status: str
    title: Optional[str] = None
    thumbnail: Optional[str] = None
    duration: Optional[int] = None
    transcript: List[TranscriptSegment] = []
    scenes: List[SceneDescription] = []
    keywords: List[str] = []
    hashtags: List[str] = []
    summary: Optional[str] = None
    content_type: Optional[str] = None
    target_audience: Optional[str] = None
    chapters: List[dict] = []
    error: Optional[str] = None


# ─── Script ──────────────────────────────────────────────────────────────────
class ScriptScene(BaseModel):
    id: int
    text: str
    duration: int = 5
    keywords: List[str] = []
    video_url: Optional[str] = None
    video_thumb: Optional[str] = None


class ScriptRewriteRequest(BaseModel):
    project_id: str
    transcript: Optional[str] = ""
    language: Optional[str] = "ar"
    style: Optional[str] = "tiktok"  # tiktok / youtube / professional
    platform: Optional[str] = "youtube"
    target_scenes: Optional[int] = 5
    target_duration: Optional[int] = 60

class ScriptResult(BaseModel):
    project_id: str
    title: str
    description: str
    hashtags: List[str]
    script: str
    scenes: List[ScriptScene]

class ScriptVariantsResponse(BaseModel):
    project_id: str
    variants: List[ScriptResult]


# ─── Media ───────────────────────────────────────────────────────────────────
class MediaSearchRequest(BaseModel):
    keywords: List[str]
    orientation: Optional[str] = "landscape"  # landscape / portrait / square
    duration_min: Optional[int] = 3
    duration_max: Optional[int] = 15


class VideoClip(BaseModel):
    id: str
    source: str  # pexels / pixabay / mixkit
    url: str
    thumbnail: str
    duration: int
    width: int
    height: int
    author: Optional[str] = None
    license: str = "free"


class MediaSearchResponse(BaseModel):
    clips: List[VideoClip]
    total: int
    source: str


# ─── TTS ─────────────────────────────────────────────────────────────────────
class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "af_heart"
    speed: Optional[float] = 1.0
    language: Optional[str] = "ar"


class TTSResponse(BaseModel):
    audio_url: str
    duration: float
    voice: str


# ─── Render ──────────────────────────────────────────────────────────────────
class RenderScene(BaseModel):
    id: int
    video_url: str
    text: str
    duration: int
    transition: Optional[str] = "fade"


class RenderRequest(BaseModel):
    project_id: str
    scenes: List[RenderScene]
    voice_url: Optional[str] = ""
    music_url: Optional[str] = None
    format: Optional[str] = "16:9"  # 16:9 / 9:16 / 1:1
    add_captions: Optional[bool] = True
    caption_style: Optional[str] = "tiktok"
    telegram_token: Optional[str] = ""
    telegram_chat_id: Optional[str] = ""


class RenderResponse(BaseModel):
    project_id: str
    job_id: str
    status: str
    message: str


class RenderResult(BaseModel):
    project_id: str
    job_id: str
    status: str
    output_url: Optional[str] = None
    duration: Optional[float] = None
    error: Optional[str] = None


# ─── Progress ────────────────────────────────────────────────────────────────
class ProgressUpdate(BaseModel):
    project_id: str
    step: str
    progress: int  # 0-100
    message: str
    data: Optional[Any] = None
```

---

### 5. `backend/routers/analyze.py`
**الشرح:** راوتر التحليل السريع والمحدث (Zero-Download). يتخطى تنزيل الفيديو كلياً، ويجلب السكربت والترجمة المرافقة للفيديو مباشرة من يوتيوب باستخدام `youtube-transcript-api` في لحظات، مع وجود نظام طوارئ يقرأ العنوان والوصف لو لم يجد ترجمة.

```python
"""
Analyze Router
POST /api/analyze      → Start analysis of YouTube URL
"""

import asyncio
import uuid
import logging
import os
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from youtube_transcript_api import YouTubeTranscriptApi
from models.schemas import AnalyzeRequest, AnalyzeResponse, AnalysisResult
from services.youtube import youtube_service
from services.whisper_service import whisper_service
from services.gemini_service import gemini_service
from services.ffmpeg_service import ffmpeg_service
from state import projects_store

router = APIRouter()
logger = logging.getLogger(__name__)

TEMP_DIR = Path("/tmp/vidai")
TEMP_DIR.mkdir(parents=True, exist_ok=True)


def extract_video_id(url: str) -> str:
    """Extract YouTube video ID from URL"""
    import re
    patterns = [
        r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&\s]+)',
        r'(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^\?\s]+)',
        r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^&\s\?]+)',
        r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^&\s\?]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return ""


def _validate_youtube_url(url: str) -> bool:
    """Basic YouTube URL validation"""
    url = url.strip().lower()
    return (
        "youtube.com/watch" in url
        or "youtu.be/" in url
        or "youtube.com/shorts" in url
        or "youtube.com/live" in url
    )


@router.post("", response_model=AnalyzeResponse)
async def start_analysis(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """Start YouTube video analysis in background"""
    if not _validate_youtube_url(request.url):
        raise HTTPException(status_code=422, detail="رابط يوتيوب غير صالح")

    project_id = str(uuid.uuid4())

    projects_store.set(project_id, {
        "status": "queued",
        "url": request.url,
        "language": request.language or "auto",
        "transcript": [],
        "scenes": [],
        "keywords": [],
        "hashtags": [],
        "chapters": [],
    })

    background_tasks.add_task(
        run_analysis_pipeline,
        project_id,
        request.url,
        request.language or "auto",
    )

    return AnalyzeResponse(
        project_id=project_id,
        status="queued",
        message="تحليل الفيديو بدأ. تابع التقدم عبر WebSocket أو استخدم الـ polling.",
    )


@router.get("/{project_id}", response_model=AnalysisResult)
async def get_analysis(project_id: str):
    """Get analysis results for a project"""
    project = projects_store.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="المشروع غير موجود أو انتهت صلاحيته")

    return AnalysisResult(
        project_id=project_id,
        status=project.get("status", "unknown"),
        title=project.get("title"),
        thumbnail=project.get("thumbnail"),
        duration=project.get("duration"),
        transcript=project.get("transcript", []),
        scenes=project.get("scenes", []),
        keywords=project.get("keywords", []),
        hashtags=project.get("hashtags", []),
        summary=project.get("summary"),
        content_type=project.get("content_type"),
        target_audience=project.get("target_audience"),
        chapters=project.get("chapters", []),
        error=project.get("error"),
    )


async def run_analysis_pipeline(project_id: str, url: str, language: str):
    """
    Full analysis pipeline (runs in background - Zero-Download):
    1. Fetch metadata via yt-dlp (skip download)
    2. Fetch transcript via youtube-transcript-api
    3. Analyze with Gemini
    """
    logger.info(f"[{project_id}] Pipeline starting (Zero-Download) for: {url}")
    projects_store.update(project_id, {"status": "downloading"})

    try:
        # ── Step 1: Fetch Metadata ───────────────────────────────────────────
        logger.info(f"[{project_id}] Step 1: Fetching metadata...")
        metadata = {}
        try:
            metadata = await youtube_service.get_info(url)
        except Exception as me:
            logger.warning(f"[{project_id}] Metadata fetch failed: {me}")
            metadata = {
                "title": "فيديو يوتيوب",
                "description": "لا يوجد وصف متاح",
                "duration": 60,
                "thumbnail": "",
            }

        projects_store.update(project_id, {
            "title": metadata.get("title", "فيديو يوتيوب"),
            "thumbnail": metadata.get("thumbnail", metadata.get("thumbnail_url", "")),
            "duration": metadata.get("duration", 60),
            "status": "transcribing",
        })

        # ── Step 2: Fetch Transcript ─────────────────────────────────────────
        logger.info(f"[{project_id}] Step 2: Fetching transcript...")
        video_id = extract_video_id(url)
        transcript_text = ""
        transcript_segments = []

        if video_id:
            try:
                logger.info(f"[{project_id}] YouTubeTranscriptApi imported object: {YouTubeTranscriptApi} (type: {type(YouTubeTranscriptApi)})")
                transcript_list = None
                
                # Try standard class method
                if hasattr(YouTubeTranscriptApi, 'get_transcript'):
                    logger.info(f"[{project_id}] Calling YouTubeTranscriptApi.get_transcript...")
                    transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['ar', 'en'])
                # Try newer instanced fetch method
                elif hasattr(YouTubeTranscriptApi, 'fetch'):
                    logger.info(f"[{project_id}] Calling YouTubeTranscriptApi().fetch...")
                    transcript_list = YouTubeTranscriptApi().fetch(video_id, languages=['ar', 'en'])
                else:
                    import youtube_transcript_api
                    if hasattr(youtube_transcript_api, 'YouTubeTranscriptApi'):
                        cls = youtube_transcript_api.YouTubeTranscriptApi
                        if hasattr(cls, 'get_transcript'):
                            logger.info(f"[{project_id}] Calling cls.get_transcript...")
                            transcript_list = cls.get_transcript(video_id, languages=['ar', 'en'])
                        elif hasattr(cls, 'fetch'):
                            logger.info(f"[{project_id}] Calling cls().fetch...")
                            transcript_list = cls().fetch(video_id, languages=['ar', 'en'])
                    
                if transcript_list:
                    # Format segments
                    for idx, entry in enumerate(transcript_list):
                        start = entry.get("start", 0.0)
                        duration = entry.get("duration", 0.0)
                        text = entry.get("text", "")
                        transcript_segments.append({
                            "start": start,
                            "end": start + duration,
                            "text": text,
                        })
                    transcript_text = " ".join([entry.get("text", "") for entry in transcript_list])
                    logger.info(f"[{project_id}] Transcript fetched successfully ({len(transcript_segments)} segments)")
                else:
                    raise RuntimeError("No transcript list retrieved")
            except Exception as te:
                logger.warning(f"[{project_id}] Transcript API failed: {te}. Falling back to metadata-only analysis.")

        # Fallback to metadata if no transcript found
        if not transcript_text:
            transcript_text = f"عنوان الفيديو: {metadata.get('title', '')}\nوصف الفيديو:\n{metadata.get('description', '')}"
            transcript_segments = [{
                "start": 0.0,
                "end": float(metadata.get("duration", 60)),
                "text": metadata.get("description", "")[:200] if metadata.get("description") else "لا يوجد نص متاح",
            }]

        projects_store.update(project_id, {"status": "analyzing_content"})

        # ── Step 3: Analyze content ───────────────────────────────────────────
        logger.info(f"[{project_id}] Step 3: Analyzing content...")
        analysis = await gemini_service.analyze_transcript(
            transcript_text,
            metadata,
        )

        # ── Done ──────────────────────────────────────────────────────────────
        projects_store.update(project_id, {
            "status": "done",
            "transcript": transcript_segments,
            "transcript_full": transcript_text,
            "scenes": [],
            "keywords": analysis.get("keywords", []),
            "hashtags": analysis.get("hashtags", []),
            "summary": analysis.get("summary", ""),
            "content_type": analysis.get("content_type", ""),
            "target_audience": analysis.get("target_audience", ""),
            "chapters": analysis.get("chapters", []),
            "best_hook": analysis.get("best_hook", ""),
            "cta_suggestions": analysis.get("cta_suggestions", []),
        })

        logger.info(f"[{project_id}] Pipeline completed successfully (Zero-Download) ✅")

    except Exception as e:
        logger.error(f"[{project_id}] Pipeline failed: {e}", exc_info=True)
        projects_store.update(project_id, {
            "status": "failed",
            "error": str(e),
        })
```

---

### 6. `backend/routers/script.py`
**الشرح:** راوتر إعادة الصياغة. يطلب من Gemini إعادة صياغة الفيديو لـ 3 أساليب مختلفة، وتوليد قائمة الكلمات الدلالية لكل مشهد لجلب الفيديوهات الملائمة من Pexels.

```python
"""
Script Router
POST /api/script/rewrite-variants  → Generate 3 script styles
"""

import logging
from fastapi import APIRouter, HTTPException

from models.schemas import ScriptRewriteRequest, ScriptResult, ScriptVariantsResponse
from services.gemini_service import gemini_service
from services.media_search import media_service
from state import projects_store

router = APIRouter()
logger = logging.getLogger(__name__)

_scripts: dict = {}


@router.post("/rewrite", response_model=ScriptResult)
async def rewrite_script(request: ScriptRewriteRequest):
    """Rewrite transcript as optimized script with scenes"""
    project = projects_store.get(request.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="المشروع غير موجود")

    if project.get("status") != "done":
        raise HTTPException(status_code=400, detail="التحليل لم يكتمل بعد")

    transcript = project.get("transcript_full", "")
    result = await gemini_service.rewrite_script(
        transcript,
        language=request.language or "ar",
        style=request.style or "tiktok",
    )

    scenes = result.get("scenes", [])
    if scenes:
        orientation = "portrait" if request.platform == "tiktok" else "landscape"
        scenes = await media_service.search_multiple(scenes, orientation=orientation)

    script_obj = ScriptResult(
        project_id=request.project_id,
        title=result.get("title", ""),
        description=result.get("description", ""),
        hashtags=result.get("hashtags", []),
        script=result.get("script", ""),
        scenes=scenes,
    )
    _scripts[request.project_id] = script_obj.model_dump()
    return script_obj


@router.post("/rewrite-variants", response_model=ScriptVariantsResponse)
async def rewrite_script_variants(request: ScriptRewriteRequest):
    """Rewrite transcript into 3 distinct script variations (tiktok, youtube, storytelling)"""
    project = projects_store.get(request.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="المشروع غير موجود")

    transcript = project.get("transcript_full", "")
    result = await gemini_service.rewrite_script_variants(
        transcript,
        language=request.language or "ar",
        target_scenes=request.target_scenes or 5,
        target_duration=request.target_duration or 60,
    )

    variants_list = []
    orientation = "portrait" if request.platform == "tiktok" else "landscape"

    for v in result.get("variants", []):
        style_name = v.get("style", "youtube")
        scenes = v.get("scenes", [])
        if scenes:
            scenes = await media_service.search_multiple(scenes, orientation=orientation)
            
        script_obj = ScriptResult(
            project_id=request.project_id,
            title=v.get("title", f"VidAI Script - {style_name}"),
            description=v.get("description", ""),
            hashtags=v.get("hashtags", []),
            script=v.get("script", ""),
            scenes=scenes,
        )
        variants_list.append(script_obj)

    variants_resp = ScriptVariantsResponse(
        project_id=request.project_id,
        variants=variants_list,
    )
    _scripts[request.project_id] = variants_resp.model_dump()
    return variants_resp


@router.get("/{project_id}", response_model=ScriptResult)
async def get_script(project_id: str):
    if project_id not in _scripts:
        raise HTTPException(status_code=404, detail="لم يتم إنشاء سكريبت")
    script_data = _scripts[project_id]
    if "variants" in script_data:
        return script_data["variants"][0]
    return script_data


@router.get("/{project_id}/variants", response_model=ScriptVariantsResponse)
async def get_script_variants(project_id: str):
    if project_id not in _scripts:
        raise HTTPException(status_code=404, detail="لا توجد سكريبتات")
    script_data = _scripts[project_id]
    if "variants" not in script_data:
        single = ScriptResult(**script_data)
        return ScriptVariantsResponse(project_id=project_id, variants=[single])
    return script_data


@router.post("/titles")
async def generate_titles(project_id: str, style: str = "youtube", count: int = 10):
    if project_id not in _scripts:
        raise HTTPException(status_code=404, detail="لا يوجد سكريبت")
    script_data = _scripts[project_id]
    script_text = ""
    if "variants" in script_data:
        variant = next((v for v in script_data["variants"] if v.get("style") == style or v.get("script")), None)
        if not variant and script_data["variants"]:
            variant = script_data["variants"][0]
        script_text = variant.get("script", "") if variant else ""
    else:
        script_text = script_data.get("script", "")

    titles = await gemini_service.generate_titles(script_text, count)
    return {"titles": titles, "project_id": project_id}
```

---

### 7. `backend/routers/render.py`
**الشرح:** الملف الأثقل والمحوري (مطبخ المونتاج). يقوم بالتحكم في توليد ملف الـ SRT والترجمة، تحميل الموسيقى الخلفية والـ Clips، دمجهم بـ FFmpeg، وإرسال الفيديو المكتمل لـ Telegram في الخلفية.

```python
"""
Render Router — OPTIMIZED with Real-time WebSockets
"""

import asyncio
import uuid
import logging
import os
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import FileResponse

from models.schemas import RenderRequest, RenderResponse, RenderResult
from services.ffmpeg_service import ffmpeg_service
from services.tts_service import tts_service
from services.media_search import media_service
from services.telegram_service import telegram_service
from state import renders_store

router = APIRouter()
logger = logging.getLogger(__name__)

TEMP_DIR = Path("/tmp/vidai")

# Max concurrent render jobs on server
_render_semaphore = asyncio.Semaphore(int(os.getenv("MAX_CONCURRENT_RENDERS", "2")))


@router.post("/start", response_model=RenderResponse)
async def start_render(
    request: RenderRequest,
    fastapi_request: Request,
    background_tasks: BackgroundTasks,
):
    job_id = str(uuid.uuid4())
    renders_store.set(job_id, {"status": "queued", "project_id": request.project_id})
    background_tasks.add_task(run_render_pipeline, job_id, request, fastapi_request)
    return RenderResponse(
        project_id=request.project_id,
        job_id=job_id,
        status="queued",
        message="بدأ تجهيز الفيديو. هيخلص قريباً!",
    )


@router.get("/download/{job_id}")
async def download_video(job_id: str):
    render = renders_store.get(job_id)
    if render is None:
        raise HTTPException(status_code=404, detail="الرندر غير موجود")
    if render.get("status") != "done":
        raise HTTPException(status_code=400, detail="لم يكتمل الرندر")
    output_path = render.get("output_path")
    return FileResponse(output_path, media_type="video/mp4", filename=f"vidai_{job_id[:8]}.mp4")


@router.get("/status/{job_id}", response_model=RenderResult)
async def get_render_status(job_id: str):
    render = renders_store.get(job_id)
    if render is None:
        raise HTTPException(status_code=404, detail="الرندر غير موجود")
    return RenderResult(
        project_id=render.get("project_id", ""),
        job_id=job_id,
        status=render.get("status", "unknown"),
        output_url=render.get("output_url"),
        duration=render.get("duration"),
        error=render.get("error"),
    )


async def _push_progress(request: Request, project_id: str, step: str, progress: int, message: str):
    """Send real-time progress updates via WebSocket manager"""
    try:
        manager = getattr(request.app.state, "ws_manager", None)
        if manager:
            await manager.send_progress(project_id, {
                "type": "progress",
                "step": step,
                "progress": progress,
                "message": message,
            })
    except Exception as e:
        logger.warning(f"Failed to push WS progress: {e}")


async def run_render_pipeline(job_id: str, request: RenderRequest, fastapi_request: Request):
    async with _render_semaphore:
        renders_store.update(job_id, {"status": "processing"})
        await _push_progress(fastapi_request, request.project_id, "processing", 5, "بدء عملية الرندر والمونتاج...")
        
        output_dir = TEMP_DIR / job_id
        output_dir.mkdir(parents=True, exist_ok=True)

        try:
            fmt = request.format or "16:9"
            width, height = (
                (1920, 1080) if fmt == "16:9"
                else (1080, 1920) if fmt == "9:16"
                else (1080, 1080)
            )

            # ── Run 3 parallel independent jobs: Voice + Music + Fill Missing Clips ──
            renders_store.update(job_id, {"status": "processing_parallel"})
            await _push_progress(fastapi_request, request.project_id, "processing_parallel", 15, "جاري معالجة الصوت والموسيقى والمشاهد بالتوازي...")

            async def _get_voice():
                if request.voice_url and os.path.exists(request.voice_url):
                    return request.voice_url
                full_text = " ".join(s.text for s in request.scenes)
                result = await tts_service.generate(text=full_text, output_path=str(output_dir / "voice.wav"))
                return result["audio_path"]

            async def _get_music():
                if request.music_url:
                    path = str(output_dir / "music.mp3")
                    await ffmpeg_service.download_video_clip(request.music_url, path, 3600)
                    return path
                url = await media_service.search_background_music("upbeat background")
                if not url:
                    return None
                path = str(output_dir / "music.mp3")
                await ffmpeg_service.download_video_clip(url, path, 3600)
                return path

            async def _fill_missing_clips():
                scenes_data = [s.model_dump() for s in request.scenes]
                missing = [i for i, s in enumerate(scenes_data) if not s.get("video_url", "").startswith("http")]

                async def _fetch(i):
                    alt = await media_service.search_video([request.scenes[i].text[:20]])
                    if alt and alt.get("url"):
                        scenes_data[i]["video_url"] = alt["url"]

                if missing:
                    await asyncio.gather(*(_fetch(i) for i in missing))
                return scenes_data

            voice_path, music_path, scenes_data = await asyncio.gather(
                _get_voice(), _get_music(), _fill_missing_clips(),
            )

            # ── SRT Captions (fast, local) ──
            srt_path = None
            if request.add_captions and request.scenes:
                srt_path = str(output_dir / "captions.srt")
                with open(srt_path, "w", encoding="utf-8") as f:
                    f.write(_build_srt(request.scenes))

            # ── Parallel Scene Processing ──
            renders_store.update(job_id, {"status": "rendering_clips"})
            await _push_progress(fastapi_request, request.project_id, "rendering_clips", 45, "تجهيز وتعديل لقطات المشاهد بالتوازي...")
            
            valid_scenes = [s for s in scenes_data if s.get("video_url", "").startswith("http")]
            clip_paths = await ffmpeg_service.create_scene_clips_parallel(
                valid_scenes, output_dir, target_width=width, target_height=height, max_concurrent=4,
            )

            if not clip_paths:
                raise RuntimeError("لا توجد مقاطع فيديو صالحة")

            # ── Concatenation ──
            renders_store.update(job_id, {"status": "concatenating"})
            await _push_progress(fastapi_request, request.project_id, "concatenating", 75, "دمج اللقطات معاً...")
            
            concat_path = str(output_dir / "concat.mp4")
            await ffmpeg_service.concatenate_clips(clip_paths, concat_path)

            # ── Final Audio Mixing & Render ──
            renders_store.update(job_id, {"status": "final_render"})
            await _push_progress(fastapi_request, request.project_id, "final_render", 85, "تركيب الصوت النهائي والترجمات المتحركة...")
            
            output_path = str(output_dir / "final.mp4")
            await ffmpeg_service.mix_audio_and_render(
                video_path=concat_path, voice_path=voice_path, music_path=music_path,
                srt_path=srt_path, output_path=output_path,
            )

            duration = await ffmpeg_service.get_duration(output_path)
            renders_store.update(job_id, {
                "status": "done",
                "output_path": output_path,
                "output_url": f"/api/render/download/{job_id}",
                "duration": duration,
            })
            await _push_progress(fastapi_request, request.project_id, "done", 100, "اكتمل مونتاج الفيديو بنجاح! 🎉")

            # ── Telegram Delivery ──
            if request.telegram_token and request.telegram_chat_id:
                try:
                    await _push_progress(fastapi_request, request.project_id, "sending_telegram", 95, "جاري إرسال الفيديو لهاتفك عبر تليجرام...")
                    caption = f"🎥 تم توليد فيديو جديد بنجاح!\n⏱️ المدة: {duration:.1f} ثانية"
                    await telegram_service.send_video(
                        video_path=output_path, caption=caption,
                        token=request.telegram_token, chat_id=request.telegram_chat_id,
                    )
                except Exception as te:
                    logger.error(f"Telegram upload failed: {te}")
                finally:
                    # Reset state back to done
                    renders_store.update(job_id, {"status": "done"})
                    await _push_progress(fastapi_request, request.project_id, "done", 100, "اكتمل مونتاج الفيديو بنجاح! 🎉")

        except Exception as e:
            logger.error(f"Render failed: {e}")
            renders_store.update(job_id, {"status": "failed", "error": str(e)})
            await _push_progress(fastapi_request, request.project_id, "failed", 100, f"فشل الرندر: {str(e)}")
        finally:
            # Clean up intermediate clips to save disk space
            for f in output_dir.glob("clip_*.mp4"):
                try:
                    f.unlink()
                except Exception:
                    pass


def _build_srt(scenes) -> str:
    lines = []
    current = 0.0
    for i, scene in enumerate(scenes, 1):
        start = current
        end = current + scene.duration
        lines.append(str(i))
        lines.append(f"{_to_srt_time(start)} --> {_to_srt_time(end)}")
        lines.append(scene.text)
        lines.append("")
        current = end
    return "\n".join(lines)


def _to_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
```

---

### 8. `backend/routers/media.py`
**الشرح:** راوتر جلب الموسيقى والفيديوهات الخلفية من Pexels و Pixabay.

```python
"""
Media Router
"""

import logging
from fastapi import APIRouter, HTTPException
from models.schemas import MediaSearchRequest, MediaSearchResponse, VideoClip
from services.media_search import media_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/search", response_model=MediaSearchResponse)
async def search_media(request: MediaSearchRequest):
    result = await media_service.search_video(
        request.keywords,
        orientation=request.orientation or "landscape",
        min_duration=request.duration_min or 3,
        max_duration=request.duration_max or 15,
    )

    if not result:
        return MediaSearchResponse(clips=[], total=0, source="none")

    clip = VideoClip(
        id=result.get("id", ""),
        source=result.get("source", ""),
        url=result.get("url", ""),
        thumbnail=result.get("thumbnail", ""),
        duration=result.get("duration", 10),
        width=result.get("width", 1920),
        height=result.get("height", 1080),
        author=result.get("author"),
        license=result.get("license", "free"),
    )
    return MediaSearchResponse(clips=[clip], total=1, source=result.get("source", ""))


@router.get("/music")
async def get_background_music(mood: str = "upbeat"):
    url = await media_service.search_background_music(mood)
    return {"music_url": url, "mood": mood}
```

---

### 9. `backend/routers/tts.py`
**الشرح:** راوتر توليد الفويس أوفر وسيرفر ملفات الصوت للفرونت إند.

```python
"""
TTS Router
"""

import logging
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from models.schemas import TTSRequest, TTSResponse
from services.tts_service import tts_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/generate", response_model=TTSResponse)
async def generate_voice(request: TTSRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="النص فارغ")

    result = await tts_service.generate(
        text=request.text,
        voice=request.voice or "af_heart",
        speed=request.speed or 1.0,
    )
    filename = os.path.basename(result['audio_path'])
    return TTSResponse(
        audio_url=f"/api/tts/audio/{filename}",
        duration=result["duration"],
        voice=result["voice"],
    )


@router.get("/voices")
async def list_voices():
    return {"voices": tts_service.get_available_voices()}


@router.get("/audio/{filename}")
async def get_audio(filename: str):
    path = Path("/tmp/vidai") / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    return FileResponse(str(path), media_type="audio/wav")
```

---

### 10. `backend/services/gemini_service.py`
**الشرح:** يتعامل مع نماذج Gemini. يحتوي على دوال تحليل نصوص يوتيوب وكتابة الـ 3 خيارات للسكربتات بناءً على طول الفيديو والمشاهد.

```python
"""
Google Gemini Service
"""

import asyncio
import os
import logging
import json
from pathlib import Path
from typing import List
import google.generativeai as genai

logger = logging.getLogger(__name__)

MODEL_NAME = "gemini-2.5-flash"
_MAX_RETRIES = 3
_BASE_DELAY = 2

raw_key = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_KEY = raw_key.strip().replace("\r", "").replace("\n", "") if raw_key else ""
if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY is not set!")

genai.configure(api_key=GEMINI_API_KEY)


class GeminiService:
    def __init__(self):
        self._model = genai.GenerativeModel(MODEL_NAME)

    async def analyze_transcript(self, transcript: str, metadata: dict) -> dict:
        prompt = f"""حلل هذا النص واقترح الكلمات المفتاحية والملخص:
عنوان الفيديو: {metadata.get('title', '')}
السكريبت:
{transcript[:8000]}
أرجع JSON فقط:
{{
  "summary": "الملخص",
  "keywords": ["كلمة1", "كلمة2"],
  "hashtags": ["#هاش1"],
  "content_type": "نوع المحتوى",
  "target_audience": "الجمهور",
  "chapters": []
}}"""
        return await self._generate_json(prompt)

    async def rewrite_script_variants(
        self,
        transcript: str,
        language: str = "ar",
        target_scenes: int = 5,
        target_duration: int = 60,
    ) -> dict:
        style_map = {
            "ar": "اكتب بالعربية الفصحى السهلة المفهومة",
            "en": "Write in clear, engaging English",
        }
        scene_dur = max(3, int(target_duration / target_scenes))
        
        prompt = f"""أعد كتابة النص إلى 3 أساليب مختلفة بالكامل:
1. tiktok (أسلوب حماسي وسريع)
2. youtube (شرح تعليمي وهادئ)
3. storytelling (سرد قصصي درامي)

الشروط:
- عدد المشاهد للنسخة الواحدة: بالضبط {target_scenes} مشاهد.
- مجموع المدة لكل نسخة: حوالي {target_duration} ثانية.
- {style_map.get(language, style_map['ar'])}

النص الأصلي:
{transcript[:6000]}

أرجع النتيجة بصيغة JSON فقط بالتنسيق التالي:
{{
  "variants": [
    {{
      "style": "tiktok",
      "title": "العنوان",
      "description": "الوصف",
      "hashtags": ["هاشتاق"],
      "script": "النص الكامل المنطوق",
      "scenes": [
        {{"id": 1, "text": "نص المشهد الأول المسموع", "duration": {scene_dur}, "keywords": ["كلمات بحث للفيديو"]}}
      ]
    }}
  ]
}}"""
        return await self._generate_json(prompt)

    async def generate_titles(self, script: str, count: int = 10) -> List[str]:
        prompt = f"اقترح {count} عناوين جذابة بناءً على هذا السكريبت:\n{script[:2000]}\nأرجع JSON: {{"titles": ["عنوان1"]}}"
        data = await self._generate_json(prompt)
        return data.get("titles", [])

    async def _generate_json(self, prompt: str) -> dict:
        for attempt in range(_MAX_RETRIES):
            try:
                text = await asyncio.to_thread(self._sync_generate, prompt)
                result = self._parse_json(text)
                if result:
                    return result
            except Exception as e:
                if attempt < _MAX_RETRIES - 1:
                    await asyncio.sleep(_BASE_DELAY * (2 ** attempt))
                else:
                    logger.error(f"Gemini failed: {e}")
                    raise
        return {}

    def _get_supported_models(self) -> list:
        """Dynamically query genai to list models supporting generateContent"""
        if self._discovered_models:
            return list(self._discovered_models)
        try:
            discovered = []
            for m in genai.list_models():
                if "generateContent" in m.supported_generation_methods:
                    discovered.append(m.name)
            self._discovered_models = discovered
            return list(discovered)
        except Exception as e:
            logger.warning(f"Failed to list models dynamically: {e}")
            return [
                "models/gemini-2.0-flash",
                "models/gemini-1.5-flash",
                "models/gemini-1.5-pro",
                "models/gemini-2.5-flash",
            ]

    def _generate_with_fallback(self, contents, generation_config=None) -> str:
        """Helper to generate content with automatic fallback to alternative models on 429/404 errors"""
        models = self._get_supported_models()
        current_model_name = self._model.model_name
        if not current_model_name.startswith("models/"):
            current_model_name = f"models/{current_model_name}"
            
        if current_model_name in models:
            models.remove(current_model_name)
            models.insert(0, current_model_name)
            
        last_error = None
        for model_name in models:
            try:
                logger.info(f"Generating content with model: {model_name}...")
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(contents, generation_config=generation_config)
                self._model = model
                return response.text
            except Exception as e:
                err_msg = str(e).lower()
                if "429" in err_msg or "quota" in err_msg or "resource_exhausted" in err_msg or "resource exhausted" in err_msg or "404" in err_msg or "not found" in err_msg:
                    logger.warning(f"Model {model_name} failed (error: {e}). Retrying next fallback...")
                    last_error = e
                    continue
                else:
                    raise e
        if last_error:
            raise last_error
        raise RuntimeError("All Gemini fallback models exhausted.")

    def _sync_generate(self, prompt: str) -> str:
        """Synchronous Gemini text generation (runs in thread)"""
        return self._generate_with_fallback(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=8192,
                response_mime_type="application/json",
            ),
        )

    def _parse_json(self, text: str) -> dict:
        try:
            clean = text.strip()
            if clean.startswith("```json"):
                clean = clean[7:]
            if clean.endswith("```"):
                clean = clean[:-3]
            return json.loads(clean.strip())
        except Exception:
            return {}


gemini_service = GeminiService()
```

---

### 11. `backend/services/telegram_service.py`
**الشرح:** البواب الذكي لتوصيل الفيديو لهاتفك. يتصل بـ Telegram Bot API ويرفع ملف الفيديو عند اكتمال عملية المونتاج بالكامل.

```python
"""
Telegram Service
"""

import httpx
import os
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class TelegramService:
    async def send_video(
        self,
        video_path: str,
        caption: str,
        token: Optional[str] = None,
        chat_id: Optional[str] = None,
    ) -> bool:
        bot_token = token or os.getenv("TELEGRAM_BOT_TOKEN")
        if bot_token:
            bot_token = bot_token.strip().replace("\r", "").replace("\n", "")
            
        target_chat = chat_id or os.getenv("TELEGRAM_CHAT_ID")
        if target_chat:
            target_chat = target_chat.strip().replace("\r", "").replace("\n", "")

        if not bot_token or not target_chat:
            logger.info("Telegram Bot Token or Chat ID not provided. Skipping Telegram upload.")
            return False

        if not Path(video_path).exists():
            logger.error(f"Video file not found: {video_path}")
            return False

        url = f"https://api.telegram.org/bot{bot_token}/sendVideo"

        try:
            logger.info(f"Uploading final video to Telegram chat {target_chat}...")
            async with httpx.AsyncClient(timeout=120) as client:
                with open(video_path, "rb") as f:
                    files = {"video": (Path(video_path).name, f, "video/mp4")}
                    data = {
                        "chat_id": target_chat,
                        "caption": caption[:1024],
                        "supports_streaming": "true",
                    }
                    resp = await client.post(url, data=data, files=files)
                    resp.raise_for_status()
                    logger.info("Video uploaded successfully to Telegram! ✅")
                    return True
        except Exception as e:
            logger.error(f"Failed to upload video to Telegram: {e}")
            return False


telegram_service = TelegramService()
```

---

### 12. `backend/services/youtube.py`
**الشرح:** استخدام `yt-dlp` خفيف لجلب بيانات الفيديو الفوقية وصورة الغلاف وعنوان الفيديو الأصلي دون تحميل محتوى الفيديو.

```python
"""
YouTube Service
"""

import asyncio
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class YouTubeService:
    async def get_info(self, url: str) -> dict:
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--no-playlist",
            "--skip-download",
            url,
        ]
        result = await self._run(cmd)
        return json.loads(result)

    async def _run(self, cmd: list) -> str:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"yt-dlp failed: {stderr.decode('utf-8', errors='replace')[:200]}")
        return stdout.decode("utf-8", errors="replace")


youtube_service = YouTubeService()
```

---

### 13. `backend/services/whisper_service.py`
**الشرح:** محول الصوت لنصوص. يتم استدعاؤه محلياً في الخلفية كخيار احتياطي لو تم تحميل صوت. ويعتمد على `faster-whisper` لسرعة تصل لـ 4 أضعاف.

```python
"""
Whisper Service — OPTIMIZED (faster-whisper instead of openai-whisper)
CTranslate2 backend with VAD filtering and int8/float16 quantization.
"""

import asyncio
import logging
from typing import Optional
from pathlib import Path
import torch

logger = logging.getLogger(__name__)

_HAS_CUDA = torch.cuda.is_available()
MODEL_SIZE = "large-v3" if _HAS_CUDA else "medium"
COMPUTE_TYPE = "float16" if _HAS_CUDA else "int8"


class WhisperService:
    """Wrapper for faster-whisper STT"""
    _model = None

    def _get_model(self):
        if self._model is None:
            from faster_whisper import WhisperModel
            device = "cuda" if _HAS_CUDA else "cpu"
            logger.info(f"Loading Whisper model: {MODEL_SIZE} on {device} ({COMPUTE_TYPE})")
            self._model = WhisperModel(
                MODEL_SIZE,
                device=device,
                compute_type=COMPUTE_TYPE,
                cpu_threads=4,
            )
        return self._model

    async def transcribe(self, audio_path: str, language: Optional[str] = None) -> dict:
        return await asyncio.to_thread(self._transcribe_sync, audio_path, language)

    def _transcribe_sync(self, audio_path: str, language: Optional[str]) -> dict:
        model = self._get_model()
        lang = language if language and language != "auto" else None

        segments_iter, info = model.transcribe(
            audio_path,
            language=lang,
            word_timestamps=True,
            vad_filter=True,  # Automatically strip silences: cleaner, faster, more accurate
        )

        segments = []
        full_text_parts = []
        for seg in segments_iter:
            segments.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip(),
            })
            full_text_parts.append(seg.text.strip())

        return {
            "text": " ".join(full_text_parts),
            "segments": segments,
            "language": info.language,
            "duration": segments[-1]["end"] if segments else 0,
        }

    async def generate_srt(self, segments: list, output_path: str) -> str:
        """Generate SRT subtitle file from segments"""
        srt_content = ""
        for i, seg in enumerate(segments, 1):
            start = self._format_time(seg["start"])
            end = self._format_time(seg["end"])
            text = seg["text"]
            srt_content += f"{i}\n{start} --> {end}\n{text}\n\n"

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(srt_content)

        return output_path

    def _format_time(self, seconds: float) -> str:
        """Convert seconds to SRT timestamp format"""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


whisper_service = WhisperService()
```

---

### 14. `backend/services/ffmpeg_service.py`
**الشرح:** محرك المونتاج الرئيسي. يقوم بتحميل مقاطع الفيديو الفردية، وتغيير حجمها ومقاسها (16:9 أو 9:16 أو 1:1)، وإضافة انتقالات الـ Fade، ودمج المقاطع بـ FFmpeg، وتركيب الفويس أوفر والموسيقى، وكتابة الترجمة المتحركة (Captions) فوق الفيديو. ويدعم تسريع كرت الشاشة NVENC والمعالجة المتوازية.

```python
"""
FFmpeg Service — Video Processing Engine (OPTIMIZED)
"""

import asyncio
import json
import logging
import os
import shutil
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

TEMP_DIR = Path("/tmp/vidai")
TEMP_DIR.mkdir(parents=True, exist_ok=True)

# Global HW encoder detection caching
_HW_ENCODER: Optional[str] = None


async def _detect_hw_encoder() -> Optional[str]:
    """Detects if NVENC (GPU) is available in FFmpeg"""
    global _HW_ENCODER
    if _HW_ENCODER is not None:
        return _HW_ENCODER if _HW_ENCODER != "none" else None

    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-hide_banner", "-encoders",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        text = stdout.decode("utf-8", errors="ignore")
        if "h264_nvenc" in text:
            _HW_ENCODER = "h264_nvenc"
            logger.info("✅ GPU encoding available (NVENC) — rendering will be much faster")
        else:
            _HW_ENCODER = "none"
            logger.info("⚠️ No GPU encoder found, using libx264 on CPU")
    except Exception:
        _HW_ENCODER = "none"
    return _HW_ENCODER if _HW_ENCODER != "none" else None


class FFmpegService:
    """FFmpeg wrapper for all video processing operations"""

    async def extract_frames(
        self,
        video_path: str,
        project_id: str,
        fps: float = 0.5,
    ) -> List[str]:
        """Extract frames from video (kept for utility/compatibility)"""
        output_dir = TEMP_DIR / project_id / "frames"
        output_dir.mkdir(parents=True, exist_ok=True)

        actual_video = None
        project_dir = TEMP_DIR / project_id

        if video_path and Path(video_path).exists():
            suffix = Path(video_path).suffix.lower()
            if suffix in (".mp4", ".webm", ".mkv", ".avi", ".mov"):
                actual_video = video_path

        if not actual_video:
            for ext in ("*.mp4", "*.webm", "*.mkv", "*.avi"):
                candidates = list(project_dir.glob(ext))
                if candidates:
                    actual_video = str(candidates[0])
                    break

        if not actual_video:
            return []

        frame_pattern = str(output_dir / "frame_%04d.jpg")
        cmd = [
            "ffmpeg", "-y",
            "-i", actual_video,
            "-vf", f"fps={fps},scale=640:-1",
            "-q:v", "3",
            frame_pattern,
        ]
        await self._run(cmd)
        return [str(f) for f in sorted(output_dir.glob("frame_*.jpg"))]

    async def create_scene_clip(
        self,
        video_url: str,
        duration: int,
        output_path: str,
        target_width: int = 1920,
        target_height: int = 1080,
    ) -> str:
        """Single-Pass optimized: downloads, scales, pads, and fades in one command"""
        fade_d = 0.4
        fade_out_start = max(duration - fade_d, 0)
        vf = (
            f"scale={target_width}:{target_height}:force_original_aspect_ratio=decrease,"
            f"pad={target_width}:{target_height}:(ow-iw)/2:(oh-ih)/2:color=black,"
            f"fade=t=in:st=0:d={fade_d},fade=t=out:st={fade_out_start}:d={fade_d}"
        )

        hw = await _detect_hw_encoder()
        if hw:
            encoder_args = ["-c:v", hw, "-preset", "p4", "-tune", "hq"]
        else:
            encoder_args = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-threads", "0"]

        cmd = [
            "ffmpeg", "-y",
            "-i", video_url,
            "-t", str(duration),
            "-vf", vf,
            *encoder_args,
            "-an",
            output_path,
        ]
        await self._run(cmd)
        return output_path

    async def create_scene_clips_parallel(
        self,
        scenes: List[dict],
        output_dir: Path,
        target_width: int = 1920,
        target_height: int = 1080,
        max_concurrent: int = 4,
    ) -> List[str]:
        """Process multiple scene clips concurrently using Semaphore limits"""
        semaphore = asyncio.Semaphore(max_concurrent)
        results: List[Optional[str]] = [None] * len(scenes)

        async def _process(i: int, scene: dict):
            async with semaphore:
                clip_path = str(output_dir / f"clip_{i:03d}.mp4")
                try:
                    await self.create_scene_clip(
                        video_url=scene["video_url"],
                        duration=scene["duration"],
                        output_path=clip_path,
                        target_width=target_width,
                        target_height=target_height,
                    )
                    results[i] = clip_path
                except Exception as e:
                    logger.warning(f"Failed to process scene {i}: {e}")
                    results[i] = None

            await asyncio.gather(*(_process(i, s) for i, s in enumerate(scenes)))
            return [r for r in results if r]

        async def concatenate_clips(self, clip_paths: List[str], output_path: str) -> str:
            concat_file = output_path.replace(".mp4", "_concat.txt")
            with open(concat_file, "w", encoding="utf-8") as f:
                for path in clip_paths:
                    escaped = path.replace("'", "'\\''")
                    f.write(f"file '{escaped}'\n")

            cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_file, "-c", "copy", output_path]
            await self._run(cmd)
            if os.path.exists(concat_file):
                os.remove(concat_file)
            return output_path

        async def mix_audio_and_render(
            self,
            video_path: str,
            voice_path: str,
            music_path: Optional[str],
            srt_path: Optional[str],
            output_path: str,
            music_volume: float = 0.12,
        ) -> str:
            has_music = bool(music_path and os.path.exists(music_path))
            has_srt = bool(srt_path and os.path.exists(srt_path))

            inputs = ["-i", video_path, "-i", voice_path]
            if has_music:
                inputs += ["-i", music_path]

            if has_music:
                audio_filter = (
                    f"[1:a]volume=1.0[v];"
                    f"[2:a]volume={music_volume}[m];"
                    f"[v][m]amix=inputs=2:duration=first:dropout_transition=3[aout]"
                )
                audio_map = ["-filter_complex", audio_filter, "-map", "0:v", "-map", "[aout]"]
            else:
                audio_map = ["-map", "0:v", "-map", "1:a"]

            vf_args = []
            if has_srt:
                safe_srt = srt_path.replace("\\", "/").replace(":", "\\:")
                style = "FontName=Arial,FontSize=24,Bold=1,PrimaryColour=&H00FFFFFF,Outline=2,Alignment=2"
                vf_args = ["-vf", f"subtitles='{safe_srt}':force_style='{style}'"]

            hw = await _detect_hw_encoder()
            if hw:
                encoder_args = ["-c:v", hw, "-preset", "p4"]
            else:
                encoder_args = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-threads", "0"]

            cmd = [
                "ffmpeg", "-y", *inputs, *audio_map, *vf_args,
                *encoder_args,
                "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output_path,
            ]
            await self._run(cmd)
            return output_path

        async def get_duration(self, path: str) -> float:
            cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", path]
            proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            stdout, _ = await proc.communicate()
            try:
                data = json.loads(stdout)
                return float(data.get("format", {}).get("duration", 0))
            except Exception:
                return 0.0

        async def download_video_clip(self, url: str, output_path: str, duration: int) -> str:
            cmd = ["ffmpeg", "-y", "-i", url, "-t", str(duration), "-c:v", "libx264", "-c:a", "aac", output_path]
            await self._run(cmd)
            return output_path

        async def image_to_video(
            self,
            image_path: str,
            duration: int,
            output_path: str,
            target_width: int = 1920,
            target_height: int = 1080,
        ) -> str:
            cmd = [
                "ffmpeg", "-y",
                "-loop", "1",
                "-i", image_path,
                "-vf", (
                    f"scale={target_width}:{target_height}:force_original_aspect_ratio=decrease,"
                    f"pad={target_width}:{target_height}:(ow-iw)/2:(oh-ih)/2:color=black,"
                    f"fade=t=in:st=0:d=0.3,fade=t=out:st={max(duration-0.3,0)}:d=0.3"
                ),
                "-t", str(duration),
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                "-pix_fmt", "yuv420p",
                "-an",
                output_path,
            ]
            await self._run(cmd)
            return output_path

        async def _run(self, cmd: list) -> None:
            proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                err_msg = stderr.decode("utf-8", errors="replace")[-500:]
                raise RuntimeError(f"FFmpeg failed (rc={proc.returncode}): {err_msg}")


ffmpeg_service = FFmpegService()
```
```

---

### 15. `backend/services/tts_service.py`
**الشرح:** خدمة جيل الصوت (TTS) باستخدام نموذج Kokoro المتطور والسريع لتوليد نصوص الفويس أوفر.

```python
"""
TTS Service using Kokoro
"""

import asyncio
import logging
from pathlib import Path
from typing import Optional
import soundfile as sf

logger = logging.getLogger(__name__)
TEMP_DIR = Path("/tmp/vidai")

VOICES = {
    "af_heart": {"lang": "a", "gender": "female", "style": "warm"},
    "af_sarah": {"lang": "a", "gender": "female", "style": "clear"},
    "am_michael": {"lang": "a", "gender": "male", "style": "deep"},
}


class TTSService:
    _pipelines = {}

    def _get_pipeline(self, lang_code: str):
        if lang_code not in self._pipelines:
            from kokoro import KPipeline
            self._pipelines[lang_code] = KPipeline(lang_code=lang_code)
        return self._pipelines[lang_code]

    async def generate(
        self,
        text: str,
        voice: str = "af_heart",
        speed: float = 1.0,
        output_path: Optional[str] = None,
    ) -> dict:
        voice_info = VOICES.get(voice, VOICES["af_heart"])
        lang_code = voice_info["lang"]
        if output_path is None:
            output_path = str(TEMP_DIR / f"tts_{voice}_{hash(text)}.wav")

        return await asyncio.to_thread(self._generate_sync, text, voice, lang_code, speed, output_path)

    def _generate_sync(self, text: str, voice: str, lang_code: str, speed: float, output_path: str) -> dict:
        pipeline = self._get_pipeline(lang_code)
        all_audio = []
        sample_rate = 24000
        for _, _, audio in pipeline(text, voice=voice, speed=speed):
            all_audio.append(audio)
        
        import numpy as np
        combined = np.concatenate(all_audio)
        sf.write(output_path, combined, sample_rate)
        return {
            "audio_path": output_path,
            "duration": len(combined) / sample_rate,
            "voice": voice,
        }

    def get_available_voices(self) -> list:
        return [{"id": k, "gender": v["gender"], "style": v["style"]} for k, v in VOICES.items()]


tts_service = TTSService()
```
