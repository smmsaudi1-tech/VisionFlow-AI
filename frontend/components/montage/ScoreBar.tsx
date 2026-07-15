"use client";

interface ScoreBarProps {
  label: string;
  value: number; // 0-10
  color: string;
  delay?: number;
}

export default function ScoreBar({ label, value, color, delay = 0 }: ScoreBarProps) {
  const pct = (value / 10) * 100;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-zinc-400 w-14 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: color,
            transitionDelay: `${delay}ms`,
            boxShadow: `0 0 6px ${color}60`,
          }}
        />
      </div>
      <span className="text-zinc-300 font-mono w-5 text-left">{value}</span>
    </div>
  );
}
