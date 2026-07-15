"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Scissors,
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
function ProgressDisplay({
  status,
  onCancel,
}: {
  status: JobStatus;
  onCancel?: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);

  const handleCancelClick = async () => {
    if (!onCancel) return;
    setCancelling(true);
    try {
      await onCancel();
    } finally {
      setCancelling(false);
    }
  };

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

      {status.status !== "failed" && status.status !== "done" && onCancel && (
        <div className="mt-5 flex justify-center">
          <button
            onClick={handleCancelClick}
            disabled={cancelling}
            className="px-4 py-2 text-xs font-semibold text-red-400 border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelling ? (
              <Spinner size={14} className="animate-spin text-red-400" />
            ) : (
              <XCircle size={14} />
            )}
            إلغاء العملية
          </button>
        </div>
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
  const activeJobRef = useRef<string | null>(null);

  // ── Polling ────────────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/montage/status/${id}`);
      if (!res.ok || activeJobRef.current !== id) return;
      const data: JobStatus = await res.json();
      setJobStatus(data);

      if (data.status === "done") {
        stopPolling();
        // Fetch clips
        const clipRes = await fetch(`${API_BASE}/api/montage/clips/${id}`);
        if (clipRes.ok && activeJobRef.current === id) {
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
    activeJobRef.current = id;
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
    activeJobRef.current = null;
    setJobId(null);
    setJobStatus(null);
    setClips([]);
  };

  const handleCancel = async () => {
    if (!jobId) return;
    try {
      await fetch(`${API_BASE}/api/montage/cancel/${jobId}`, {
        method: "POST",
      });
    } catch (e) {
      console.error("Cancel request failed:", e);
    }
    handleReset();
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
                <ProgressDisplay status={jobStatus} onCancel={handleCancel} />
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
