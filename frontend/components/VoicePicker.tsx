"use client";

import { useState } from "react";
import { SpeakerHigh, MicrophoneStage } from "@phosphor-icons/react";
import type { TTSVoice } from "../lib/types";

interface VoicePickerProps {
  voices: TTSVoice[];
  selectedVoiceId: string;
  onVoiceChange: (voiceId: string) => void;
}

export function VoicePicker({ voices, selectedVoiceId, onVoiceChange }: VoicePickerProps) {
  const [langFilter, setLangFilter] = useState<"all" | "ar" | "en">("all");

  const filteredVoices = voices.filter((v) => {
    if (langFilter === "all") return true;
    return v.lang.startsWith(langFilter);
  });

  return (
    <div className="voice-picker">
      <div className="voice-picker-header">
        <MicrophoneStage size={18} weight="fill" />
        <span>المعلق الصوتي الذكي</span>
      </div>

      <div className="lang-tabs">
        <button
          className={`tab-btn ${langFilter === "all" ? "tab-btn--active" : ""}`}
          onClick={() => setLangFilter("all")}
        >
          الكل
        </button>
        <button
          className={`tab-btn ${langFilter === "ar" ? "tab-btn--active" : ""}`}
          onClick={() => setLangFilter("ar")}
        >
          عربي 🇸🇦🇪🇬
        </button>
        <button
          className={`tab-btn ${langFilter === "en" ? "tab-btn--active" : ""}`}
          onClick={() => setLangFilter("en")}
        >
          إنجليزي 🇺🇸🇬🇧
        </button>
      </div>

      <div className="voice-list">
        {filteredVoices.map((voice) => (
          <button
            key={voice.id}
            className={`voice-card ${selectedVoiceId === voice.id ? "voice-card--active" : ""}`}
            onClick={() => onVoiceChange(voice.id)}
          >
            <div className="voice-info">
              <span className="voice-name">{voice.name}</span>
              <span className="voice-engine">
                {voice.engine === "kokoro" ? "⚡ Kokoro AI" : "🌐 Edge Neural"}
              </span>
            </div>
            <SpeakerHigh size={16} className="voice-icon" />
          </button>
        ))}
      </div>

      <style jsx>{`
        .voice-picker {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .voice-picker-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #a78bfa;
        }
        .lang-tabs {
          display: flex;
          gap: 4px;
          background: rgba(0, 0, 0, 0.2);
          padding: 4px;
          border-radius: 8px;
        }
        .tab-btn {
          flex: 1;
          background: none;
          border: none;
          color: #9ca3af;
          font-size: 12px;
          padding: 6px;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .tab-btn:hover {
          color: #ffffff;
        }
        .tab-btn--active {
          background: #7c3aed;
          color: #ffffff;
          font-weight: 600;
        }
        .voice-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 200px;
          overflow-y: auto;
          padding-right: 2px;
        }
        .voice-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          cursor: pointer;
          transition: all 0.2s;
          color: #d1d5db;
        }
        .voice-card:hover {
          border-color: #7c3aed;
          background: rgba(124, 58, 237, 0.05);
        }
        .voice-card--active {
          border-color: #7c3aed;
          background: rgba(124, 58, 237, 0.15);
          color: #a78bfa;
        }
        .voice-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }
        .voice-name {
          font-size: 13px;
          font-weight: 500;
        }
        .voice-engine {
          font-size: 10px;
          color: #6b7280;
        }
        .voice-icon {
          opacity: 0.6;
        }
        .voice-card--active .voice-icon {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
