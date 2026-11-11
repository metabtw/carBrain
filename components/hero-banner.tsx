"use client";

export function HeroBanner() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-white via-[#f0f6ff]/60 to-[#e9f2fe]/90 p-8 shadow-soft border border-slate-200/60 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-800/60">
      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
        {/* Left Column: Heading & Subtitle */}
        <div className="lg:col-span-7 z-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white leading-[1.2]">
            Aracınızın Potansiyelini{" "}
            <span className="text-[#1d63ed] dark:text-[#3b82f6]">Güvenle</span>
            <br />
            Ortaya Çıkarın
          </h1>
          <p className="mt-3.5 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300 font-normal">
            Yapay zeka destekli <strong className="font-semibold text-slate-800 dark:text-slate-200">ECU tuning platformu</strong>. Karmaşık ayarlar yok, sadece daha iyi bir sürüş deneyimi var.
          </p>
        </div>

        {/* Right Column: Car Image */}
        <div className="relative flex justify-center lg:col-span-5 lg:justify-end">
          <div className="relative w-full max-w-[340px] drop-shadow-md transition-transform duration-500 hover:scale-[1.02]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hero_car_transparent.png"
              alt="Volkswagen Golf IV / VII Silver"
              className="w-full h-auto object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

