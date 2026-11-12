"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileJson,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { HexEditorPanel } from "@/components/hex-editor-panel";
import { DiffPanel, type DiffRegion } from "@/components/diff-panel";

interface ExperimentalPanelProps {
  fileName: string;
  onExit: () => void;
}

interface ExportResult {
  filename: string;
  backup_filename: string | null;
  report_filename: string | null;
  export_dir: string;
  bytes_changed: number;
  regions: DiffRegion[];
  warnings: string[];
}

function toPatchesPayload(patches: Map<number, number>) {
  const sorted = Array.from(patches.entries()).sort((a, b) => a[0] - b[0]);
  return sorted.map(([offset, value]) => ({
    offset: `0x${offset.toString(16).toUpperCase()}`,
    hex: value.toString(16).padStart(2, "0").toUpperCase(),
  }));
}

function downloadBlob(content: BlobPart, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Deneysel mod paneli: hex editör + diff + onaylı dışa aktarma.
 *
 * Bu modda hiçbir zaman "VALID" checksum iddiası yoktur; dışa aktarma açık
 * onay (``ack_unverified``) olmadan çalışmaz.
 */
export function ExperimentalPanel({ fileName, onExit }: ExperimentalPanelProps) {
  const [patches, setPatches] = useState<Map<number, number>>(new Map());
  const [regions, setRegions] = useState<DiffRegion[]>([]);
  const [bytesChanged, setBytesChanged] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [ack, setAck] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patchPayload = useMemo(() => toPatchesPayload(patches), [patches]);

  const runPreview = useCallback(async (payload: ReturnType<typeof toPatchesPayload>) => {
    if (payload.length === 0) {
      setRegions([]);
      setBytesChanged(0);
      setWarnings([]);
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const res = await fetch("/api/raw/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patches: payload }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setError(body?.detail || `Önizleme başarısız (HTTP ${res.status}).`);
        return;
      }
      setRegions(body.regions as DiffRegion[]);
      setBytesChanged(body.bytes_changed as number);
      setWarnings((body.warnings as string[]) || []);
    } catch (err: any) {
      setError(err?.message || "Önizleme başarısız.");
    } finally {
      setPreviewing(false);
    }
  }, []);

  // Yamalar değiştikçe kısa bir gecikmeyle diff'i yenile.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runPreview(patchPayload);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [patchPayload, runPreview]);

  const setPatch = (offset: number, value: number) => {
    setPatches((prev) => {
      const next = new Map(prev);
      next.set(offset, value);
      return next;
    });
    setResult(null);
  };

  const clearPatches = () => {
    setPatches(new Map());
    setRegions([]);
    setBytesChanged(0);
    setWarnings([]);
    setResult(null);
  };

  const handleExport = async () => {
    if (!ack || patchPayload.length === 0) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/raw/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patches: patchPayload, ack_unverified: true }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setError(body?.detail || body?.error || "Dışa aktarma reddedildi.");
        return;
      }

      const bytes = base64ToBytes(body.binary_base64 as string);
      downloadBlob(bytes.buffer as ArrayBuffer, body.filename, "application/octet-stream");

      const report = {
        ...body,
        binary_base64: undefined,
      };
      downloadBlob(
        JSON.stringify(report, null, 2),
        body.report_filename || "diff.json",
        "application/json"
      );

      setResult({
        filename: body.filename,
        backup_filename: body.backup_filename,
        report_filename: body.report_filename,
        export_dir: body.export_dir,
        bytes_changed: body.bytes_changed,
        regions: body.regions || [],
        warnings: body.warnings || [],
      });
    } catch (err: any) {
      setError(err?.message || "Dışa aktarma başarısız.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Mod başlığı */}
      <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-5 shadow-soft dark:border-violet-900/60 dark:bg-violet-950/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300">
              <TriangleAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-violet-900 dark:text-violet-200">
                Deneysel düzenleme modu · {fileName}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-violet-800/90 dark:text-violet-300/90">
                Harita tanımı olmadığı için harita bazlı tuning kapalı. Baytları
                elle düzenleyebilirsiniz;{" "}
                <strong className="font-semibold">
                  checksum güncellenmez (UNVERIFIED)
                </strong>{" "}
                ve dosya doğrudan ECU&apos;ya yazılmamalıdır.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-800 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-violet-950/60"
          >
            <Undo2 className="h-3.5 w-3.5" /> İnceleme moduna dön
          </button>
        </div>
      </div>

      <HexEditorPanel
        patches={patches}
        onSetPatch={setPatch}
        onClearPatches={clearPatches}
      />

      <DiffPanel
        regions={regions}
        bytesChanged={bytesChanged}
        warnings={warnings}
        loading={previewing}
      />

      {/* Dışa aktarma */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Doğrulanmamış dosyayı dışa aktar
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Orijinal dosyanın yedeği ve diff raporu otomatik üretilir.
            </p>
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2.5 dark:border-rose-900/60 dark:bg-rose-950/30">
          <input
            type="checkbox"
            checked={ack}
            onChange={(event) => setAck(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-rose-600"
          />
          <span className="text-[11px] leading-relaxed text-rose-800 dark:text-rose-300">
            Bu dosyanın checksum&apos;ının doğrulanmadığını/güncellenmediğini,
            doğrudan ECU&apos;ya yazılmaması gerektiğini ve yalnızca dosya
            düzeyinde düzenleme yaptığımı anladım ve onaylıyorum.
          </span>
        </label>

        {error && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={!ack || exporting || patchPayload.length === 0}
            className="flex items-center gap-2 rounded-xl bg-[#162a45] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#0f1f33] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? "Hazırlanıyor..." : "Dışa aktar (.bin + diff.json)"}
          </button>
          <span className="text-[10px] text-slate-400">
            {patchPayload.length === 0
              ? "Önce en az bir bayt değiştirin."
              : !ack
              ? "Onay kutusunu işaretleyin."
              : `${bytesChanged} bayt değişecek.`}
          </span>
        </div>

        {result && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <strong className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                Dışa aktarıldı · checksum UNVERIFIED
              </strong>
            </div>
            <ul className="mt-2 space-y-1 font-mono text-[10px] text-emerald-900/80 dark:text-emerald-200/80">
              <li>{result.filename} · {result.bytes_changed} bayt değişti</li>
              {result.backup_filename && <li>yedek: {result.backup_filename}</li>}
              {result.report_filename && <li>rapor: {result.report_filename}</li>}
              <li className="break-all">klasör: {result.export_dir}</li>
            </ul>
            <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
              <FileJson className="mt-0.5 h-3 w-3 shrink-0" />
              Diff raporu ayrıca indirildi. Bu dosyayı ECU&apos;ya yazmadan önce
              doğru checksum algoritmasıyla imzalamanız gerekir.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
