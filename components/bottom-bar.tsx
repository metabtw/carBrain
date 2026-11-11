"use client";

import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Lightbulb,
  Download,
  ArrowRight,
  Check,
} from "lucide-react";
import type { TuningParams } from "@/lib/types";

interface BottomBarProps {
  params: TuningParams;
}

export function BottomBar({ params }: BottomBarProps) {
  const [downloading, setDownloading] = useState(false);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setDownloading(true);
    setExported(false);
    setError(null);
    try {
      const query = new URLSearchParams({
        turbo: String(params.turboPressure),
        injection: String(params.injection),
        throttle: String(params.throttleResponse),
      });
      const res = await fetch(`/api/ecu/export?${query.toString()}`);
      if (!res.ok) {
        let message = "Dışa aktarma reddedildi.";
        try {
          const body = await res.json();
          message =
            body?.safety?.message ||
            body?.detail ||
            body?.error ||
            message;
          if (body?.safety?.engineering_explanation) {
            message += ` ${body.safety.engineering_explanation}`;
          }
        } catch {
          // keep generic message
        }
        setError(message);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || "autotune_edc15_tuned.bin";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setExported(true);
      setTimeout(() => setExported(false), 4000);
    } catch (err: any) {
      setError(
        err?.message ||
          "Python çekirdeğine ulaşılamadı. `backend/main.py` servisinin çalıştığını kontrol edin."
      );
    } finally {
      setDownloading(false);
    }
  };

  const checksumStatus = error ? "İmza doğrulanamadı" : "Checksum: Korumalı ve Hazır";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
      {/* Sol: Checksum durumu */}
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            error
              ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
              : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
          }`}
        >
          {error ? <ShieldAlert className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
            {checksumStatus}
          </h4>
          <p className="max-w-md text-[11px] text-slate-500 dark:text-slate-400">
            {error ||
              "Dosyanız güvenli. Dışa aktarımda Bosch EDC15 checksum motoru imzayı yeniden hesaplar ve doğrular."}
          </p>
        </div>
      </div>

      {/* Orta: İpucu */}
      <div className="hidden items-center gap-2 border-slate-200 px-6 dark:border-slate-800 lg:flex lg:border-l lg:border-r">
        <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
        <p className="max-w-xs text-xs text-slate-600 dark:text-slate-400">
          <strong className="font-semibold text-slate-700 dark:text-slate-300">İpucu:</strong>{" "}
          Küçük adımlarla ilerleyin. Her değişikliğin etkisini sağdaki özetlerde görebilirsiniz.
        </p>
      </div>

      {/* Sağ: Dışa aktarma */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={handleExport}
          disabled={downloading}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-bold text-white shadow-sm transition-all sm:w-auto ${
            exported
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-[#162a45] hover:bg-[#0f1f33] dark:bg-blue-600 dark:hover:bg-blue-700"
          }`}
        >
          {exported ? (
            <>
              <Check className="h-4 w-4" />
              <span>Dosya İndirildi!</span>
            </>
          ) : downloading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>İmzalanıyor ve hazırlanıyor...</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              <span>Düzenlenmiş Dosyayı Dışa Aktar (.bin)</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
