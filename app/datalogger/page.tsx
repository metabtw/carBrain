"use client";

import { useRef, useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import {
  Activity,
  UploadCloud,
  Gauge,
  TriangleAlert,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  RotateCw,
} from "lucide-react";

interface LogResult {
  file_name?: string;
  total_rows_analyzed?: number;
  max_recorded_boost_mbar?: number;
  boost_spikes_detected?: number;
  ai_engineer_feedback?: string[];
  diagnostics?: {
    boost_overshoot_count?: number;
    turbo_lag_points?: number;
    boost_following_rate_pct?: number;
    min_recorded_boost_mbar?: number;
    rail_pressure_min_bar?: number;
    columns_detected?: Record<string, string | null>;
  };
  sample_telemetry?: Array<{
    rpm: number;
    specified_boost: number | null;
    actual_boost: number;
    maf?: number | null;
  }>;
  error?: string;
  detail?: string;
}

export default function DataloggerPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LogResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/datalogger/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || data?.error || "Log dosyası analiz edilemedi.");
        return;
      }
      setResult(data);
    } catch (err: any) {
      setError(err?.message || "Log analizi sırasında bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-slate-900 dark:text-white">
            <Activity className="h-7 w-7 text-rose-600 dark:text-rose-400" />
            Canlı Test ve Datalogger (OBD2)
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Araca yükleme sonrası OBD2 / VCDS / Torque uygulamasından aldığınız CSV log
            dosyasını yükleyin. Python analiz motoru istenen ve gerçek turbo basıncını
            karşılaştırır; boost spike, turbo gecikmesi ve ray basıncı düşüşlerini raporlar.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleFile(event.dataTransfer.files?.[0]);
              }}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-10 text-center transition-colors hover:border-rose-300 hover:bg-rose-50/40 dark:border-slate-700 dark:hover:border-rose-900 dark:hover:bg-rose-950/20"
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.txt,.log"
                className="hidden"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                {loading ? (
                  <RotateCw className="h-6 w-6 animate-spin" />
                ) : (
                  <UploadCloud className="h-6 w-6" />
                )}
              </div>
              <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
                {loading ? "Log analiz ediliyor..." : "CSV log dosyasını sürükleyin veya seçin"}
              </p>
              <p className="mt-1 max-w-md text-[11px] text-slate-500 dark:text-slate-400">
                Beklenen sütunlar: RPM, Specified Boost veya Target Boost, Actual Boost,
                isteğe bağlı Rail Pressure ve MAF. Virgül, noktalı virgül ve sekme
                ayırıcıları otomatik algılanır.
              </p>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Metric
                    label="Analiz edilen satır"
                    value={String(result.total_rows_analyzed ?? 0)}
                    tone="blue"
                  />
                  <Metric
                    label="Maks. basınç"
                    value={`${result.max_recorded_boost_mbar ?? 0} mbar`}
                    tone="emerald"
                  />
                  <Metric
                    label="Boost spike"
                    value={String(result.boost_spikes_detected ?? 0)}
                    tone={
                      (result.boost_spikes_detected ?? 0) > 3 ? "rose" : "emerald"
                    }
                  />
                  <Metric
                    label="Basınç takip oranı"
                    value={`%${result.diagnostics?.boost_following_rate_pct ?? 0}`}
                    tone="amber"
                  />
                </div>

                <div className="space-y-2">
                  {(result.ai_engineer_feedback || []).map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed ${
                        item.startsWith("✅")
                          ? "border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                      }`}
                    >
                      {item.startsWith("✅") ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : (
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <span>{item.replace(/^[✅⚠️]\s*/, "")}</span>
                    </div>
                  ))}
                </div>

                {result.sample_telemetry && result.sample_telemetry.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      İlk 15 telemetri noktası
                    </div>
                    <div className="max-h-56 overflow-auto">
                      <table className="w-full text-right text-[11px]">
                        <thead className="bg-white text-slate-400 dark:bg-slate-900">
                          <tr>
                            <th className="p-2 text-left font-medium">RPM</th>
                            <th className="p-2 font-medium">İstenen (mbar)</th>
                            <th className="p-2 font-medium">Gerçek (mbar)</th>
                            <th className="p-2 font-medium">MAF</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {result.sample_telemetry.map((point, index) => (
                            <tr key={index} className="text-slate-600 dark:text-slate-300">
                              <td className="p-2 text-left font-semibold text-slate-800 dark:text-slate-200">
                                {point.rpm}
                              </td>
                              <td className="p-2">{point.specified_boost ?? "-"}</td>
                              <td className="p-2">{point.actual_boost}</td>
                              <td className="p-2">{point.maf ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <Info className="h-4 w-4 text-blue-500" />
                Neler kontrol edilir?
              </h3>
              <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                <li>• Boost spike: gerçek basınç istenenin 180 mbar üzerine çıkıyor mu?</li>
                <li>• Turbo lag: 1.800 devir üzerinde basınç 250 mbar altında kalıyor mu?</li>
                <li>• Ray basıncı: yük altında 900 bar altına düşüyor mu?</li>
                <li>• Aşırı basınç: 2.700 mbar üzeri overboost var mı?</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-5 text-[11px] leading-relaxed text-amber-900 shadow-soft dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Gauge className="h-4 w-4" />
                Mühendislik notu
              </h3>
              <p className="mt-2">
                Log analizi bir teşhis yardımcısıdır; dyno ölçümü, geniş bant lambda ve
                EGT probunun yerini tutmaz. Önerilen harita değişikliklerini uygulamadan
                önce yakıt kalitesini, emme kaçağını ve VNT geometrisini kontrol edin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "emerald" | "rose" | "amber";
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    emerald:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  };
  return (
    <div className={`rounded-xl p-3 ${tones[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-sm font-extrabold">{value}</p>
    </div>
  );
}
