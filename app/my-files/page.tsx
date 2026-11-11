"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { FolderOpen, FileText, Download, CheckCircle, Clock, HardDrive, Trash2 } from "lucide-react";
import { useState } from "react";

const INITIAL_FILES = [
  {
    id: "1",
    name: "golf_iv_19tdi_edc15.bin",
    ecu: "Bosch EDC15P+",
    size: "512 KB",
    date: "10 Kas 2026, 20:15",
    status: "v1 · Orijinal Yedek",
    checksum: "0x89FA2C",
  },
  {
    id: "2",
    name: "golf_iv_stage1_eco_tuned.bin",
    ecu: "Bosch EDC15P+",
    size: "512 KB",
    date: "10 Kas 2026, 20:25",
    status: "v2 · Düzenlenmiş (Mod)",
    checksum: "0x8AF110",
  },
];

export default function MyFilesPage() {
  const [files, setFiles] = useState(INITIAL_FILES);

  const handleDelete = (id: string) => {
    setFiles(files.filter((f) => f.id !== id));
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <FolderOpen className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            Dosyalarım
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Yüklediğiniz fabrika orijinal .bin dosyaları ve oluşturulan mod haritaları.
            Her dışa aktarım yeni bir sürüm (v1, v2, v3...) olarak saklanır; istediğiniz
            sürüme geri dönebilirsiniz. Üretimde dosyalar Supabase Storage üzerinde,
            meta veriler ise PostgreSQL&apos;de tutulur.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              v1 · Stok yedek
            </span>
            <span>→</span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              v2 · Stage 1
            </span>
            <span>→</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              v3 · Yeni deneme
            </span>
            <span className="ml-auto">
              Sürüm geri yükleme, checksum&apos;ı doğrulanmış dosya ile yapılır.
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-5 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Kayıtlı ECU Dosyaları ({files.length})
              </h2>
            </div>
            <span className="text-xs text-slate-400">Toplam: 1.0 MB / 50 MB</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex flex-col gap-4 p-5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {file.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>ECU: {file.ecu}</span>
                      <span>•</span>
                      <span>{file.size}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {file.date}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {file.checksum}
                  </span>

                  <button
                    onClick={() => handleDelete(file.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                    title="Sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

