# VidAI Studio — سيستم كامل لتوليد الفيديو بالذكاء الاصطناعي

## خطوات الإعداد الكاملة

---

### أولاً: إعداد Backend على Hugging Face Spaces

1. **إنشاء Space جديد على Hugging Face:**
   - اذهب لـ https://huggingface.co/spaces
   - اضغط "New Space"
   - اختر: SDK = **Docker**, Hardware = **CPU Basic** (مجاني)
   - ارفع مجلد `backend/` كاملاً

2. **إضافة Secrets في HF Space:**
   ```
   Settings → Repository Secrets
   GEMINI_API_KEY    = (من https://aistudio.google.com)
   PEXELS_API_KEY    = (من https://www.pexels.com/api)
   PIXABAY_API_KEY   = (من https://pixabay.com/api/docs)
   SUPABASE_URL      = (من Supabase Dashboard)
   SUPABASE_KEY      = (Anon Key من Supabase)
   ```

3. **رابط الـ API سيكون:**
   ```
   https://YOUR-USERNAME-YOUR-SPACE-NAME.hf.space
   ```

---

### ثانياً: إعداد Supabase (قاعدة البيانات)

1. اذهب لـ https://supabase.com → New Project
2. نفّذ هذا SQL في SQL Editor:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  youtube_url TEXT,
  status TEXT DEFAULT 'pending',
  thumbnail TEXT,
  duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analyses table
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  transcript JSONB DEFAULT '[]',
  scenes JSONB DEFAULT '[]',
  keywords TEXT[] DEFAULT '{}',
  hashtags TEXT[] DEFAULT '{}',
  summary TEXT,
  content_type TEXT,
  target_audience TEXT,
  chapters JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scripts table
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  hashtags TEXT[] DEFAULT '{}',
  script_text TEXT,
  scenes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Renders table
CREATE TABLE IF NOT EXISTS renders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'queued',
  output_url TEXT,
  duration FLOAT,
  format TEXT DEFAULT '16:9',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### ثالثاً: إعداد Frontend على Vercel

1. **نشر على Vercel:**
   ```bash
   cd frontend
   npm install
   npx vercel deploy --prod
   ```

2. **أو من Vercel Dashboard:**
   - Import Git Repository
   - Set Root Directory = `frontend`
   - Add Environment Variables:
     ```
     NEXT_PUBLIC_API_URL = https://YOUR-HF-SPACE.hf.space
     ```

---

### رابعاً: تشغيل محلي للتطوير

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
cp .env.example .env  # ثم عبّى المتغيرات
uvicorn main:app --host 0.0.0.0 --port 7860 --reload

# 2. Frontend (تانيال جديد)
cd frontend
npm install
npm run dev
# افتح http://localhost:3000
```

**أو بـ Docker:**
```bash
cp .env.example .env  # عبّى المتغيرات
docker-compose up --build
```

---

### الـ API Keys المطلوبة

| Key | مجاني؟ | من أين تحصل عليه |
|-----|--------|-----------------|
| `GEMINI_API_KEY` | ✅ مجاني | https://aistudio.google.com |
| `PEXELS_API_KEY` | ✅ مجاني | https://www.pexels.com/api |
| `PIXABAY_API_KEY` | ✅ مجاني | https://pixabay.com/api/docs |
| `SUPABASE_URL/KEY` | ✅ مجاني | https://supabase.com |

---

### هيكل المشروع النهائي

```
يوتيوب/
├── backend/
│   ├── main.py              ← FastAPI app + WebSocket
│   ├── Dockerfile           ← للـ HF Space
│   ├── requirements.txt
│   ├── .env.example
│   ├── routers/
│   │   ├── analyze.py       ← YouTube → Whisper → Gemini
│   │   ├── script.py        ← Script rewriting
│   │   ├── media.py         ← Pexels/Pixabay search
│   │   ├── tts.py           ← Kokoro TTS
│   │   └── render.py        ← FFmpeg render pipeline
│   ├── services/
│   │   ├── youtube.py       ← yt-dlp wrapper
│   │   ├── whisper_service.py
│   │   ├── gemini_service.py
│   │   ├── ffmpeg_service.py
│   │   ├── tts_service.py
│   │   └── media_search.py
│   └── models/
│       └── schemas.py       ← Pydantic schemas
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx       ← Root layout (dark, RTL)
│   │   ├── globals.css      ← Design system
│   │   ├── page.tsx         ← Landing page
│   │   ├── dashboard/       ← Projects dashboard
│   │   ├── analyze/[id]/    ← Analysis results
│   │   └── studio/[id]/     ← Video editor
│   ├── components/
│   │   └── HeroInput.tsx
│   ├── lib/
│   │   ├── api.ts           ← API client
│   │   └── types.ts         ← TypeScript types
│   ├── package.json
│   ├── tailwind.config.js
│   └── next.config.js
│
└── docker-compose.yml       ← Local dev
```
