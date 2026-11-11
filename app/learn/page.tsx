"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { GraduationCap, BookOpen, HelpCircle, ShieldAlert, Cpu, Gauge } from "lucide-react";

const ARTICLES = [
  {
    title: "ECU (Motor Beyni) Nedir ve Nasıl Çalışır?",
    category: "Temel Bilgiler",
    icon: Cpu,
    readTime: "4 dk okuma",
    desc: "Elektronik Kontrol Ünitesi (ECU), motorun hava, yakıt, ateşleme ve turbo basınç haritalarını milisaniye hassasiyetinde yöneten mikroişlemcili kontrol merkezidir.",
  },
  {
    title: "Turbo Basıncı ve Egzoz Sıcaklığı (EGT) Dengesi",
    category: "Güvenlik & Donanım",
    icon: Gauge,
    readTime: "6 dk okuma",
    desc: "Turbo basıncını artırırken silindir içi sıcaklığın ve turbo pallerinin aşırı ısınmaması için emniyet payı neden önemlidir?",
  },
  {
    title: "Checksum (Sağlama Toplamı) Neden Hayatidir?",
    category: "Yazılım Güvenliği",
    icon: ShieldAlert,
    readTime: "5 dk okuma",
    desc: "Bozuk bir checksum ile ECU flaşlandığında motor beyni 'brick' (kilitli) olabilir. AutoTune AI, dosyanızı ihraç etmeden önce sağlama toplamını otomatik yeniden hesaplar.",
  },
  {
    title: "Hava/Yakıt Oranı (AFR) ve Dizel Duman Optimizasyonu",
    category: "Emisyon & Performans",
    icon: BookOpen,
    readTime: "7 dk okuma",
    desc: "Doğru stokiyometrik oran ile maksimum yanma verimi sağlayarak hem siyah dumanı engeller hem de yakıt ekonomisi elde edersiniz.",
  },
];

export default function LearnPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <GraduationCap className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            Tuning Akademisi
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Yeni başlayanlar için otomotiv yazılımı, motor mekaniği ve güvenli tuning rehberleri.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {ARTICLES.map((article, idx) => {
            const Icon = article.icon;
            return (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                      {article.category}
                    </span>
                    <span className="text-xs text-slate-400">{article.readTime}</span>
                  </div>

                  <div className="mt-4 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {article.title}
                      </h3>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {article.desc}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-3 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Hazırlayan: AutoTune AI Engine</span>
                  <button className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                    Rehberi Oku →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}

