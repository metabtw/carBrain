"use client";

import { useTheme } from "@/components/theme-provider";
import { MobileNav } from "@/components/mobile-nav";
import { Sun, Moon } from "lucide-react";

export function TopNav() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:justify-end lg:px-8">
      <div className="flex items-center gap-2 lg:hidden">
        <MobileNav />
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
          AutoTune <span className="text-blue-600 dark:text-blue-400">AI</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Açık / koyu tema anahtarı */}
        <button
          onClick={toggleTheme}
          aria-label="Tema değiştir"
          className="flex h-9 items-center gap-2 rounded-full border border-slate-200/90 bg-white px-2.5 shadow-sm transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
        >
          <Sun
            className={`h-4 w-4 transition-colors ${
              theme === "light"
                ? "font-bold text-amber-500"
                : "text-slate-400 dark:text-slate-500"
            }`}
          />
          <Moon
            className={`h-3.5 w-3.5 transition-colors ${
              theme === "dark" ? "font-bold text-blue-400" : "text-slate-400"
            }`}
          />
        </button>

        {/* Kullanıcı avatarı */}
        <div className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#1e293b] text-white shadow-sm transition-transform hover:scale-105 dark:bg-slate-800 dark:text-slate-100 dark:ring-1 dark:ring-slate-700">
          <span className="text-sm font-semibold tracking-wide">M</span>
        </div>
      </div>
    </header>
  );
}
