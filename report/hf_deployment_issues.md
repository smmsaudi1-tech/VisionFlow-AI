# تقرير: مشاكل النشر على Hugging Face Spaces وحلولها

**تاريخ:** 2026-07-12  
**المشروع:** VidAI Studio — Backend API  
**الهدف:** نشر FastAPI backend على Hugging Face Spaces مجاناً

---

## المشاكل التي واجهناها والحلول

---

### 🔴 المشكلة 1: خطأ `pkg_resources` عند بناء `openai-whisper`

**الخطأ:**
```
ModuleNotFoundError: No module named 'pkg_resources'
ERROR: Failed to build 'openai-whisper' when getting requirements to build wheel
```

**السبب:**  
مكتبة `openai-whisper==20231117` كانت تحاول البناء من الكود المصدري (source build)، وكانت تعتمد على `pkg_resources` الذي هو جزء من `setuptools`، وكان غير موجود في بيئة HF.

**الحل:**
1. إضافة `setuptools` كأول سطر في `requirements.txt` لضمان وجوده قبل أي شيء.
2. إزالة pin النسخة من `openai-whisper==20231117` → استخدام `openai-whisper` (أحدث نسخة) التي تأتي بـ pre-built wheel جاهز.

```diff
+ setuptools
  fastapi==0.115.0
  uvicorn[standard]==0.30.6
- openai-whisper==20231117
+ openai-whisper
```

---

### 🔴 المشكلة 2: تعارض `aiofiles` مع Gradio 5.0.0

**الخطأ:**
```
ERROR: Cannot install aiofiles==24.1.0 and gradio because these package versions have conflicting dependencies.
The conflict is caused by: gradio 5.0.0 requires aiofiles<24.0 and >=22.0
```

**السبب:**  
كنا نطلب `aiofiles==24.1.0` في `requirements.txt`، لكن Gradio 5.0.0 (الذي يثبته HF تلقائياً مع Gradio SDK) يشترط `aiofiles<24.0`.

**الحل:**  
تغيير pin النسخة ليكون متوافقاً مع Gradio:
```diff
- aiofiles==24.1.0
+ aiofiles>=22.0,<24.0
```

---

### 🔴 المشكلة 3: README.md بدون metadata — `configuration error`

**الخطأ:**
```
configuration error
Missing configuration in README
```

**السبب:**  
ملف `README.md` في السبيس لم يكن يحتوي على الـ YAML frontmatter المطلوب من Hugging Face لمعرفة نوع الـ SDK ونقطة التشغيل.

**الحل:**  
إضافة الـ metadata في أعلى `README.md`:
```yaml
---
title: VidAI Backend
emoji: 🎥
colorFrom: indigo
colorTo: purple
sdk: gradio
sdk_version: "5.0.0"
python_version: "3.10"
app_file: app.py
pinned: false
---
```

---

### 🔴 المشكلة 4: ZeroGPU — `configuration error: ZeroGPU is only available on Gradio SDK`

**الخطأ:**
```
ZeroGPU is only available on Gradio SDK
```

**السبب:**  
كنا قد بدّلنا الـ SDK في README إلى `sdk: docker` لحل تعارض الـ Gradio، لكن السبيس الأصلي كان يستخدم ZeroGPU الذي يعمل **فقط** مع Gradio SDK.

**الحل:**  
- محاولة 1: تغيير Hardware في إعدادات السبيس من ZeroGPU إلى CPU Basic ← **فشل** (يحتاج PRO subscription).
- محاولة 2: حذف السبيس القديم وإنشاء سبيس جديد مع اختيار **Gradio SDK + CPU Basic** من البداية.
- **النتيجة:** استخدام سبيس جديد باسم `Yousef891238/088098` مع Gradio SDK.

---

### 🔴 المشكلة 5: `app.py` غير متوافق مع Gradio SDK

**المشكلة:**  
ملف `app.py` الأصلي كان يشغّل `uvicorn` مباشرة:
```python
import uvicorn
from main import app

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
```
هذا لا يعمل مع Gradio SDK لأن HF يتوقع تطبيق Gradio كـ entry point، وليس uvicorn مباشر.

**الحل:**  
إعادة كتابة `app.py` باستخدام `gr.mount_gradio_app` الذي يدمج FastAPI داخل Gradio:
```python
import gradio as gr
from main import app  # FastAPI app

with gr.Blocks(title="VidAI Studio Backend") as demo:
    gr.Markdown("# 🎥 VidAI Studio — Backend API")
    gr.Markdown("Access API docs at [/docs](/docs)")

# يدمج FastAPI مع Gradio في تطبيق ASGI واحد
app = gr.mount_gradio_app(app, demo, path="/ui")
```

---

### 🔴 المشكلة 6: `kokoro==0.9.4` لا تدعم Python 3.13

**الخطأ:**
```
ERROR: Could not find a version that satisfies the requirement kokoro==0.9.4
Ignored the following versions: 0.9.4 Requires-Python >=3.10,<3.13
```

**السبب:**  
الفضاء (`Space`) الجديد كان يستخدم Python 3.13 بشكل افتراضي، وكوكورو في **جميع نسخها** (0.7.x و 0.8.x و 0.9.x) تشترط Python < 3.13.

**محاولات فاشلة:**
- تجربة `kokoro==0.7.16` ← فشل (أيضاً تشترط < 3.13)
- تجربة `kokoro` بدون pin ← فشل (نفس المشكلة)

**الحل الصحيح:**  
إجبار HF على استخدام Python 3.10 بإضافة سطر في `README.md`:
```yaml
python_version: "3.10"
```
مما يجعل HF يستخدم image بـ Python 3.10 وتعمل kokoro 0.9.4 بشكل طبيعي.

---

## ملخص التغييرات النهائية

| الملف | التغيير |
|-------|---------|
| `backend/requirements.txt` | إضافة `setuptools`، تحديث `openai-whisper`، إصلاح `aiofiles`, `kokoro` |
| `backend/README.md` | إضافة YAML metadata كامل + `python_version: "3.10"` |
| `backend/app.py` | إعادة كتابة كـ Gradio wrapper باستخدام `gr.mount_gradio_app` |
| `backend/main.py` | إضافة Vercel URL و HF Space URL في CORS allowed origins |

---

## الدرس المستفاد

> **قبل رفع أي Python project على Hugging Face Spaces:**
> 1. حدد `python_version` صراحة في README.md لتجنب مفاجآت Python 3.13
> 2. تجنب pin نسخة `aiofiles` إذا كنت تستخدم Gradio SDK
> 3. استخدم `gr.mount_gradio_app` لدمج FastAPI مع Gradio بشكل صحيح
> 4. أضف `setuptools` كأول dependency لتجنب أخطاء `pkg_resources`
