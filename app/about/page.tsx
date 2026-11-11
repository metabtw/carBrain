"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { Info, ShieldCheck, Heart, Cpu, Code2, Sparkles } from "lucide-react";

export default function AboutPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Info className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            Hakkında (AutoTune AI)
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Yeni nesil, yapay zeka destekli otomotiv ECU kalibrasyon vizyonumuz.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">
              Yeni Başlayanlar İçin Sadeleştirildi
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Binlerce hexadecimal adresten ve karmaşık 3D tablolardan oluşan geleneksel tuning yazılımlarının aksine; AutoTune AI anlaşılır parametrelerle herkesin güvenle araç karakteristiğini ayarlamasını sağlar.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">
              %100 Güvenlik & Checksum Koruması
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Her işlem güvenlik aralıkları içinde sınırlanır (-%10 ile +%15). Oluşturulan tüm .bin dosyaları Bosch ve Siemens ECU standartlarına uygun sağlama toplamlarıyla doğrulanır.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <Cpu className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">
              Akıllı Oto-Asistan
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Sürüş amacınızı (yakıt tasarrufu, yokuş performansı, spor sürüş) asistanınıza ilettiğinizde, aracınızın motor ve turbo özelliklerine göre optimize edilmiş haritayı tek tıkla uygular.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Çekirdek Mimari: Gerçek .bin Dosyası Üzerinde Çalışır
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Arayüzdeki slider&apos;lar artık sahte bir önizleme değil, Python/FastAPI
            çekirdeğindeki gerçek harita hücrelerini değiştirir. Akış şu şekildedir:
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 text-xs md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="font-bold text-slate-800 dark:text-slate-200">parser.py</p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Dosya boyutu ve ECU kimliğini doğrular; 16-bit LoHi matrisleri NumPy ile okur.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="font-bold text-slate-800 dark:text-slate-200">guardrails.py</p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Turbo, yakıt, EGT, tork ve avans sınırlarını denetler; tehlikeli isteği reddeder.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="font-bold text-slate-800 dark:text-slate-200">modifier.py</p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Yüzde değişimini matris hücrelerine uygular, ham değer sınırlarında kırpar.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="font-bold text-slate-800 dark:text-slate-200">checksum.py</p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                İmzayı yeniden hesaplar, dosyayı tekrar okur ve doğrulamadan indirmez.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              AutoTune AI v2.0.0
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Next.js 14 (App Router) • Tailwind CSS • TypeScript • FastAPI • NumPy • Binary Parser
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Otomotiv tutkunları için hassasiyetle tasarlandı.</span>
            <Heart className="h-4 w-4 text-rose-500 fill-current" />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

