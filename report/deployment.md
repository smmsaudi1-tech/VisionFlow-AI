# دليل التشغيل والرفع (Deployment & Execution Guide)

يشرح هذا الملف طرق تشغيل المشروع محلياً وكيفية رفعه واستضافته على منصات السحاب مثل **Vercel** و **Cloudflare**.

---

## 1. التشغيل المحلي (Local Development)

لتشغيل المشروع بالكامل على جهازك:

### أ. تشغيل الواجهة (Frontend):
```cmd
cd frontend
npm install       # تثبيت الحزم (تم عملها بالفعل)
npm run dev       # تشغيل السيرفر المحلي للتطوير (على الرابط http://localhost:3000)
```

### ب. تشغيل الخلفية (Backend):
يتطلب وجود بايثون (Python 3.10+) ومثبت FFmpeg على جهازك.
```cmd
cd backend
pip install -r requirements.txt
copy .env.example .env
# قم بتعبئة مفاتيح الـ API في ملف .env
uvicorn main:app --host 0.0.0.0 --port 7860 --reload
```

---

## 2. الاستضافة والرفع (Cloudflare & Vercel)

### أ. الرفع على Vercel:
* تم ربط المشروع بـ Vercel مباشرة عبر GitHub.
* بمجرد عمل `push` لفرع الـ `master`، يقوم Vercel بسحب الكود تلقائياً وبناء مجلد `frontend` باستخدام الإعدادات القياسية لـ Next.js.
* بعد تثبيت الإصلاح الأخير (`7b98298`)، يكتمل بناء موقع Vercel بنجاح تام وبدون أخطاء.

### ب. الرفع على Cloudflare:
* يستخدم المشروع أداة `wrangler` للرفع والانتشار عبر Cloudflare.
* الرفع يتم تلقائياً عند دفع التحديثات، ويقوم بتشغيل البناء لإنتاج النسخة الساكنة (Static HTML/JS) ورفعها على شبكة Cloudflare السريعة.

---

## 3. أوامر Git المفيدة للمشروع

لرفع أي تعديل مستقبلي بضغطة زر واحدة:
```cmd
:: إضافة التعديلات
git add .

:: عمل commit بوصف التعديل
git commit -m "feat: description of changes"

:: الرفع النهائي لـ GitHub
git push origin master
```
**ملحوظة:** يوجد ملف سكربت جاهز باسم [PUSH_TO_GITHUB.bat](file:///c:/Users/youse/OneDrive/Desktop/يوتيوب/PUSH_TO_GITHUB.bat) في المجلد الرئيسي للمشروع، يمكنك تشغيله مباشرة ليقوم بعملية الرفع تلقائياً! ⚡
