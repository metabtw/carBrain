"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FlaskConical, ShieldAlert, X } from "lucide-react";

interface ExperimentalConsentDialogProps {
  open: boolean;
  fileName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Deneysel moda geçiş öncesi risk onayı.
 *
 * Kısmi dump bilgisini `/api/raw/layout` üzerinden gösterir; checksum'ın
 * doğrulanmayacağını ve dosyanın doğrudan ECU'ya yazılmaması gerektiğini
 * açıkça belirtir.
 */
export function ExperimentalConsentDialog({
  open,
  fileName,
  onCancel,
  onConfirm,
}: ExperimentalConsentDialogProps) {
  const [partial, setPartial] = useState<boolean | null>(null);
  const [blankPct, setBlankPct] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/raw/layout");
        const body = await res.json().catch(() => null);
        if (cancelled || !body?.success) return;
        setPartial(Boolean(body.looks_partial));
        setBlankPct(typeof body.blank_ratio_pct === "number" ? body.blank_ratio_pct : null);
      } catch {
        // Düzen bilgisi alınamazsa genel uyarı gösterilir.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Deneysel mod onayı"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Deneysel düzenleme modu
              </h3>
              <p className="mt-0.5 break-all text-[11px] text-slate-500 dark:text-slate-400">
                {fileName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Kapat"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <ul className="space-y-2 text-[11px] leading-relaxed">
            <li className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong className="font-semibold">Checksum doğrulanmayacak ve
                güncellenmeyecek.</strong>{" "}
                Dışa aktarılan dosya her zaman <code>UNVERIFIED</code> olarak
                işaretlenir.
              </span>
            </li>
            <li className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Dosya doğrudan ECU&apos;ya yazılmamalıdır. Yazmadan önce doğru
                checksum algoritmasıyla imzalanmalı ve araç üzerinde
                doğrulanmalıdır. Bu uygulama ECU&apos;ya flash yazmaz.
              </span>
            </li>
            {partial === true && (
              <li className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Dosyanın{" "}
                  <strong className="font-semibold">
                    %{blankPct ?? "?"}
                  </strong>{" "}
                  kadarı 0xFF. Bu tam bir flash okuması değil, kalibrasyon/kısmi
                  dump olabilir. Tam görüntü yerine yazılırsa ECU çalışmayabilir.
                </span>
              </li>
            )}
            <li className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
              Harita bazlı slider&apos;lar, güvenlik zarfı ve 3B görselleştirme bu
              modda kapalıdır; yalnızca ham bayt düzenleme ve diff raporu
              kullanılabilir.
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 p-5 sm:flex-row sm:justify-end dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-700"
          >
            <FlaskConical className="h-4 w-4" />
            Riski anladım, deneysel moda geç
          </button>
        </div>
      </div>
    </div>
  );
}
