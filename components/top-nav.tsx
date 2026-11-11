"use client";

import { useTheme } from "@/components/theme-provider";
import { Sun, Moon } from "lucide-react";

export function TopNav() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex h-16 w-full items-center justify-end px-8">
      <div className="flex items-center gap-3">
        {/* Dark / Light Toggle Pill */}
        <button
          onClick={toggleTheme}
          aria-label="Tema Değiştir"
          className="flex h-9 items-center gap-2 rounded-full border border-slate-200/90 bg-white px-2.5 shadow-sm transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
        >
          <Sun
            className={`h-4 w-4 transition-colors ${
              theme === "light"
                ? "text-amber-500 font-bold"
                : "text-slate-400 dark:text-slate-500"
            }`}
          />
          <Moon
            className={`h-3.5 w-3.5 transition-colors ${
              theme === "dark"
                ? "text-blue-400 font-bold"
                : "text-slate-400"
            }`}
          />
        </button>

        {/* User Profile Avatar */}
        <div className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#1e293b] text-white shadow-sm transition-transform hover:scale-105 dark:bg-slate-800 dark:text-slate-100 dark:ring-1 dark:ring-slate-700">
          <span className="text-sm font-semibold tracking-wide">M</span>
        </div>
      </div>
    </header>
  );
}
