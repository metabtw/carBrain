"use client";

import { useState } from "react";
import {
  Sparkles,
  FileCheck2,
  Terminal,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Search,
} from "lucide-react";

interface AiMapAnalyzerProps {
  currentAddress?: string;
  onAddressSelect?: (addr: string) => void;
}

const PRESET_ADDRESSES = [
  { label: "0x4D200 - Turbo Hedef Basıncı (16x16)", address: "0x4D200" },
  { label: "0x4C120 - Sürücü İsteği / Gaz Pedalı (16x16)", address: "0x4C120" },
  { label: "0x4E150 - Duman Limiti (16x16)", address: "0x4E150" },
  { label: "0x4F080 - Tork Limitörü (16x1)", address: "0x4F080" },
];

export function AiMapAnalyzer({
  currentAddress = "0x4D200",
  onAddressSelect,
}: AiMapAnalyzerProps) {
  const [address, setAddress] = useState(currentAddress);
  const [model, setModel] = useState("qwen2.5-coder:7b");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async (addrToTest = address) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/ai/analyze-map?address=${encodeURIComponent(addrToTest)}&model=${encodeURIComponent(model)}`
      );
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Yapay Zeka Harita Madencisi & XDF Doğrulayıcı</span>
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-600 dark:bg-purple-950 dark:text-purple-300">
                Ollama + TunerPro XDF
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Ham .bin hex dizilimlerini yerel LLM ile analiz edip Damos/XDF referans tablosu ile test edin.
            </p>
          </div>
        </div>

        {/* Address & Model Picker */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              onAddressSelect?.(e.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {PRESET_ADDRESSES.map((p) => (
              <option key={p.address} value={p.address}>
                {p.label}
              </option>
            ))}
          </select>

          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="qwen2.5-coder:7b">Qwen 2.5 Coder (7B)</option>
            <option value="llama3.1:8b">Llama 3.1 (8B)</option>
          </select>

          <button
            type="button"
            onClick={() => handleAnalyze(address)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-60 transition-all"
          >
            {loading ? (
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            <span>AI ile Test Et</span>
          </button>
        </div>
      </div>

      {/* Analysis Output Box */}
      {result ? (
        <div className="mt-4 space-y-4">
          {/* Ground-Truth XDF Verification Badge */}
          <div className="flex flex-wrap items-center justify-between rounded-xl bg-[#f8fafc] p-3.5 border border-slate-200/70 dark:bg-slate-800/60 dark:border-slate-700/60 gap-3">
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
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>XDF Referans Karşılaştırması:</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      result.ground_truth_xdf?.matched
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                    }`}
                  >
                    {result.ground_truth_xdf?.matched
                      ? "Doğrulandı (%100 Eşleşme)"
                      : "Bilinmeyen Adres"}
                  </span>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {result.ground_truth_xdf?.map_title} (Boyut:{" "}
                  {result.ground_truth_xdf?.expected_dimensions})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Model:</span>
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                {result.model_used}
              </span>
            </div>
          </div>

          {/* Hex Preview */}
          <div className="rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-slate-300">
            <div className="flex items-center justify-between text-slate-500 pb-1.5 border-b border-slate-800 mb-2">
              <span>Adres: {result.address} (İlk 32 Bayt Hex Dizilimi)</span>
              <span>16-bit LoHi</span>
            </div>
            <p className="tracking-widest text-sky-400">{result.hex_dump}</p>
          </div>

          {/* AI Response Text */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
            {result.ai_analysis}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
          <Cpu className="h-8 w-8 text-slate-400 mb-2" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Bir harita adresi seçin ve &quot;AI ile Test Et&quot; butonuna basın.
          </p>
          <p className="mt-1 text-[11px] text-slate-400 max-w-md">
            Sistem .bin dosyasından hex verisini okuyacak, bayt desenini yapay zekaya yorumlatacak ve
            doğruluğu TunerPro .xdf tanımlama dosyası ile teyit edecektir.
          </p>
        </div>
      )}
    </div>
  );
}

