"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  Terminal,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Wifi,
  WifiOff,
  Clock,
} from "lucide-react";

interface AiMapAnalyzerProps {
  currentAddress?: string;
  onAddressSelect?: (addr: string) => void;
}

interface OllamaStatus {
  online: boolean;
  base_url: string;
  models: string[];
  latency_ms?: number | null;
  error_code?: string | null;
  error_message?: string | null;
  guidance?: string | null;
}

interface AnalyzeResult {
  address: string;
  hex_dump: string;
  ollama_online: boolean;
  ollama_status?: OllamaStatus;
  model_requested?: string;
  model_used: string;
  model_note?: string | null;
  source: string;
  used_fallback?: boolean;
  error?: { code: string; message: string; guidance?: string | null } | null;
  ai_analysis: string;
  ground_truth_xdf?: {
    matched: boolean;
    map_title: string;
    expected_dimensions: string;
    accuracy_score: number;
  };
  detail?: string;
}

const PRESET_ADDRESSES = [
  { label: "0x4D200 - Turbo Hedef Basıncı (16x16)", address: "0x4D200" },
  { label: "0x4C120 - Sürücü İsteği / Gaz Pedalı (16x16)", address: "0x4C120" },
  { label: "0x4E150 - Duman Limiti (16x16)", address: "0x4E150" },
  { label: "0x4F080 - Tork Limitörü (16x1)", address: "0x4F080" },
];

function errorHint(code?: string | null) {
  switch (code) {
    case "OLLAMA_OFFLINE":
      return "Ollama servisi kapalı görünüyor. Ayrı bir terminalde `ollama serve` çalıştırın.";
    case "OLLAMA_TIMEOUT":
      return "Model ilk yüklemede yetişmedi. `ollama run qwen2.5-coder:7b` ile önceden yükleyin.";
    case "OLLAMA_MODEL_MISSING":
      return "Model indirilmemiş. `ollama pull qwen2.5-coder:7b` komutunu çalıştırın.";
    default:
      return null;
  }
}

export function AiMapAnalyzer({
  currentAddress = "0x4D200",
  onAddressSelect,
}: AiMapAnalyzerProps) {
  const [address, setAddress] = useState(currentAddress);
  const [model, setModel] = useState("qwen2.5-coder:7b");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/ai/analyze-map?check=1", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setStatus(data);
        // Yüklü model varsa seçili modeli otomatik uyarla.
        if (Array.isArray(data.models) && data.models.length > 0) {
          setModel((current) =>
            data.models.includes(current)
              ? current
              : data.models.includes("qwen2.5-coder:7b")
              ? "qwen2.5-coder:7b"
              : data.models[0]
          );
        }
      }
    } catch {
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleAnalyze = async (addrToTest = address) => {
    setLoading(true);
    setRequestError(null);
    try {
      const res = await fetch(
        `/api/ai/analyze-map?address=${encodeURIComponent(addrToTest)}&model=${encodeURIComponent(model)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok && !data?.ai_analysis) {
        setRequestError(data?.detail || data?.error || "Harita analizi başarısız.");
        return;
      }
      setResult(data);
      if (data?.ollama_status) setStatus(data.ollama_status);
    } catch (err: any) {
      setRequestError(
        err?.message ||
          "AI analiz isteği başarısız. Python çekirdeğinin ve Ollama'nın çalıştığını kontrol edin."
      );
    } finally {
      setLoading(false);
    }
  };

  const offline = status ? !status.online : false;
  const hint = errorHint(result?.error?.code || status?.error_code);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      {/* Başlık */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <span>Yapay Zeka Harita Madencisi ve XDF Doğrulayıcı</span>
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-600 dark:bg-purple-950 dark:text-purple-300">
                Ollama + TunerPro XDF
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Ham .bin hex dizilimlerini yerel LLM ile analiz edip Damos/XDF referans tablosu ile test edin.
            </p>
          </div>
        </div>

        {/* Durum rozeti */}
        <button
          type="button"
          onClick={loadStatus}
          title="Ollama bağlantısını yeniden kontrol et"
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            statusLoading
              ? "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              : offline
              ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          {statusLoading ? (
            <>
              <RotateCw className="h-3 w-3 animate-spin" />
              Kontrol ediliyor
            </>
          ) : offline ? (
            <>
              <WifiOff className="h-3 w-3" />
              Ollama kapalı
            </>
          ) : (
            <>
              <Wifi className="h-3 w-3" />
              Ollama çevrimiçi
            </>
          )}
        </button>
      </div>

      {/* Bağlantı sorunu açıklaması */}
      {!statusLoading && offline && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="flex items-start gap-2 font-semibold">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Ollama&apos;ya bağlanılamıyor
              {status?.error_code ? ` (${status.error_code})` : ""}.
            </span>
          </p>
          {status?.error_message && (
            <p className="mt-1 pl-6 opacity-90">{status.error_message}</p>
          )}
          {status?.guidance && <p className="mt-1 pl-6 opacity-90">{status.guidance}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
            <code className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-100">
              ollama serve
            </code>
            <code className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-100">
              ollama pull qwen2.5-coder:7b
            </code>
            <span className="opacity-80">
              Bu durumda analiz, XDF tabanlı sezgisel motorla yapılır.
            </span>
          </div>
        </div>
      )}

      {/* Adres ve model seçimi */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          list="ai-map-address-presets"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            onAddressSelect?.(e.target.value);
          }}
          placeholder="0x1C0000"
          className="w-40 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs font-medium text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
        <datalist id="ai-map-address-presets">
          {PRESET_ADDRESSES.map((preset) => (
            <option key={preset.address} value={preset.address}>
              {preset.label}
            </option>
          ))}
        </datalist>

        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {(status?.models?.length
            ? status.models
            : ["qwen2.5-coder:7b", "llama3.1:8b"]
          ).map((name) => (
            <option key={name} value={name}>
              {name}
              {status?.models?.length ? "" : " (indirilmedi olabilir)"}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => handleAnalyze(address)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-purple-700 disabled:opacity-60"
        >
          {loading ? (
            <RotateCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          <span>{loading ? "Analiz ediliyor..." : "AI ile Test Et"}</span>
        </button>

        {status?.latency_ms != null && status.online && (
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <Clock className="h-3 w-3" />
            {status.latency_ms} ms
          </span>
        )}
      </div>

      {loading && (
        <p className="mt-2 text-[11px] text-slate-400">
          Yerel model CPU&apos;da çalışıyorsa ilk yanıt 30-90 saniye sürebilir. Bu süre
          boyunca sayfayı yenilemeyin.
        </p>
      )}

      {requestError && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{requestError}</span>
        </div>
      )}

      {result ? (
        <div className="mt-4 space-y-4">
          {/* XDF doğrulama rozeti */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-[#f8fafc] p-3.5 dark:border-slate-700/60 dark:bg-slate-800/60">
            <div className="flex items-center gap-2.5">
              {result.ground_truth_xdf?.matched ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              )}
              <div>
                <p className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <span>XDF Referans Karşılaştırması:</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      result.ground_truth_xdf?.matched
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                    }`}
                  >
                    {result.ground_truth_xdf?.matched
                      ? "Doğrulandı (%100 eşleşme)"
                      : "Bilinmeyen adres"}
                  </span>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {result.ground_truth_xdf?.map_title} (Boyut:{" "}
                  {result.ground_truth_xdf?.expected_dimensions})
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">Model:</span>
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                {result.model_used}
              </span>
              {result.used_fallback && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                  Sezgisel yedek
                </span>
              )}
            </div>
          </div>

          {/* Model değişikliği / analiz hatası notu */}
          {result.model_note && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              {result.model_note}
            </p>
          )}
          {result.error && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-semibold">
                {result.error.message}{" "}
                <span className="font-mono text-[10px] opacity-70">({result.error.code})</span>
              </p>
              {result.error.guidance && <p className="mt-1 opacity-90">{result.error.guidance}</p>}
              {hint && <p className="mt-1 opacity-90">{hint}</p>}
            </div>
          )}

          {/* Hex önizleme */}
          <div className="rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-slate-300">
            <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-1.5 text-slate-500">
              <span>Adres: {result.address} (ilk 32 bayt)</span>
              <span className="flex items-center gap-1">
                <Terminal className="h-3 w-3" />
                16-bit LoHi
              </span>
            </div>
            <p className="tracking-widest text-sky-400">{result.hex_dump}</p>
          </div>

          {/* AI yanıtı */}
          <div className="whitespace-pre-line rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
            {result.ai_analysis}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
          <Cpu className="mb-2 h-8 w-8 text-slate-400" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Bir harita adresi seçin ve &quot;AI ile Test Et&quot; butonuna basın.
          </p>
          <p className="mt-1 max-w-md text-[11px] text-slate-400">
            Sistem .bin dosyasından hex verisini okuyacak, bayt desenini yapay zekaya
            yorumlatacak ve doğruluğu TunerPro .xdf tanımlama dosyası ile teyit edecektir.
            Ollama kapalıysa XDF tabanlı sezgisel analiz devreye girer.
          </p>
        </div>
      )}
    </div>
  );
}
