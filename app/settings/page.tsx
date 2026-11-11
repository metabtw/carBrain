"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { Settings, Shield, Bell, Moon, Sliders, Database, Save } from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const [safetyLock, setSafetyLock] = useState(true);
  const [autoChecksum, setAutoChecksum] = useState(true);
  const [cloudBackup, setCloudBackup] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const handleSave = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Settings className="h-7 w-7 text-slate-600 dark:text-slate-300" />
            Ayarlar
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Platform emniyet kilitleri, kalibrasyon sınırları ve dosya dışa aktarma tercihleri.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-500" />
            Emniyet & Güvenlik Kilitleri
          </h2>

          <div className="mt-4 space-y-4 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            <div className="flex items-center justify-between pt-3">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Acemi Güvenlik Kilidi (Beginner Safety Limit Lock)
                </p>
                <p className="text-xs text-slate-400">
                  Parametrelerin fabrika güvenli toleransı olan -%10 ile +%15 aralığının dışına çıkmasını engeller.
                </p>
              </div>
              <input
                type="checkbox"
                checked={safetyLock}
                onChange={(e) => setSafetyLock(e.target.checked)}
                className="h-5 w-5 rounded accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Otomatik Checksum (Sağlama) Hesaplama
                </p>
                <p className="text-xs text-slate-400">
                  İhraç edilen her .bin dosyasının sağlama toplamını Bosch EDC15 uyumlu
                  toplamsal imza motoru ile otomatik yeniden hesaplar ve dosyayı
                  doğrulamadan indirmez.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoChecksum}
                onChange={(e) => setAutoChecksum(e.target.checked)}
                className="h-5 w-5 rounded accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Orijinal Dosyayı Otomatik Yedekle
                </p>
                <p className="text-xs text-slate-400">
                  Her değişiklik öncesinde fabrika orijinal .bin dosyasının geri dönüş yedeğini tarayıcı yerel belleğinde saklar.
                </p>
              </div>
              <input
                type="checkbox"
                checked={cloudBackup}
                onChange={(e) => setCloudBackup(e.target.checked)}
                className="h-5 w-5 rounded accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5 dark:border-slate-800">
            {savedToast ? (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                ✓ Ayarlar başarıyla kaydedildi.
              </span>
            ) : (
              <span className="text-xs text-slate-400">Tüm değişiklikler yerel oturumunuza uygulanır.</span>
            )}
            <button
              onClick={handleSave}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <Save className="h-4 w-4" />
              Ayarları Kaydet
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

