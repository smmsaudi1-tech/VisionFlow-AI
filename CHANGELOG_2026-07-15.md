# 📋 سجل شغل يوم 15 يوليو 2026
## VisionFlow-AI — قسم المونتاج

---

## 🎯 الهدف

إضافة قسم **مونتاج** منفصل تماماً داخل نفس موقع VisionFlow-AI.  
المستخدم يلصق رابط فيديو (يوتيوب / بودكاست / بث) أو يرفع ملف — الذكاء الاصطناعي يلاقي أحسن اللحظات، يقيّمها بدرجات، ويرجّع مجموعة كليبات جاهزة للنشر.

---

## 🏗 المعمارية العامة

```
User → /montage (Frontend)
         ↓
POST /api/montage/analyze  →  job_id
         ↓ (background task)
  1. YouTube Transcript API  →  segments + timestamps
  2. yt-dlp (اختياري)        →  video.mp4 للقص
  3. Gemini AI               →  تقييم كل لحظة (hook/story/payoff/virality)
  4. FFmpeg                  →  كليبات MP4 مقصوصة
         ↓ (polling كل 4 ثانية)
GET /api/montage/status/{job_id}
         ↓ done
GET /api/montage/clips/{job_id}  →  شبكة كليبات متقيّمة
         ↓
GET /api/montage/download/{job_id}/{clip_id}  →  MP4
```

---

## 📁 الملفات الجديدة

### Backend

#### `backend/models/montage_schemas.py`
Pydantic models مستقلة للـ Montage API:
- `MontageAnalyzeRequest` — طلب التحليل (url, language, brief, min/max duration, max_clips)
- `MontageJobResponse` — رد بدء الجوب
- `MontageStatusResponse` — حالة الجوب للـ polling
- `ClipScore` — درجات الكليب (hook 0-10, story 0-10, payoff 0-10, virality 0-100)
- `ClipResult` — نتيجة الكليب الواحد
- `MontageClipsResponse` — قايمة الكليبات

#### `backend/state_montage.py`
State manager منفصل لـ jobs المونتاج:
- `create_montage_job / get_montage_job / update_montage_job / delete_montage_job`
- Cleanup loop بيمسح jobs أقدم من ساعتين
- معزول تماماً عن `state.py` الأصلي

#### `backend/services/clip_cutter.py`
FFmpeg + yt-dlp service:
- `download_video_audio()` — ينزّل الفيديو بـ yt-dlp (مع SSL bypass flags)
- `download_audio_only()` — ينزّل الصوت بس للتفريغ
- `cut_clip()` — يقص كليب من start→end بـ FFmpeg مع crop مركزي 9:16
- `get_job_dir()` — مجلد الـ job

#### `backend/services/montage_analyzer.py`
Pipeline التحليل الرئيسي:
- `run_montage_pipeline()` — الـ pipeline كامل كـ background task
- `_try_youtube_transcript_api()` — يجيب التفريغ من YouTube Transcript API بدون تنزيل
- `_score_moments_with_gemini()` — يبعت التفريغ لـ Gemini ويطلب تقييم كل لحظة
- `_fallback_chunk_segments()` — fallback لو Gemini فشل
- `_build_youtube_timestamp_url()` — يبني رابط يوتيوب بـ timestamp

#### `backend/routers/montage.py`
FastAPI router بـ prefix `/api/montage`:

| Method | Endpoint | الوظيفة |
|--------|----------|---------|
| POST | `/api/montage/analyze` | تحليل رابط URL |
| POST | `/api/montage/analyze/upload` | رفع ملف فيديو |
| GET | `/api/montage/status/{job_id}` | polling الحالة |
| GET | `/api/montage/clips/{job_id}` | جيب الكليبات |
| GET | `/api/montage/download/{job_id}/{clip_id}` | تحميل MP4 |

---

### Frontend

#### `frontend/app/montage/layout.tsx`
Layout مستقل بـ metadata خاصة بقسم المونتاج.

#### `frontend/app/montage/page.tsx`
الصفحة الرئيسية — client-side كاملة:
- **Idle state** — Hero + شرح 4 خطوات
- **Processing state** — Progress bar حقيقي مع stage labels عربية
- **Done state** — شبكة كليبات مع sort control
- **Failed state** — رسالة خطأ + زر "حاول تاني"
- Polling كل 4 ثواني تلقائي

#### `frontend/components/montage/MontageInput.tsx`
- Tab switcher: رابط URL ↔ رفع ملف
- Drag & drop zone
- Language selector (auto / عربي / English / Français / Español / Deutsch / Türkçe)
- Brief upload — يقرا .txt أو .pdf
- Error handling بـ رسائل عربية

#### `frontend/components/montage/ClipCard.tsx`
- Virality badge — 🔥 فايرال (≥80) / ⚡ قوي (≥65) / ✓ جيد
- Score bars — Hook / Story / Payoff
- Collapsible transcript مع نسخ
- زر تحميل MP4 أو فتح على يوتيوب

#### `frontend/components/montage/ScoreBar.tsx`
شريط نسبة 0-10 متحرك بـ glow effect.

---

### تعديلات على ملفات موجودة (12 سطر بس)

#### `backend/main.py`
```python
from routers import analyze, script, render, tts, media_router, montage
app.include_router(montage.router)
```

#### `frontend/app/page.tsx`
```tsx
// Link import + ناف لينك "مونتاج ✂️" في الـ navbar
```

---

## 🐛 المشاكل اللي اتحلت

### المشكلة 1 — SSL Block

**الخطأ:**
```
SSLError('[SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol')
```

**السبب:** HuggingFace Spaces بيبلوك YouTube بالكامل على مستوى الشبكة.

**الإصلاح الأول — SSL bypass flags على yt-dlp:**
```python
"--no-check-certificate"
"--prefer-insecure"
"--legacy-server-connect"
"--retries", "3"
# + 3 format fallbacks
```

### المشكلة 2 — yt-dlp بيفشل بكل الـ formats

SSL flags ما نفعتش — YouTube بيبلوك HF على مستوى الـ IP.

**الإصلاح الجذري — Transcript-Only Mode:**

```
YouTube URL
    ↓
YouTube Transcript API  ✅ بيشتغل على HF
    ↓
yt-dlp video download  ❌ بيفشل على HF (expected)
    ↓ (لو عندنا transcript)
Transcript-Only Mode:
  ✅ Gemini يقيّم اللحظات
  ✅ بدل MP4: لينك يوتيوب + timestamp
  مثال: youtube.com/watch?v=xxx&t=127s
```

**النتيجة:**
- روابط يوتيوب → تقييم كامل + لينكات timestamps ✅
- ملفات مرفوعة → قص MP4 حقيقي ✅

---

## 🔄 نظام التقييم

| المؤشر | المدى | الوصف |
|--------|-------|-------|
| **Hook** | 0–10 | قوة الجملة الأولى |
| **Story** | 0–10 | تماسك الحكاية |
| **Payoff** | 0–10 | وضوح الخاتمة |
| **Virality** | 0–100 | الدرجة النهائية |

**Virality ≥ 80** → 🔥 فايرال  
**Virality ≥ 65** → ⚡ قوي  
**Virality < 65** → ✓ جيد  

---

## 📋 Modes التشغيل

### Video Mode (ملفات مرفوعة)
```
Upload → Whisper → Gemini → FFmpeg cut → MP4
```

### Transcript Mode (روابط يوتيوب على HF)
```
YouTube URL → Transcript API → Gemini → YouTube timestamp links
```

---

## 🗂 الـ Requirements
مفيش حاجة جديدة — كل المكتبات كانت موجودة بالفعل في `requirements.txt`:
- `faster-whisper` ✅
- `yt-dlp` ✅
- `youtube-transcript-api` ✅
- `google-generativeai` ✅
- `ffmpeg` ✅

---

## 📊 إجمالي الشغل

| # | الملف | الحجم |
|---|-------|-------|
| 1 | `backend/models/montage_schemas.py` | ~50 سطر |
| 2 | `backend/state_montage.py` | ~35 سطر |
| 3 | `backend/services/clip_cutter.py` | ~180 سطر |
| 4 | `backend/services/montage_analyzer.py` | ~450 سطر |
| 5 | `backend/routers/montage.py` | ~150 سطر |
| 6 | `frontend/app/montage/layout.tsx` | ~25 سطر |
| 7 | `frontend/app/montage/page.tsx` | ~330 سطر |
| 8 | `frontend/components/montage/MontageInput.tsx` | ~230 سطر |
| 9 | `frontend/components/montage/ClipCard.tsx` | ~155 سطر |
| 10 | `frontend/components/montage/ScoreBar.tsx` | ~35 سطر |
| 11 | `backend/main.py` | +2 سطر |
| 12 | `frontend/app/page.tsx` | +10 سطر |

**إجمالي كود جديد: ~1650 سطر**  
**تأثير على الكود القديم: 12 سطر فقط**

---

## 🚀 للـ Deploy

### Backend → HuggingFace
شغّل `backend/DEPLOY_TO_HF.bat` بـ double click

### Frontend → GitHub → Vercel
```powershell
git checkout --orphan clean-master
git reset
git add -A
git commit -m "feat: montage section — AI clip detection pipeline"
git push origin clean-master:master --force
git checkout clean-master
git branch -D temp-cleanup-master
```

**URL بعد الـ Deploy:**
```
https://vision-flow-ai-tawny.vercel.app/montage
```

---

*آخر تحديث: 15 يوليو 2026 — VisionFlow-AI Montage Section*
