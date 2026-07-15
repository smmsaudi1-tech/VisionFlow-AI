## ملاحظة مهمة: تثبيت الـ Dependencies

بسبب أن اسم المجلد بالعربية، شغّل الأوامر دي يدوياً من Command Prompt أو PowerShell:

### Frontend:
```cmd
cd "c:\Users\youse\OneDrive\Desktop\يوتيوب\frontend"
npm install
npm run dev
```

### Backend (محتاج Python 3.10+):
```cmd
cd "c:\Users\youse\OneDrive\Desktop\يوتيوب\backend"
pip install -r requirements.txt
copy .env.example .env
rem عبّى الـ API keys في ملف .env
uvicorn main:app --host 0.0.0.0 --port 7860 --reload
```

### للرندر: FFmpeg لازم يكون مثبت على الجهاز:
```
https://ffmpeg.org/download.html
```
أو بـ chocolatey: `choco install ffmpeg`
