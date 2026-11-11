"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Wrench,
  Flame,
  Gauge,
  Fuel,
  ShieldCheck,
  ShieldAlert,
  TriangleAlert,
  Info,
  RotateCw,
  CheckCircle2,
  Sliders,
} from "lucide-react";
import {
  HARDWARE_UPGRADES,
  PARAM_MIN,
  PARAM_MAX,
  RAIL_MAX,
  RAIL_MIN,
  RAIL_STEP,
  RAIL_WARNING,
  TIMING_MAX,
  TIMING_MIN,
  TIMING_SAFE_MAX,
  type GuardrailResult,
  type HardwareUpgradeKey,
  type TuningParams,
} from "@/lib/types";

interface AdvancedParametersProps {
  params: TuningParams;
  hardware: HardwareUpgradeKey[];
  onChange: (key: keyof TuningParams, value: number) => void;
  onToggleHardware: (key: HardwareUpgradeKey) => void;
}

type GuardrailState = {
  loading: boolean;
  result: GuardrailResult | null;
  error: string | null;
};

const RISK_LABEL: Record<string, { text: string; className: string }> = {
  low: {
    text: "Düşük risk",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60",
  },
  medium: {
    text: "Orta risk",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60",
  },
  high: {
    text: "Yüksek risk",
    className:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900/60",
  },
  critical: {
    text: "Reddedilir",
    className:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/60",
  },
};

export function AdvancedParameters({
  params,
  hardware,
  onChange,
  onToggleHardware,
}: AdvancedParametersProps) {
  const [state, setState] = useState<GuardrailState>({
    loading: true,
    result: null,
    error: null,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const validate = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch("/api/ecu/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turbo: params.turboPressure,
          injection: params.injection,
          throttle: params.throttleResponse,
          torque: params.torqueLimiter,
          timing_advance_deg: params.timingAdvance > 0 ? params.timingAdvance : null,
          rail_pressure_bar: params.railPressure > 0 ? params.railPressure : null,
          hardware_upgrades: hardware,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      const guardrail = data?.guardrail ?? data?.safety?.guardrail ?? null;
      if (!res.ok || !guardrail) {
        setState({
          loading: false,
          result: null,
          error: data?.detail || data?.error || "Güvenlik doğrulaması alınamadı.",
        });
        return;
      }
      setState({ loading: false, result: guardrail as GuardrailResult, error: null });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setState({
        loading: false,
        result: null,
        error:
          err?.message ||
          "Güvenlik servisine ulaşılamadı. Python çekirdeğinin çalıştığını kontrol edin.",
      });
    }
  }, [params, hardware]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(validate, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [validate]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  const result = state.result;
  const risk = result ? RISK_LABEL[result.risk_level] ?? RISK_LABEL.medium : null;
  const criticals = result?.decisions.filter((d) => d.severity === "critical") ?? [];
  const warnings = result?.decisions.filter((d) => d.severity === "warning") ?? [];
  const infos = result?.decisions.filter((d) => d.severity === "info") ?? [];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Gelişmiş Parametreler
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Tork limitörü, ateşleme avansı, ray basıncı ve donanım beyanı. Her değişiklik
              canlı güvenlik bekçisinden geçer.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {state.loading && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <RotateCw className="h-3 w-3 animate-spin" />
              Denetleniyor
            </span>
          )}
          {risk && (
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${risk.className}`}
            >
              {risk.text}
            </span>
          )}
        </div>
      </div>

      {/* Slider'lar */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Tork limitörü */}
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
              <Gauge className="h-3.5 w-3.5 text-violet-500" />
              Tork Limitörü
            </span>
            <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
              {params.torqueLimiter > 0 ? "+" : ""}
              {params.torqueLimiter}%
            </span>
          </div>
          <input
            type="range"
            min={PARAM_MIN}
            max={PARAM_MAX}
            step={1}
            value={params.torqueLimiter}
            onChange={(event) => onChange("torqueLimiter", Number(event.target.value))}
            className="mt-2.5 w-full accent-violet-600"
          />
          <div className="mt-1 flex justify-between text-[9px] text-slate-400">
            <span>%{PARAM_MIN}</span>
            <span>0 stok</span>
            <span>+%{PARAM_MAX}</span>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            0x4F080 · Maksimum izin verilen tork tavanı. Tek başına tork üretmez;
            hava/yakıt haritalarıyla birlikte anlam kazanır.
          </p>
        </div>

        {/* Ateşleme avansı */}
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              Ateşleme Avansı
            </span>
            <span
              className={`text-xs font-bold ${
                params.timingAdvance > TIMING_SAFE_MAX
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-orange-600 dark:text-orange-400"
              }`}
            >
              +{params.timingAdvance}°
            </span>
          </div>
          <input
            type="range"
            min={TIMING_MIN}
            max={TIMING_MAX}
            step={1}
            value={params.timingAdvance}
            onChange={(event) => onChange("timingAdvance", Number(event.target.value))}
            className="mt-2.5 w-full accent-orange-500"
          />
          <div className="mt-1 flex justify-between text-[9px] text-slate-400">
            <span>0°</span>
            <span className="text-emerald-500">+{TIMING_SAFE_MAX}° güvenli</span>
            <span className="text-rose-500">+{TIMING_MAX}° vuruntu</span>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            +{TIMING_SAFE_MAX}° üzeri vuruntu (detonation) riski nedeniyle backend
            tarafından reddedilir. EGT ve knock dinleme olmadan artırmayın.
          </p>
        </div>

        {/* Ray basıncı */}
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
              <Fuel className="h-3.5 w-3.5 text-sky-500" />
              Ray Basıncı
            </span>
            <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
              {params.railPressure === 0 ? "Stok" : `${params.railPressure} bar`}
            </span>
          </div>
          <input
            type="range"
            min={RAIL_MIN}
            max={RAIL_MAX}
            step={RAIL_STEP}
            value={params.railPressure}
            onChange={(event) => onChange("railPressure", Number(event.target.value))}
            className="mt-2.5 w-full accent-sky-500"
          />
          <div className="mt-1 flex justify-between text-[9px] text-slate-400">
            <span>0 (stok)</span>
            <span className={params.railPressure > RAIL_WARNING ? "text-amber-500" : ""}>
              {RAIL_WARNING} uyarı
            </span>
            <span className="text-rose-500">{RAIL_MAX}</span>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            0 = dokunma. {RAIL_WARNING} bar üzeri uyarı, {RAIL_MAX} bar üzeri reddedilir.
            VP37 pompası sürekli yüksek basınçta yorulur.
          </p>
        </div>
      </div>

      {/* Donanım beyanı */}
      <div className="mt-4 rounded-xl border border-slate-200/70 p-3.5 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-slate-500" />
          <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
            Donanım Durumu
          </h4>
          <span className="text-[10px] text-slate-400">
            (beyan edilen donanım güvenlik zarfını genişletir)
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {HARDWARE_UPGRADES.map((item) => {
            const checked = hardware.includes(item.id);
            return (
              <label
                key={item.id}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] transition-colors ${
                  checked
                    ? "border-blue-300 bg-blue-50/70 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleHardware(item.id)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-blue-600"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 font-semibold">
                    {item.label}
                    {item.critical && (
                      <span className="rounded bg-slate-200 px-1 text-[8px] font-bold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        zarf
                      </span>
                    )}
                  </span>
                  <span className="block text-[10px] leading-snug opacity-70">
                    {item.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Canlı güvenlik sonucu */}
      <div className="mt-4">
        {state.error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        {result && (
          <div
            className={`rounded-xl border p-3.5 ${
              result.allowed
                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                : "border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/25"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {result.allowed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                )}
                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
                  {result.allowed
                    ? "Güvenlik bekçisi bu ayarı onaylıyor"
                    : "Güvenlik bekçisi bu ayarı reddediyor"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
                <span>
                  ≈ <strong className="text-slate-800 dark:text-slate-200">
                    +{result.estimated_gain.hp} BG
                  </strong>
                </span>
                <span>
                  tork{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    +{result.estimated_gain.torque_pct}%
                  </strong>
                </span>
                <span>
                  EGT{" "}
                  <strong
                    className={
                      result.estimated_gain.egt_c > 850
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-800 dark:text-slate-200"
                    }
                  >
                    {Math.round(result.estimated_gain.egt_c)}°C
                  </strong>
                </span>
              </div>
            </div>

            {(criticals.length > 0 || warnings.length > 0) && (
              <ul className="mt-2.5 space-y-1.5">
                {[...criticals, ...warnings].map((decision) => (
                  <li
                    key={decision.code + decision.field}
                    className={`flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[10px] leading-snug ${
                      decision.severity === "critical"
                        ? "bg-rose-100/70 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                        : "bg-amber-100/70 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                    }`}
                  >
                    <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      <strong className="font-semibold">{decision.message}</strong>{" "}
                      <span className="opacity-80">{decision.engineering_note}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {infos.length > 0 && (
              <details className="mt-2">
                <summary className="flex cursor-pointer items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  <Info className="h-3 w-3" />
                  {infos.length} bilgi notu
                </summary>
                <ul className="mt-1.5 space-y-1">
                  {infos.map((decision) => (
                    <li
                      key={decision.code + decision.field}
                      className="rounded-lg bg-white/70 px-2 py-1.5 text-[10px] leading-snug text-slate-600 dark:bg-slate-900/50 dark:text-slate-300"
                    >
                      <strong className="font-semibold">{decision.message}</strong>{" "}
                      <span className="opacity-75">{decision.engineering_note}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <p className="mt-2 flex items-center gap-1 text-[9px] text-slate-400">
              <ShieldCheck className="h-3 w-3" />
              Sonuç canlı doğrulamadan gelir; dışa aktarımda tekrar denetlenir ve
              checksum imzalanır.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
