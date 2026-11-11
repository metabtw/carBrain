"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { Star, Zap, Fuel, Shield, Mountain, Check } from "lucide-react";
import Link from "next/link";

const PRESETS = [
  {
    id: "safe-daily",
    title: "GÃ¼venli GÃ¼nlÃ¼k SÃ¼rÃ¼ÅŸ",
    subtitle: "Dengeli GÃ¼nlÃ¼k SÃ¼rÃ¼ÅŸ",
    desc: "Motor Ã¶mrÃ¼nÃ¼ ve yakÄ±t ekonomisini korurken hafif ivmelenme tepkisi kazandÄ±rÄ±r.",
    turbo: "+4%",
    injection: "-4%",
    throttle: "+5%",
    turboNum: 4,
    injectionNum: -4,
    throttleNum: 5,
    torqueNum: 4,
    icon: Shield,
    color: "from-emerald-500 to-teal-600",
    badge: "Tavsiye Edilen",
  },
  {
    id: "eco-saver",
    title: "Ekonomi ve Uzun Yol",
    subtitle: "Maksimum YakÄ±t Tasarrufu",
    desc: "Uzun yol ve ÅŸehir iÃ§i sakin sÃ¼rÃ¼ÅŸlerde %10-15 yakÄ±t tasarrufu hedefler.",
    turbo: "+2%",
    injection: "-8%",
    throttle: "+2%",
    turboNum: 2,
    injectionNum: -8,
    throttleNum: 2,
    torqueNum: 2,
    icon: Fuel,
    color: "from-blue-500 to-cyan-600",
    badge: "Ekonomik",
  },
  {
    id: "sport-stage1",
    title: "Stage 1 Dinamik Sport",
    subtitle: "Sportif Yol PerformansÄ±",
    desc: "Fabrika turbo ve enjektÃ¶r sÄ±nÄ±rlarÄ± iÃ§inde kalarak +15 HP ve +30 Nm ekstra gÃ¼Ã§ saÄŸlar.",
    turbo: "+12%",
    injection: "+5%",
    throttle: "+12%",
    turboNum: 12,
    injectionNum: 5,
    throttleNum: 12,
    torqueNum: 8,
    icon: Zap,
    color: "from-violet-500 to-indigo-600",
    badge: "Performans",
  },
  {
    id: "mountain-towing",
    title: "YokuÅŸ TÄ±rmanÄ±ÅŸÄ± ve Ã‡ekiÅŸ",
    subtitle: "YokuÅŸ ve Ã‡ekiÅŸ DesteÄŸi",
    desc: "DÃ¼ÅŸÃ¼k devirlerde erken tork Ã¼reterek rampalarda ve yÃ¼k taÅŸÄ±mada rahatlatÄ±r.",
    turbo: "+10%",
    injection: "+4%",
    throttle: "+8%",
    turboNum: 10,
    injectionNum: 4,
    throttleNum: 8,
    torqueNum: 6,
    icon: Mountain,
    color: "from-amber-500 to-orange-600",
    badge: "Tork OdaklÄ±",
  },
];

export default function PresetsPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Star className="h-7 w-7 text-amber-500" />
            HazÄ±r Tuning Profilleri
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Yapay zeka ve uzman kalibratÃ¶rler tarafÄ±ndan test edilmiÅŸ hazÄ±r ECU profilleri.
            Bir profile tÄ±kladÄ±ÄŸÄ±nÄ±zda deÄŸerler kontrol paneline taÅŸÄ±nÄ±r; dosyanÄ±z yine
            gÃ¼venlik bekÃ§isi ve checksum doÄŸrulamasÄ±ndan geÃ§meden dÄ±ÅŸa aktarÄ±lmaz.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200/70 bg-blue-50/70 p-4 text-xs leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
          <strong className="font-bold">HazÄ±r profil havuzu nasÄ±l Ã§alÄ±ÅŸÄ±r?</strong>{" "}
          Usta tuner&apos;lar kendi Stage 1 dosyalarÄ±nÄ± yÃ¼kleyip paylaÅŸabilir; yeni baÅŸlayanlar
          tek tÄ±kla bu deÄŸerleri kendi araÃ§larÄ±na uygulayabilir. PaylaÅŸÄ±lan her profil,
          backend&apos;deki mÃ¼hendislik sÄ±nÄ±rlarÄ± (turbo, yakÄ±t, EGT, tork) ve 16x16 harita
          doÄŸrulamasÄ± ile denetlenir. Bu demo sÃ¼rÃ¼mÃ¼nde profiller yerel olarak saklanÄ±r;
          Ã¼retimde Supabase tablosu ve moderasyon akÄ±ÅŸÄ± kullanÄ±lÄ±r.
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            return (
              <div
                key={preset.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${preset.color} text-white shadow-sm`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {preset.badge}
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">
                    {preset.title}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {preset.subtitle}
                  </p>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {preset.desc}
                  </p>

                  <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Turbo</span>
                      <strong className="text-blue-600 dark:text-blue-400">{preset.turbo}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Enjeksiyon</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">{preset.injection}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Gaz Hassasiyeti</span>
                      <strong className="text-orange-500">{preset.throttle}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Tork Limitörü</span>
                      <strong className="text-violet-500">+{preset.torqueNum}%</strong>
                    </div>
                  </div>
                </div>

                <Link
                  href={`/?turbo=${preset.turboNum}&injection=${preset.injectionNum}&throttle=${preset.throttleNum}&torque=${preset.torqueNum}`}
                  className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-blue-600 hover:text-white dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-blue-600"
                >
                  <Check className="h-4 w-4" />
                  Dashboard&apos;da Uygula
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}

