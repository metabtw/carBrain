"use client";

import { ArrowRight, Diff, ShieldAlert } from "lucide-react";

export interface DiffRegion {
  offset: string;
  length: number;
  before: string;
  after: string;
}

interface DiffPanelProps {
  regions: DiffRegion[];
  bytesChanged: number;
  warnings: string[];
  loading?: boolean;
}

/** Değişen bölgeleri (offset, önce/sonra) ve uyarıları gösterir. */
export function DiffPanel({
  regions,
  bytesChanged,
  warnings,
  loading = false,
}: DiffPanelProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
            <Diff className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Diff Raporu
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {loading
                ? "Önizleme hesaplanıyor..."
                : `${regions.length} bölge · ${bytesChanged} bayt değişti`}
            </p>
          </div>
        </div>
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Checksum: UNVERIFIED
        </span>
      </div>

      {regions.length > 0 ? (
        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950">
              <tr className="text-left text-slate-500 dark:text-slate-400">
                <th className="px-2 py-1.5 font-semibold">Offset</th>
                <th className="px-2 py-1.5 font-semibold">Uzunluk</th>
                <th className="px-2 py-1.5 font-semibold">Önce</th>
                <th className="px-2 py-1.5 font-semibold"></th>
                <th className="px-2 py-1.5 font-semibold">Sonra</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => (
                <tr
                  key={region.offset}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <td className="px-2 py-1 font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {region.offset}
                  </td>
                  <td className="px-2 py-1 text-slate-500 dark:text-slate-400">
                    {region.length}
                  </td>
                  <td className="px-2 py-1 font-mono text-rose-600 dark:text-rose-400">
                    {region.before}
                  </td>
                  <td className="px-1 py-1 text-slate-300">
                    <ArrowRight className="h-3 w-3" />
                  </td>
                  <td className="px-2 py-1 font-mono text-emerald-600 dark:text-emerald-400">
                    {region.after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400 dark:border-slate-700">
          Henüz değişiklik yok. Hex editörden bir bayt değiştirin.
        </p>
      )}

      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {warnings.map((warning, index) => (
            <li
              key={index}
              className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
            >
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
