"use client";

import { useState } from "react";
import {
  Rocket,
  Fuel,
  Zap,
  Info,
  Gauge,
  Activity,
  BarChart2,
  Timer,
  Car,
} from "lucide-react";
import type { TuningParams } from "@/lib/types";
import { PARAM_MIN, PARAM_MAX } from "@/lib/types";

interface ParameterCardsProps {
  params: TuningParams;
  onChange: (key: keyof TuningParams, value: number) => void;
}

export function ParameterCards({ params, onChange }: ParameterCardsProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const turboHp = params.turboPressure;
  const turboHpLabel = turboHp > 0 ? `+${turboHp} BG` : turboHp === 0 ? "0 BG" : `${turboHp} BG`;

  const fuelPillText =
    params.injection < -2
      ? `%${Math.abs(params.injection * 1.5).toFixed(0)} Daha Ekonomik`
      : params.injection > 3
      ? `%${(params.injection * 1.2).toFixed(0)} Güç Odaklı`
      : "%8 Daha Ekonomik";

  const throttlePillText =
    params.throttleResponse > 3
      ? "Daha Hızlı Tepki"
      : params.throttleResponse < -3
      ? "Yumuşak Tepki"
      : "Dengeli Tepki";

  const throttleHpBonus = Math.max(0, Math.round(params.throttleResponse / 3));

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {/* KART 1: İvmelenme & Güç (Turbo Basıncı) */}
      <div className="relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft transition-all duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
        <div>
          {/* Başlık ve İkon */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#1d63ed] dark:bg-blue-950/50 dark:text-blue-400">
                <Rocket className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  İvmelenme & Güç
                </h3>
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  (Turbo Basıncı - Ladedruck)
                </p>
              </div>
            </div>
            <div className="relative">
              <button
                type="button"
                onMouseEnter={() => setActiveTooltip("turbo")}
                onMouseLeave={() => setActiveTooltip(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label="Turbo bilgisi"
              >
                <Info className="h-4 w-4" />
              </button>
              {activeTooltip === "turbo" && (
                <div className="absolute right-0 top-6 z-20 w-56 rounded-xl bg-slate-900 p-3 text-[11px] text-white shadow-xl dark:bg-slate-800 border border-slate-700">
                  <strong className="block text-sky-400 mb-1">0x4D200 Turbo Haritası</strong>
                  Emme manifolduna basılan mutlak hava basıncını (mbar) artırır. Silindire daha fazla oksijen girerek torku yükseltir. Güvenli sınır: Maksimum +%15.
                </div>
              )}
            </div>
          </div>

          <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
            Gaza bastığınızda turbonun manifolda bastığı hava basıncını optimize eder.
          </p>

          {/* Slider */}
          <div className="mt-4">
            <div className="relative">
              <input
                type="range"
                min={PARAM_MIN}
                max={PARAM_MAX}
                value={params.turboPressure}
                onChange={(e) => onChange("turboPressure", Number(e.target.value))}
                className="w-full accent-[#1d63ed]"
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-600 dark:text-slate-400">
              <span>-%10 Eko</span>
              <span>+%15 Spor</span>
            </div>
          </div>

          {/* Vurgu Rozeti */}
          <div className="mt-3.5 flex items-center justify-center rounded-xl bg-[#ebf3fe] py-2 px-3 text-xs font-bold text-[#1d63ed] dark:bg-blue-950/40 dark:text-blue-300">
            <Zap className="mr-1.5 h-3.5 w-3.5 fill-current" />
            <span>{turboHpLabel} (Tahmini Artış)</span>
          </div>
        </div>

        {/* Metrik Listesi */}
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800 text-[11px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Fuel className="h-3.5 w-3.5 text-slate-400" />
              <span>Yakıt Tüketimi</span>
            </div>
            <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Hafifçe Daha İyi</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Activity className="h-3.5 w-3.5 text-slate-400" />
              <span>Motor Stresi</span>
            </div>
            <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <span className={`h-1.5 w-1.5 rounded-full ${params.turboPressure > 10 ? "bg-amber-500" : "bg-emerald-500"}`} />
              <span>{params.turboPressure > 10 ? "Güvenli Sınır" : "Normal"}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <BarChart2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Performans Artışı</span>
            </div>
            <div className="font-bold text-slate-800 dark:text-slate-200">
              {turboHpLabel}
            </div>
          </div>
        </div>
      </div>

      {/* KART 2: Yakıt Tasarrufu & Performans (Enjeksiyon) */}
      <div className="relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft transition-all duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
        <div>
          {/* Başlık ve İkon */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <Fuel className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Yakıt Tasarrufu &
                </h3>
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Performans (Enjeksiyon)
                </p>
              </div>
            </div>
            <div className="relative">
              <button
                type="button"
                onMouseEnter={() => setActiveTooltip("injection")}
                onMouseLeave={() => setActiveTooltip(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label="Enjeksiyon bilgisi"
              >
                <Info className="h-4 w-4" />
              </button>
              {activeTooltip === "injection" && (
                <div className="absolute right-0 top-6 z-20 w-56 rounded-xl bg-slate-900 p-3 text-[11px] text-white shadow-xl dark:bg-slate-800 border border-slate-700">
                  <strong className="block text-emerald-400 mb-1">0x4E150 Duman & IQ Haritası</strong>
                  Silindire püskürtülen dizel miktarını (mg/stroke) düzenler. Düşük değerler yakıt tasarrufu sağlar; yüksek değerler ivmelenmeyi besler.
                </div>
              )}
            </div>
          </div>

          <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
            Yakıt ekonomisi ile gaz tepkisi arasındaki ideal dengeyi sağlar.
          </p>

          {/* Slider */}
          <div className="mt-4">
            <div className="relative">
              <input
                type="range"
                min={PARAM_MIN}
                max={PARAM_MAX}
                value={params.injection}
                onChange={(e) => onChange("injection", Number(e.target.value))}
                className="w-full accent-[#1d63ed]"
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-600 dark:text-slate-400">
              <span>-%10 Tasarruf</span>
              <span>+%15 Performans</span>
            </div>
          </div>

          {/* Vurgu Rozeti */}
          <div className="mt-3.5 flex items-center justify-center rounded-xl bg-[#eaf8ee] py-2 px-3 text-xs font-bold text-[#1e833a] dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="mr-1.5 text-sm">🌿</span>
            <span>{fuelPillText}</span>
          </div>
        </div>

        {/* Metrik Listesi */}
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800 text-[11px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Fuel className="h-3.5 w-3.5 text-slate-400" />
              <span>Yakıt Tüketimi</span>
            </div>
            <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <span className={`h-1.5 w-1.5 rounded-full ${params.injection > 5 ? "bg-amber-500" : "bg-emerald-500"}`} />
              <span>{params.injection > 5 ? "Normal / Artabilir" : "Daha Az"}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Activity className="h-3.5 w-3.5 text-slate-400" />
              <span>Motor Stresi</span>
            </div>
            <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span>Normal</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Timer className="h-3.5 w-3.5 text-slate-400" />
              <span>Tepki Süresi</span>
            </div>
            <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span>Daha Hızlı</span>
            </div>
          </div>
        </div>
      </div>

      {/* KART 3: Motor Tepkisi (Gaz Pedalı Hassasiyeti) */}
      <div className="relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft transition-all duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
        <div>
          {/* Başlık ve İkon */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-950/50 dark:text-orange-400">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Motor Tepkisi
                </h3>
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  (Gaz Pedalı Hassasiyeti)
                </p>
              </div>
            </div>
            <div className="relative">
              <button
                type="button"
                onMouseEnter={() => setActiveTooltip("throttle")}
                onMouseLeave={() => setActiveTooltip(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label="Gaz pedalı bilgisi"
              >
                <Info className="h-4 w-4" />
              </button>
              {activeTooltip === "throttle" && (
                <div className="absolute right-0 top-6 z-20 w-56 rounded-xl bg-slate-900 p-3 text-[11px] text-white shadow-xl dark:bg-slate-800 border border-slate-700">
                  <strong className="block text-orange-400 mb-1">0x4C120 Sürücü İsteği (Driver Wish)</strong>
                  Elektronik gaz pedalı potansiyometresi gecikmesini ortadan kaldırır. Motor torkunu anında tekerleklere iletir.
                </div>
              )}
            </div>
          </div>

          <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
            Elektronik pedal gecikmesini ortadan kaldırarak anında sportif tepki verir.
          </p>

          {/* Slider */}
          <div className="mt-4">
            <div className="relative">
              <input
                type="range"
                min={PARAM_MIN}
                max={PARAM_MAX}
                value={params.throttleResponse}
                onChange={(e) => onChange("throttleResponse", Number(e.target.value))}
                className="w-full accent-[#1d63ed]"
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-600 dark:text-slate-400">
              <span>-%10 Yumuşak</span>
              <span>+%15 Keskin</span>
            </div>
          </div>

          {/* Vurgu Rozeti */}
          <div className="mt-3.5 flex items-center justify-center rounded-xl bg-[#fff2ea] py-2 px-3 text-xs font-bold text-[#c2410c] dark:bg-orange-950/40 dark:text-orange-300">
            <Gauge className="mr-1.5 h-3.5 w-3.5" />
            <span>{throttlePillText}</span>
          </div>
        </div>

        {/* Metrik Listesi */}
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800 text-[11px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Car className="h-3.5 w-3.5 text-slate-400" />
              <span>Sürüş Hissi</span>
            </div>
            <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Daha Dinamik</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Fuel className="h-3.5 w-3.5 text-slate-400" />
              <span>Yakıt Tüketimi</span>
            </div>
            <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span>Biraz Artabilir</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <BarChart2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Hissedilen Güç</span>
            </div>
            <div className="font-bold text-slate-800 dark:text-slate-200">
              + {throttleHpBonus} BG
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
