"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { HeroBanner } from "@/components/hero-banner";
import { FileDropZone } from "@/components/file-drop-zone";
import { VehicleSummaryCard } from "@/components/vehicle-summary-card";
import { ParameterCards } from "@/components/parameter-cards";
import { AdvancedParameters } from "@/components/advanced-parameters";
import { AiAssistant } from "@/components/ai-assistant";
import { BottomBar } from "@/components/bottom-bar";
import { Ecu3DVisualizer } from "@/components/ecu-3d-visualizer";
import { AiMapAnalyzer } from "@/components/ai-map-analyzer";
import {
  SAMPLE_VEHICLE,
  DEFAULT_PARAMS,
  DEFAULT_HARDWARE,
  type VehicleData,
  type TuningParams,
  type HardwareUpgradeKey,
} from "@/lib/types";

export default function DashboardPage() {
  const [vehicle, setVehicle] = useState<VehicleData | null>(SAMPLE_VEHICLE);
  const [params, setParams] = useState<TuningParams>(DEFAULT_PARAMS);
  const [hardware, setHardware] = useState<HardwareUpgradeKey[]>(DEFAULT_HARDWARE);
  const [activeMapKey, setActiveMapKey] = useState<string>("boost");
  const [mapData, setMapData] = useState<any>(null);
  const [loadingMap, setLoadingMap] = useState<boolean>(false);

  // Fetch matrix from backend Python parser
  useEffect(() => {
    async function loadMap() {
      setLoadingMap(true);
      try {
        const res = await fetch(`/api/ecu/matrix?map=${activeMapKey}`);
        if (res.ok) {
          const json = await res.json();
          setMapData(json);
        }
      } catch (e) {
        console.error("Map fetch failed", e);
      } finally {
        setLoadingMap(false);
      }
    }
    loadMap();
  }, [activeMapKey]);

  // Hazır profil sayfasından gelen değerleri uygula
  // (/?turbo=12&injection=5&throttle=12&torque=6)
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const read = (key: string) => {
      const raw = query.get(key);
      if (raw === null || raw === "") return undefined;
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    };
    const preset = {
      turboPressure: read("turbo"),
      injection: read("injection"),
      throttleResponse: read("throttle"),
      torqueLimiter: read("torque"),
      timingAdvance: read("timing"),
      railPressure: read("rail"),
    };
    setParams((prev) => {
      const next = { ...prev };
      (Object.keys(preset) as (keyof TuningParams)[]).forEach((key) => {
        const value = preset[key];
        if (value !== undefined) next[key] = value;
      });
      return next;
    });
  }, []);

  const handleParamChange = (key: keyof TuningParams, value: number) => {
    setParams((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleApplyParams = (newParams: Partial<TuningParams>) => {
    // Asistan yalnızca birkaç parametre önerir; diğerlerini sıfırlamak yerine
    // mevcut değerlerin üzerine birleştiriyoruz.
    setParams((prev) => ({ ...prev, ...newParams }));
  };

  const handleToggleHardware = (key: HardwareUpgradeKey) => {
    setHardware((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleFileLoad = (file: File, newVehicle: VehicleData) => {
    setVehicle(newVehicle);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] space-y-6">
        {/* Top Hero Banner */}
        <HeroBanner />

        {/* Nasıl çalışır? */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              1. Adım · Doğrula
            </span>
            <h3 className="mt-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
              .bin dosyanızı güvenle yükleyin
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Python ayrıştırıcı dosya boyutunu ve ECU kimlik alanını kontrol eder.
              Eşleşmeyen bir dosyada hiçbir adres tahmin edilmez.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              2. Adım · Ayarla
            </span>
            <h3 className="mt-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
              Slider&apos;ları güvenlik zarfında oynatın
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Turbo, yakıt ve gaz tepkisi değerleri NumPy ile gerçek 16x16 harita
              hücrelerine uygulanır. Güvenlik bekçisi EGT, tork ve avans sınırlarını denetler.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              3. Adım · İmzala
            </span>
            <h3 className="mt-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
              Checksum&apos;ı doğrulanmış dosyayı indirin
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Dışa aktarımda checksum yeniden hesaplanır, dosya tekrar okunup doğrulanır.
              İmza geçmezse indirme engellenir; böylece ECU&apos;nun brick olması önlenir.
            </p>
          </div>
        </div>

        {/* Main Content: Left Column + Right AI Column */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch">
          {/* Left Section (Drop zone + Vehicle Summary + Parameter Cards) */}
          <div className="flex flex-col gap-5 lg:col-span-8">
            {/* Top Sub-row: Drop Zone & Vehicle Summary */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
              <div className="md:col-span-7">
                <FileDropZone
                  onFileLoad={handleFileLoad}
                  currentVehicle={vehicle}
                />
              </div>
              <div className="md:col-span-5">
                <VehicleSummaryCard vehicle={vehicle} />
              </div>
            </div>

            {/* Bottom Sub-row: 3 Interactive Tuning Cards */}
            <ParameterCards params={params} onChange={handleParamChange} />

            {/* Tüm parametreler: tork limitörü, avans, ray basıncı, donanım */}
            <AdvancedParameters
              params={params}
              hardware={hardware}
              onChange={handleParamChange}
              onToggleHardware={handleToggleHardware}
            />
          </div>

          {/* Right Section: AI Companion ("Oto-Asistan") */}
          <div className="lg:col-span-4 lg:sticky lg:top-4 lg:self-start">
            <AiAssistant
              currentParams={params}
              onApplyParams={handleApplyParams}
            />
          </div>
        </div>

        {/* 3D Visualizer Section */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Gerçek Zamanlı 3B ECU Yüzey Grafiği (Three.js)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Python çekirdek ayrıştırıcısı tarafından 0x4D200 adresinden okunan 16x16 matris ve eksen verileri.
              </p>
            </div>

            {/* Harita seçici sekmeler */}
            <div className="flex max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setActiveMapKey("boost")}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeMapKey === "boost"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                🚀 Turbo Basıncı (0x4D200)
              </button>
              <button
                type="button"
                onClick={() => setActiveMapKey("driver_wish")}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeMapKey === "driver_wish"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                ⛽ Sürücü İsteği (0x4C120)
              </button>
              <button
                type="button"
                onClick={() => setActiveMapKey("smoke_limiter")}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeMapKey === "smoke_limiter"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                💨 Duman Limiti (0x4E150)
              </button>
            </div>
          </div>

          <Ecu3DVisualizer
            matrixData={mapData?.matrix}
            xAxis={mapData?.x_axis}
            yAxis={mapData?.y_axis}
            mapName={mapData?.name || "Ladedruck Soll (Turbo Boost Target)"}
            unit={mapData?.unit || "mbar"}
            xLabel={mapData?.x_name || "Injected Quantity (mg/H)"}
            yLabel={mapData?.y_name || "Motor Devri (RPM)"}
            liveModOffset={
              activeMapKey === "boost"
                ? params.turboPressure
                : activeMapKey === "driver_wish"
                ? params.throttleResponse
                : params.injection
            }
          />
        </div>

        {/* Local AI Pattern Mining & XDF Verifier (Ollama Step 4) */}
        <AiMapAnalyzer
          currentAddress={
            activeMapKey === "boost"
              ? "0x4D200"
              : activeMapKey === "driver_wish"
              ? "0x4C120"
              : "0x4E150"
          }
          onAddressSelect={(addr) => {
            if (addr === "0x4D200") setActiveMapKey("boost");
            else if (addr === "0x4C120") setActiveMapKey("driver_wish");
            else if (addr === "0x4E150") setActiveMapKey("smoke_limiter");
          }}
        />

        {/* Bottom Status & Action Bar */}
        <BottomBar params={params} hardware={hardware} />
      </div>
    </DashboardLayout>
  );
}
