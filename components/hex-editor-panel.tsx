"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  CornerDownLeft,
  AlertTriangle,
  Layers,
} from "lucide-react";

interface LayoutBlock {
  offset: string;
  filled_pct: number;
}

interface HexRow {
  offset: string;
  hex: string;
  ascii: string;
}

interface HexEditorPanelProps {
  patches: Map<number, number>;
  onSetPatch: (offset: number, value: number) => void;
  onClearPatches: () => void;
  onGoTo?: (offset: number) => void;
}

const ROWS = 16;
const BYTES_PER_ROW = 16;
const PAGE = ROWS * BYTES_PER_ROW;

function parseAddress(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = /^0x/i.test(trimmed)
    ? Number.parseInt(trimmed.slice(2), 16)
    : Number.parseInt(trimmed, 16);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toHexAddress(value: number): string {
  return `0x${value.toString(16).toUpperCase()}`;
}

/**
 * Hex editör: 16 bayt/satır hex + ASCII görünüm.
 *
 * Düzenlemeler yalnızca bellekte tutulur (``patches``), dosyaya yazılmaz.
 * Dolu (kalibrasyon) bloklar vurgulanır; boş 0xFF blokları soluk gösterilir.
 */
export function HexEditorPanel({
  patches,
  onSetPatch,
  onClearPatches,
  onGoTo,
}: HexEditorPanelProps) {
  const [addressInput, setAddressInput] = useState("0x0");
  const [baseOffset, setBaseOffset] = useState(0);
  const [rows, setRows] = useState<HexRow[]>([]);
  const [fileSize, setFileSize] = useState(0);
  const [layout, setLayout] = useState<LayoutBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLayout = useCallback(async () => {
    try {
      const res = await fetch("/api/raw/layout");
      const body = await res.json().catch(() => null);
      if (res.ok && body?.blocks) setLayout(body.blocks as LayoutBlock[]);
    } catch {
      // Düzen bilgisi opsiyonel; hex görünümü onsuz da çalışır.
    }
  }, []);

  const loadHex = useCallback(async (offset: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/raw/hex?offset=${toHexAddress(offset)}&length=${PAGE}`
      );
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setError(body?.detail || `Adres okunamadı (HTTP ${res.status}).`);
        setRows([]);
        return;
      }
      setBaseOffset(offset);
      setAddressInput(toHexAddress(offset));
      setRows(body.rows as HexRow[]);
      setFileSize(body.file_size as number);
    } catch (err: any) {
      setError(err?.message || "Adres okunamadı.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLayout();
    loadHex(0);
  }, [loadLayout, loadHex]);

  const populatedBlocks = useMemo(
    () => new Set(layout.filter((block) => block.filled_pct > 1).map((b) => b.offset)),
    [layout]
  );

  const blockFilled = useCallback(
    (offset: number): boolean | null => {
      if (layout.length === 0) return null;
      const blockOffset = `0x${(Math.floor(offset / 0x10000) * 0x10000)
        .toString(16)
        .toUpperCase()}`;
      return populatedBlocks.has(blockOffset);
    },
    [layout.length, populatedBlocks]
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseAddress(addressInput);
    if (parsed === null) {
      setError("Geçersiz adres. Örnek: 0x1C0000");
      return;
    }
    loadHex(parsed);
    onGoTo?.(parsed);
  };

  const step = (direction: -1 | 1) => {
    const next = Math.max(0, baseOffset + direction * PAGE);
    loadHex(next);
  };

  const renderByte = (row: HexRow, index: number, byte: number) => {
    const rowOffset = parseAddress(row.offset) ?? 0;
    const offset = rowOffset + index;
    const patched = patches.has(offset);
    const value = patched ? patches.get(offset)! : byte;
    const filled = blockFilled(offset);
    const inBlankBlock = filled === false;

    return (
      <input
        key={`${offset}-${value}`}
        aria-label={`Bayt ${toHexAddress(offset)}`}
        defaultValue={value.toString(16).padStart(2, "0").toUpperCase()}
        maxLength={2}
        onChange={(event) => {
          const raw = event.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 2);
          if (raw.length !== 2) return;
          const parsed = Number.parseInt(raw, 16);
          if (!Number.isFinite(parsed)) return;
          onSetPatch(offset, parsed);
        }}
        className={`w-[1.55rem] rounded border px-0.5 py-0.5 text-center font-mono text-[10px] uppercase outline-none transition-colors ${
          patched
            ? "border-amber-400 bg-amber-100 font-bold text-amber-900 dark:border-amber-500 dark:bg-amber-900/60 dark:text-amber-200"
            : inBlankBlock
            ? "border-transparent bg-slate-50 text-slate-400 dark:bg-slate-950 dark:text-slate-600"
            : "border-transparent bg-emerald-50/60 text-slate-700 hover:border-slate-300 dark:bg-emerald-950/20 dark:text-slate-300"
        }`}
      />
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Hex Editör
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Düzenlemeler yalnızca bellekte birikir. Yeşil = dolu (kalibrasyon)
            blok, soluk = 0xFF boş blok, sarı = değiştirilmiş bayt.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            {patches.size} bayt değiştirildi
          </span>
          <button
            type="button"
            onClick={onClearPatches}
            disabled={patches.size === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Eraser className="h-3.5 w-3.5" /> Yamaları temizle
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Adres (hex)
          </span>
          <input
            value={addressInput}
            onChange={(event) => setAddressInput(event.target.value)}
            placeholder="0x1C0000"
            className="w-36 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-800 outline-none focus:border-blue-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-[#1d63ed] px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          <CornerDownLeft className="h-3.5 w-3.5" /> Git
        </button>
        <button
          type="button"
          onClick={() => step(-1)}
          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          aria-label="Önceki sayfa"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          aria-label="Sonraki sayfa"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="pb-2 font-mono text-[10px] text-slate-400">
          dosya: {fileSize ? `${Math.round(fileSize / 1024)} KB` : "—"}
        </span>
      </form>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {layout.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
          <Layers className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          {layout.map((block) => (
            <button
              key={block.offset}
              type="button"
              onClick={() => {
                const parsed = parseAddress(block.offset);
                if (parsed !== null) loadHex(parsed);
              }}
              title={`${block.offset} · dolu %${block.filled_pct}`}
              className={`h-4 w-6 shrink-0 rounded-sm border text-[8px] font-bold ${
                block.filled_pct > 1
                  ? "border-emerald-400 bg-emerald-200 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-800 dark:text-emerald-100"
                  : "border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800"
              }`}
            >
              {block.filled_pct > 1 ? "●" : "·"}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full border-collapse">
          <tbody>
            {rows.map((row) => {
              const rowOffset = parseAddress(row.offset) ?? 0;
              const bytes = row.hex.split(" ").filter(Boolean).map((h) => Number.parseInt(h, 16));
              return (
                <tr
                  key={row.offset}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <td className="sticky left-0 bg-slate-50 px-2 py-1 font-mono text-[10px] font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    {row.offset}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1">
                    <div className="flex gap-0.5">
                      {bytes.map((byte, index) => renderByte(row, index, byte))}
                    </div>
                  </td>
                  <td className="px-2 py-1 font-mono text-[10px] tracking-tight text-slate-500 dark:text-slate-400">
                    {row.ascii}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-[9px] text-slate-300 dark:text-slate-600">
                    {rowOffset === baseOffset ? "←" : ""}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !loading && (
              <tr>
                <td className="px-3 py-4 text-center text-[11px] text-slate-400">
                  Görüntülenecek veri yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
