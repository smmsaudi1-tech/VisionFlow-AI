"use client";

import type { ScriptScene } from "../lib/types";
import { FilmSlate } from "@phosphor-icons/react";

interface SceneCardProps {
  scene: ScriptScene;
  index: number;
  isActive: boolean;
  onClick: () => void;
}

export function SceneCard({ scene, index, isActive, onClick }: SceneCardProps) {
  // Color code virality score: Red (<50), Yellow (50-79), Green (80+)
  const viralityColor =
    scene.virality_score >= 80
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : scene.virality_score >= 50
      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : "bg-rose-500/20 text-rose-400 border-rose-500/30";

  return (
    <button
      onClick={onClick}
      className={`scene-card ${isActive ? "scene-card--active" : ""}`}
    >
      <div className="scene-top">
        <span className="scene-number">المشهد {index + 1}</span>
        <span className={`virality-badge ${viralityColor}`}>
          🔥 {scene.virality_score}%
        </span>
      </div>

      <p className="scene-text">{scene.text}</p>

      <div className="scene-meta">
        <span className="scene-duration">⏱️ {scene.duration} ثانية</span>
        {scene.keywords && scene.keywords.length > 0 && (
          <span className="scene-query" title={scene.search_query}>
            🔍 {scene.keywords.slice(0, 2).join(", ")}
          </span>
        )}
      </div>

      <style jsx>{`
        .scene-card {
          width: 100%;
          text-align: right;
          padding: 12px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1.5px solid rgba(255, 255, 255, 0.04);
          cursor: pointer;
          transition: all 0.25s;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .scene-card:hover {
          border-color: rgba(124, 58, 237, 0.3);
          background: rgba(255, 255, 255, 0.04);
        }
        .scene-card--active {
          background: rgba(124, 58, 237, 0.08);
          border-color: #7c3aed;
        }
        .scene-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .scene-number {
          font-size: 12px;
          font-weight: 600;
          color: #a78bfa;
        }
        .virality-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 9999px;
          border: 1px solid transparent;
        }
        .scene-text {
          font-size: 12px;
          color: #e5e7eb;
          line-height: 1.5;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .scene-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 10px;
          color: #9ca3af;
          margin-top: 4px;
        }
        .scene-query {
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          background: rgba(0, 0, 0, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
        }
      `}</style>
    </button>
  );
}
