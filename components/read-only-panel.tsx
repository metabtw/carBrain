"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldAlert,
  Search,
  Cpu,
  FileCode2,
  Fingerprint,
  Info,
  Table as TableIcon,
  Layers,
  RefreshCw,
} from "lucide-react";
import { Ecu3DVisualizer } from "@/components/ecu-3d-visualizer";

interface ReadOnlyIdentity {
  profile_id?: string;
  display_name?: string;
  flash_size?: number;
  flash_size_human?: string;
  sha256?: string;
  identifier_text?: string;
  software_version?: string;
  confidence?: string;
}

interface MatrixResponse {
  address: string;
  rows: number;
  cols: number;
  matrix: number[][];
  raw_matrix: number[][];
  hex_preview?: string;
  x_axis?: number[];
  y_axis?: number[];
}

interface ReadOnlyPanelProps {
  identity: ReadOnlyIdentity | null;
  fileName: string;
  onMatrixChange?: (matrix: number[][]) => void;
}

const DEFAULT_ADDRESS = "0x1C0000";

export function ReadOnlyPanel({
  identity,
  fileName,
  onMatrixChange,
}: ReadOnlyPanelProps) {
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  const [rows, setRows] = useState(16);
  const [cols, setCols] = useState(16);
  const [data, setData] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "3d">("table");

  const load = useCallback(
    async (addr: string, r: number, c: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          map: "raw",
          address: addr,
          rows: String(r),
          cols: String(c),
          factor: "1",
        });
        const res = await fetch(`/api/ecu/matrix?${params.toString()}`);
        const raw = await res.text();
        let body: any = null;
        try {
          body = raw ? JSON.parse(raw) : null;
        } catch {
          body = null;
        }
        if (!res.ok || !body || body.error) {
          setError(
            body?.error ||
              body?.detail ||
              `Adres okunamadı (HTTP ${res.status}). Adresi kontrol edin.`
          );
          setData(null);
          return;
        }
        setData(body as MatrixResponse);
        onMatrixChange?.(body.matrix as number[][]);
      } catch (err: any) {
        setError(err?.message || "Adres okunamadı.");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [onMatrixChange]
  );

  useEffect(() => {
    load(DEFAULT_ADDRESS, 16, 16);
    // Yalnızca ilk açılışta varsayılan adresi okuyoruz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    load(address, rows, cols);
  };

  const sizeKb = identity?.flash_size ? Math.round(identity.flash_size / 1024) : null;

  return (
    <div className="space-y-5">
      {/* Neden salt okunur? */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-soft dark:border-amber-900/60 dark:bg-amber-950/30">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Salt okunur inceleme modu
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-amber-800/90 dark:text-amber-300/90">
              <strong className="font-semibold">{fileName}</strong> dosyası tanındı,
              ancak bu yazılım sürümüne ait doğrulanmış bir harita tanımı
              (XDF/DAMOS) yok. Adresleri tahmin etmek yanlış kalibrasyon baytlarını
              değiştirip ECU&apos;yu kilitleyebileceği için{" "}
              <strong className="font-semibold">
                hiçbir bayt yazılmaz, checksum imzalanmaz ve dosya dışa aktarılmaz
              </strong>
              . Aşağıdan dosyayı serbest adres okuyarak inceleyebilirsiniz.
            </p>
          </div>
        </div>
      </div>

      {/* Kimlik */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <Cpu className="h-3.5 w-3.5" /> ECU
          </div>
          <p className="mt-1.5 break-words text-xs font-bold text-slate-900 dark:text-slate-100">
            {identity?.display_name || "Bilinmiyor"}
          </p>
          <p className="mt-1 break-all text-[10px] text-slate-500 dark:text-slate-400">
            {identity?.profile_id || "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <FileCode2 className="h-3.5 w-3.5" /> Yazılım Sürümü
          </div>
          <p className="mt-1.5 break-all text-xs font-bold text-slate-900 dark:text-slate-100">
            {identity?.software_version || "—"}
          </p>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            Boyut: {sizeKb ? `${sizeKb} KB` : "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <Fingerprint className="h-3.5 w-3.5" /> Kimlik Alanı
          </div>
          <p className="mt-1.5 break-all text-[10px] font-medium text-slate-700 dark:text-slate-300">
            {identity?.identifier_text || "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <Info className="h-3.5 w-3.5" /> SHA-256
          </div>
          <p className="mt-1.5 break-all font-mono text-[10px] text-slate-700 dark:text-slate-300">
            {identity?.sha256 ? `${identity.sha256.slice(0, 32)}…` : "—"}
          </p>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            {identity?.confidence ? `Güven: ${identity.confidence}` : ""}
          </p>
        </div>
      </div>

      {/* Serbest adres okuyucu */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Serbest Adres Okuyucu
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              16-bit little-endian kelimeler. Yalnızca okuma yapılır; dosya
              değiştirilmez.
            </p>
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setView("table")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                view === "table"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" /> Tablo
            </button>
            <button
              type="button"
              onClick={() => setView("3d")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                view === "3d"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <Layers className="h-3.5 w-3.5" /> 3B
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Adres (hex)
            </span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x1C0000"
              className="w-36 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-blue-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Satır
            </span>
            <input
              type="number"
              min={1}
              max={64}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value) || 1)}
              className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Kolon
            </span>
            <input
              type="number"
              min={1}
              max={64}
              value={cols}
              onChange={(e) => setCols(Number(e.target.value) || 16)}
              className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-[#1d63ed] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            {loading ? "Okunuyor..." : "Oku"}
          </button>
        </form>

        {error && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}

        {data && (
          <p className="mt-3 font-mono text-[10px] text-slate-500 dark:text-slate-400">
            {data.address} · {data.rows}×{data.cols} · ilk baytlar:{" "}
            {data.hex_preview || "—"}
          </p>
        )}

        {view === "3d" && data ? (
          <div className="mt-4">
            <Ecu3DVisualizer
              matrixData={data.matrix}
              xAxis={data.x_axis}
              yAxis={data.y_axis}
              mapName={`Ham okuma ${data.address}`}
              unit="raw"
              xLabel="Kolon"
              yLabel="Satır"
              liveModOffset={0}
            />
          </div>
        ) : data ? (
          <div className="mt-4 max-h-[420px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full border-collapse text-[10px]">
              <tbody>
                {data.matrix.map((row, r) => (
                  <tr key={r} className="border-b border-slate-100 dark:border-slate-800">
                    <th className="sticky left-0 bg-slate-50 px-2 py-1 text-right font-mono font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                      {`0x${(parseInt(data.address, 16) + r * data.cols * 2)
                        .toString(16)
                        .toUpperCase()}`}
                    </th>
                    {row.map((value, c) => (
                      <td
                        key={c}
                        className="px-2 py-1 text-center font-mono text-slate-700 dark:text-slate-300"
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
