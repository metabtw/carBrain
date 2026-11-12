"use client";

import { useState, DragEvent, useRef } from "react";
import { Folder, Car, CheckCircle2, ShieldCheck, FileText } from "lucide-react";
import { createMockVehicleFile } from "@/lib/utils";
import type { VehicleData } from "@/lib/types";
import { SAMPLE_VEHICLE } from "@/lib/types";

interface FileDropZoneProps {
  onFileLoad: (file: File, vehicle: VehicleData) => void;
  currentVehicle: VehicleData | null;
}

export function FileDropZone({ onFileLoad, currentVehicle }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".bin")) {
      setError("Yalnızca .bin uzantılı ECU dump dosyaları yüklenebilir.");
      return;
    }
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ecu/upload", { method: "POST", body: formData });
      // Sunucu JSON döndürmezse (ör. 500 "Internal Server Error" düz metni)
      // res.json() "Unexpected token" hatası fırlatır; önce metin olarak okuyoruz.
      const raw = await res.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      if (!data) {
        setError(
          res.status === 500
            ? "Sunucu tarafında beklenmeyen bir hata oluştu (HTTP 500). Geliştirme sunucusunu yeniden başlatın ve tekrar deneyin."
            : `Dosya doğrulanamadı (HTTP ${res.status}). Lütfen tekrar deneyin.`
        );
        return;
      }
      if (!res.ok || data?.success === false) {
        setError(
          data?.detail ||
            data?.error ||
            "Dosya doğrulanamadı. Doğrulanmış bir EDC15 dump dosyası kullanın."
        );
        return;
      }
      onFileLoad(file, {
        ...SAMPLE_VEHICLE,
        ecu: data?.identity?.display_name || SAMPLE_VEHICLE.ecu,
        checksum:
          data?.checksum?.overall_status === "VALID"
            ? "Checksum doğrulandı"
            : data?.checksum?.overall_status === "UNSEALED"
            ? "İmzalanmamış stok dump"
            : "Checksum doğrulanamadı",
        status: "Dosya doğrulandı ve düzenleme oturumuna yüklendi",
        fileName: file.name,
        fileSize: `${Math.max(1, Math.round(file.size / 1024))} KB`,
        loadedAt: "Şimdi",
      });
    } catch (err: any) {
      setError(
        err?.message ||
          "Yükleme başarısız. Python çekirdeğinin (FastAPI) çalıştığından emin olun."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSampleClick = () => {
    setError(null);
    setIsProcessing(true);
    const mock = createMockVehicleFile();
    setTimeout(() => {
      onFileLoad(mock, SAMPLE_VEHICLE);
      setIsProcessing(false);
    }, 500);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-7 text-center transition-all duration-200 ${
        isDragging
          ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/30"
          : "border-[#bfdbfe] bg-[#f8fbff] dark:border-blue-900/40 dark:bg-slate-900/60"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".bin"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Bulut Yükleme İkonu */}
      <div className="flex h-12 w-12 items-center justify-center text-[#2563eb] dark:text-blue-400">
        <svg
          className="h-10 w-10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
          <path d="M12 12v9" />
          <path d="m8 16 4-4 4 4" />
        </svg>
      </div>

      {/* Tıklanabilir 'seçin' Başlığı */}
      <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
        .bin dosyanızı buraya sürükleyin veya{" "}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-[#1d63ed] underline hover:text-blue-700 dark:text-blue-400 font-bold"
        >
          seçin
        </button>
      </p>

      {/* Alt Bilgi */}
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
        (ECU yazılım dökümü - .bin formatı, maksimum 4 MB)
      </p>
      <p className="mt-1 max-w-md text-[11px] text-slate-500 dark:text-slate-400">
        Dosya yüklendiğinde Python çekirdeği önce ECU kimliğini ve dosya boyutunu
        doğrular. Eşleşmeyen bir dosyada hiçbir offset tahmin edilmez; düzenleme
        oturumu açılmaz.
      </p>

      {error && (
        <p className="mt-3 max-w-md rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}

      {/* Eylem Butonları */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {/* Dosya Seç Butonu */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="flex items-center gap-2 rounded-xl bg-[#1d63ed] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow disabled:opacity-70"
        >
          <Folder className="h-4 w-4" />
          Dosya Seç
        </button>

        {/* Örnek Dosya Butonu */}
        <button
          type="button"
          onClick={handleSampleClick}
          disabled={isProcessing}
          className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-[#edf2f9] px-4 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200/80 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <Car className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          {isProcessing ? "Yükleniyor..." : "Örnek Dosya ile Dene (1.9 TDI EDC15)"}
        </button>
      </div>

      {currentVehicle && (
        <div className="mt-3.5 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          <span>Yüklü Dosya: {currentVehicle.fileName} ({currentVehicle.fileSize})</span>
        </div>
      )}
    </div>
  );
}
