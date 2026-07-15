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

  // ── Video Validator ─────────────────────────────────────────────────────────
  const validateAndSetVideoFile = (f: File) => {
    setError(null);
    const allowedExt = /\.(mp4|mov|mkv|webm|m4v|avi)$/i;
    if (f.type.startsWith("video/") || allowedExt.test(f.name)) {
      if (f.size > 500 * 1024 * 1024) {
        setError("الفيديو أكبر من 500MB — جرب رابط بدل الرفع المباشر");
        return false;
      }
      setVideoFile(f);
      return true;
    } else {
      setError("نوع الملف مش مدعوم. المسموح: mp4, mov, mkv, webm, m4v, avi");
      return false;
    }
  };

  // ── Brief file reader ───────────────────────────────────────────────────────
  const extractPdfText = async (file: File): Promise<string> => {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str).join(" ") + "\n";
    }
    return text;
  };

  const handleBriefChange = async (f: File) => {
    setError(null);
    setBriefFile(f);
    try {
      if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
        const text = await extractPdfText(f);
        setBrief(text.slice(0, 2000));
      } else {
        const text = await f.text();
        setBrief(text.slice(0, 2000));
      }
    } catch {
      setError("مقدرتش أقرا الملف — جرب ملف .txt بدل .pdf");
    }
  };

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (!f) return;
      if (validateAndSetVideoFile(f)) {
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
              if (f) validateAndSetVideoFile(f);
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
