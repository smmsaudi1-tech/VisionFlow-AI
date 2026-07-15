"use client";

import { useState, useEffect, useRef } from "react";
import { MusicNote, SpeakerHigh, SpeakerX, Play, Pause } from "@phosphor-icons/react";

interface MoodOption {
  value: string;
  label: string;
  emoji: string;
}

interface MusicPickerProps {
  selectedMood: string;
  onMoodChange: (mood: string) => void;
  musicVolume: number;
  onVolumeChange: (volume: number) => void;
}

const DEFAULT_MOODS: MoodOption[] = [
  { value: "none", label: "بدون موسيقى", emoji: "🔇" },
  { value: "upbeat", label: "حماسية / نشطة", emoji: "🎵" },
  { value: "calm", label: "هادئة / مريحة", emoji: "🎶" },
  { value: "dramatic", label: "دراما / سينمائية", emoji: "🎬" },
  { value: "educational", label: "تعليمية / بسيطة", emoji: "📚" },
];

export function MusicPicker({
  selectedMood,
  onMoodChange,
  musicVolume,
  onVolumeChange,
}: MusicPickerProps) {
  const [moods, setMoods] = useState<MoodOption[]>(DEFAULT_MOODS);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleMoodSelect = async (mood: string) => {
    onMoodChange(mood);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (mood === "none") {
      setPreviewUrl(null);
      return;
    }
    // Fetch preview URL
    setLoading(true);
    try {
      const res = await fetch(`/api/music/search?mood=${mood}&duration=60`);
      const data = await res.json();
      if (data.result?.url) {
        setPreviewUrl(data.result.url);
      }
    } catch (e) {
      console.error("Music preview failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const togglePreview = () => {
    if (!previewUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(previewUrl);
      audioRef.current.volume = musicVolume;
      audioRef.current.loop = true;
      audioRef.current.onended = () => setIsPlaying(false);
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.src = previewUrl;
      audioRef.current.volume = musicVolume;
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicVolume;
    }
  }, [musicVolume]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  return (
    <div className="music-picker">
      <div className="music-picker-header">
        <MusicNote size={18} weight="fill" />
        <span>موسيقى خلفية</span>
      </div>

      <div className="mood-grid">
        {moods.map((mood) => (
          <button
            key={mood.value}
            className={`mood-btn ${selectedMood === mood.value ? "mood-btn--active" : ""}`}
            onClick={() => handleMoodSelect(mood.value)}
          >
            <span className="mood-emoji">{mood.emoji}</span>
            <span className="mood-label">{mood.label}</span>
          </button>
        ))}
      </div>

      {selectedMood !== "none" && (
        <div className="music-controls">
          <button
            className={`preview-btn ${isPlaying ? "preview-btn--playing" : ""}`}
            onClick={togglePreview}
            disabled={loading || !previewUrl}
          >
            {loading ? (
              <span className="spinner-sm" />
            ) : isPlaying ? (
              <Pause size={16} weight="fill" />
            ) : (
              <Play size={16} weight="fill" />
            )}
            <span>{loading ? "جاري التحميل..." : isPlaying ? "إيقاف المعاينة" : "معاينة الموسيقى"}</span>
          </button>

          <div className="volume-control">
            <SpeakerX size={16} />
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.01}
              value={musicVolume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="volume-slider"
            />
            <SpeakerHigh size={16} />
            <span className="volume-label">{Math.round(musicVolume * 200)}%</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .music-picker {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .music-picker-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #a78bfa;
        }
        .mood-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .mood-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 6px;
          border-radius: 10px;
          border: 1.5px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          cursor: pointer;
          transition: all 0.2s;
          color: #d1d5db;
        }
        .mood-btn:hover {
          border-color: #7c3aed;
          background: rgba(124,58,237,0.1);
        }
        .mood-btn--active {
          border-color: #7c3aed;
          background: rgba(124,58,237,0.2);
          color: #a78bfa;
        }
        .mood-emoji { font-size: 20px; }
        .mood-label { font-size: 11px; text-align: center; }
        .music-controls { display: flex; flex-direction: column; gap: 10px; }
        .preview-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid #7c3aed;
          background: rgba(124,58,237,0.15);
          color: #a78bfa;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        .preview-btn:hover { background: rgba(124,58,237,0.3); }
        .preview-btn--playing { border-color: #ec4899; color: #f9a8d4; background: rgba(236,72,153,0.15); }
        .volume-control {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #9ca3af;
        }
        .volume-slider {
          flex: 1;
          accent-color: #7c3aed;
          height: 4px;
        }
        .volume-label { font-size: 12px; min-width: 32px; }
        .spinner-sm {
          width: 14px; height: 14px;
          border: 2px solid rgba(167,139,250,0.3);
          border-top-color: #a78bfa;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
