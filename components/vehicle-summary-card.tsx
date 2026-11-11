"use client";

import { Check, Cpu, CheckCircle } from "lucide-react";
import type { VehicleData } from "@/lib/types";

interface VehicleSummaryCardProps {
  vehicle: VehicleData | null;
}

export function VehicleSummaryCard({ vehicle }: VehicleSummaryCardProps) {
  const data = vehicle || {
    make: "Volkswagen",
    model: "Golf IV",
    engine: "1.9 TDI",
    baseHp: 101,
    ecu: "Bosch EDC15P+",
    status: "Orijinal Fabrika Yazılımı Güvenli Şekilde Yüklendi",
  };

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      {/* Card Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-3.5 w-3.5 stroke-[3]" />
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Araç Özeti
        </h3>
      </div>

      {/* Info List */}
      <div className="mt-3.5 space-y-3.5">
        {/* Row 1: Vehicle */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1d63ed] dark:bg-blue-950/50 dark:text-blue-400">
            {/* VW Stylized Logo */}
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m7 7 3.5 10L12 13l1.5 4L17 7" />
              <path d="M9 13.5h6" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Tespit Edilen Araç
            </p>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
              {data.make} {data.model}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ({data.engine} - {data.baseHp} BG)
            </p>
          </div>
        </div>

        {/* Row 2: ECU */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              ECU Türü
            </p>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {data.ecu}
            </p>
          </div>
        </div>

        {/* Row 3: Status */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Mevcut Durum
            </p>
            <div className="mt-0.5 inline-flex items-center rounded-md bg-[#eaf8ee] px-2 py-0.5 text-[10px] font-medium text-[#1e833a] border border-[#d2f0d9] dark:bg-emerald-950/50 dark:border-emerald-800/40 dark:text-emerald-300">
              {data.status}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

