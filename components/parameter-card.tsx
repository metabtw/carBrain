"use client";

import { useState } from "react";
import {
  Gauge,
  Fuel,
  Zap,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { PARAM_MIN, PARAM_MAX, type TuningParams } from "@/lib/types";

interface ParameterCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tooltip: string;
  value: number;
  onChange: (value: number) => void;
  accent: string;
  metricLabel: string;
  metricValue: string;
  metricHint: string;
  badge: { label: string; tone: "good" | "warn" | "neutral" };
}

function getBadgeClasses(tone: "good" | "warn" | "neutral") {
  switch (tone) {
    case "good":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "warn":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  }
}

export function ParameterCard({
  title,
  subtitle,
  icon,
  tooltip,
  value,
  onChange,
  accent,
  metricLabel,
  metricValue,
  metricHint,
  badge,
}: ParameterCardProps) {
  const [hovered, setHovered] = useState(false);

  const pct = ((value - PARAM_MIN) / (PARAM_MAX - PARAM_MIN)) * 100;

  const TrendIcon =
    value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;

  return (
    <div
      className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}
          >
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="cursor-help text-slate-400"
            title={tooltip}
            aria-label={tooltip}
          >
            <Info className="h-4 w-4" />
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getBadgeClasses(
              badge.tone
            )}`}
          >
            {badge.label}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {value > 0 ? "+" : ""}
            {value}%
          </span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {metricLabel}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-1 text-xs">
          <TrendIcon
            className={`h-3 w-3 ${
              value > 0
                ? "text-emerald-500"
                : value < 0
                ? "text-rose-500"
                : "text-slate-400"
            }`}
          />
          <span
            className={
              value > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : value < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-slate-400"
            }
          >
            {metricValue}
          </span>
          <span className="text-slate-400">{metricHint}</span>
        </div>
      </div>

      <div className="mt-4">
        <input
          type="range"
          min={PARAM_MIN}
          max={PARAM_MAX}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: accent }}
        />
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>{PARAM_MIN}%</span>
          <span>0 ( fabrika )</span>
          <span>+{PARAM_MAX}%</span>
        </div>
      </div>

      <div
        className={`absolute -inset-px rounded-2xl bg-gradient-to-r opacity-0 transition-opacity duration-300 ${accent} -z-10 blur-sm group-hover:opacity-5`}
        aria-hidden
      />
    </div>
  );
}