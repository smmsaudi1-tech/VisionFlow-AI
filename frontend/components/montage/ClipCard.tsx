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
      ? { label: "فايرال", icon: Sparkle, color: "#FF6B35", bg: "rgba(255,107,53,0.12)" }
      : score >= 65
      ? { label: "قوي", icon: Lightning, color: "#6C63FF", bg: "rgba(108,99,255,0.12)" }
      : { label: "جيد", icon: CheckCircle, color: "#10B981", bg: "rgba(16,185,129,0.12)" };

  const Icon = tier.icon;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ color: tier.color, background: tier.bg, border: `1px solid ${tier.color}30` }}
    >
      <Icon size={12} weight="fill" />
      <span>{tier.label}</span>
      <span className="opacity-40">|</span>
      <span>{score}</span>
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
