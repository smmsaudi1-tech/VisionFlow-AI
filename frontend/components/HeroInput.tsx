"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { YoutubeLogo, Sparkle, NotePencil } from "@phosphor-icons/react";
import { analyzeApi } from "@/lib/api";
import { useRouter } from "next/navigation";

const STATUS_MAP: Record<string, string> = {
  processing: "جاري تحليل ومعالجة المحتوى واستخراج المشاهد...",
  done: "اكتملت المعالجة! جاري توجيهك للاستوديو...",
  failed: "حدث خطأ أثناء معالجة المحتوى",
};

export default function HeroInput() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"youtube" | "script">("youtube");
  
  // YouTube states
  const [url, setUrl] = useState("");
  
  // Custom Script states
  const [scriptText, setScriptText] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // Options state
  const [showOptions, setShowOptions] = useState(false);
  const [targetDuration, setTargetDuration] = useState(300);
  const [textDensity, setTextDensity] = useState("medium");
  const [sceneFrequency, setSceneFrequency] = useState("medium");
  const [language, setLanguage] = useState("ar");

  const handleAnalyze = async () => {
    const trimmed = url.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError("");
    setStatus("processing");

    try {
      const { project_id } = await analyzeApi.start(
        trimmed,
        language,
        targetDuration,
        textDensity,
        sceneFrequency
      );

      // Poll until done
      const interval = setInterval(async () => {
        try {
          const res = await analyzeApi.get(project_id);
          setStatus(res.status);
          if (res.status === "done") {
            clearInterval(interval);
            router.push(`/studio?id=${project_id}`);
          } else if (res.status === "failed") {
            clearInterval(interval);
            setError(res.error || "فشل التحليل");
            setLoading(false);
          }
        } catch (err) {
          clearInterval(interval);
          setError("فشل الاتصال بالخادم");
          setLoading(false);
        }
      }, 3000);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      setError(msg);
      setLoading(false);
    }
  };

  const handleAnalyzeScript = async () => {
    const trimmed = scriptText.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError("");
    setStatus("processing");

    try {
      const { project_id } = await analyzeApi.startScript(
        trimmed,
        language,
        targetDuration,
        textDensity,
        sceneFrequency
      );

      // Poll until done
      const interval = setInterval(async () => {
        try {
          const res = await analyzeApi.get(project_id);
          setStatus(res.status);
          if (res.status === "done") {
            clearInterval(interval);
            router.push(`/studio?id=${project_id}`);
          } else if (res.status === "failed") {
            clearInterval(interval);
            setError(res.error || "فشل معالجة السكربت");
            setLoading(false);
          }
        } catch (err) {
          clearInterval(interval);
          setError("فشل الاتصال بالخادم");
          setLoading(false);
        }
      }, 3000);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      {/* Tabs */}
      <div className="flex items-center justify-center p-1 rounded-xl bg-white/5 border border-white/8 w-fit mx-auto animate-fade-in">
        <button
          onClick={() => {
            setActiveTab("youtube");
            setError("");
          }}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
            activeTab === "youtube"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/10"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <YoutubeLogo size={16} weight="fill" />
          <span>رابط يوتيوب 🎥</span>
        </button>
        <button
          onClick={() => {
            setActiveTab("script");
            setError("");
          }}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
            activeTab === "script"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/10"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <NotePencil size={16} weight="fill" />
          <span>كتابة سكربت مخصص ✍️</span>
        </button>
      </div>

      {/* Input / Textarea */}
      <div className="relative group text-right">
        {activeTab === "youtube" ? (
          <div className="relative">
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 transition-transform group-focus-within:scale-110">
              <YoutubeLogo size={22} weight="fill" />
            </div>

            <input
              id="youtube-url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              placeholder="https://youtube.com/watch?v=..."
              className="input-field pr-12 pl-40 font-mono text-sm"
              dir="ltr"
              disabled={loading}
              autoComplete="off"
              spellCheck={false}
            />

            <button
              id="start-analyze-btn"
              onClick={handleAnalyze}
              disabled={loading || !url.trim()}
              className="btn-primary absolute left-2 top-1/2 -translate-y-1/2 py-2 px-5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري التحليل</span>
                </>
              ) : (
                <>
                  <Sparkle size={16} weight="fill" />
                  <span>ابدأ التحليل</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              id="custom-script-textarea"
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="اكتب السكربت الكامل للفيديو الخاص بك هنا بالتفصيل والمشاهد، وسيقوم النظام بتقسيمه وإنشاء لقطات متطابقة والتعليق الصوتي والمونتاج التلقائي..."
              rows={6}
              disabled={loading}
              className="input-field w-full p-4 text-sm resize-none"
              dir="rtl"
            />
            
            <div className="flex justify-start">
              <button
                id="start-script-btn"
                onClick={handleAnalyzeScript}
                disabled={loading || !scriptText.trim()}
                className="btn-primary py-3 px-8 text-sm font-semibold flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جاري معالجة السكربت</span>
                  </>
                ) : (
                  <>
                    <Sparkle size={16} weight="fill" />
                    <span>إنشاء فيديو من السكربت 🚀</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings Toggle */}
      <div className="flex justify-end">
        <button
          id="toggle-options-btn"
          type="button"
          onClick={() => setShowOptions(!showOptions)}
          className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1.5 transition-colors font-medium py-1.5 px-3 rounded-lg bg-white/5 border border-white/8 hover:bg-white/10 focus:outline-none"
        >
          <span>⚙️ تخصيص خيارات الفيديو</span>
          <span className={`transform transition-transform duration-205 ${showOptions ? "rotate-180" : ""}`}>▼</span>
        </button>
      </div>

      {/* Options Panel */}
      <AnimatePresence>
        {showOptions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-5 rounded-2xl bg-white/3 border border-white/6 space-y-5 text-right">
              {/* Option 1: Duration */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-2">⏱️ مدة الفيديو المطلوبة</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "5 دقائق (300ث)", value: 300 },
                    { label: "7 دقائق (420ث)", value: 420 },
                    { label: "10 دقائق (600ث)", value: 600 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTargetDuration(opt.value)}
                      className={`py-2.5 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                        targetDuration === opt.value
                          ? "bg-violet-600 border-violet-500 text-white"
                          : "bg-space-950/40 border-white/5 text-zinc-400 hover:bg-white/5"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 2: Text Density */}
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-2">💬 كمية الكلام (التعليق الصوتي)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "كلام كتير", value: "high" },
                      { label: "متوسط", value: "medium" },
                      { label: "كلام قليل", value: "low" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTextDensity(opt.value)}
                        className={`py-2 px-1 rounded-lg text-xs font-medium border text-center transition-all ${
                          textDensity === opt.value
                            ? "bg-violet-600 border-violet-500 text-white"
                            : "bg-space-950/40 border-white/5 text-zinc-400 hover:bg-white/5"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Option 3: Scene Frequency */}
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-2">🎬 سرعة لقطات الفيديو</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "مشاهد كتير", value: "high" },
                      { label: "متوسط", value: "medium" },
                      { label: "مشاهد قليلة", value: "low" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSceneFrequency(opt.value)}
                        className={`py-2 px-1 rounded-lg text-xs font-medium border text-center transition-all ${
                          sceneFrequency === opt.value
                            ? "bg-violet-600 border-violet-500 text-white"
                            : "bg-space-950/40 border-white/5 text-zinc-400 hover:bg-white/5"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Option 4: Script Language */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-2">🌐 لغة السكربت والتعليق الصوتي</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "العربية الفصحى", value: "ar" },
                    { label: "English", value: "en" },
                    { label: "عربيزي (مزيج)", value: "ar-en" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLanguage(opt.value)}
                      className={`py-2.5 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                        language === opt.value
                          ? "bg-violet-600 border-violet-500 text-white"
                          : "bg-space-950/40 border-white/5 text-zinc-400 hover:bg-white/5"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status message */}
      <AnimatePresence mode="wait">
        {loading && status && (
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-600/10 border border-violet-600/20 overflow-hidden"
          >
            <div className="flex gap-1 shrink-0">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-sm text-violet-300">
              {STATUS_MAP[status] || status}
            </span>
          </motion.div>
        )}

        {/* Error message */}
        {error && !loading && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20"
          >
            <div className="w-4 h-4 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
              <span className="text-red-400 text-xs font-bold">!</span>
            </div>
            <span className="text-sm text-red-400">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-xs text-zinc-500">
        مجاني تماماً · لا تسجيل دخول · Hugging Face + Vercel
      </p>
    </div>
  );
}
