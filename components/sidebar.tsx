"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderArchive,
  ShoppingBag,
  GraduationCap,
  Activity,
  Settings,
  Info,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Kontrol Paneli", icon: LayoutDashboard },
  { href: "/my-files", label: "Dosya Arşivi & Versiyonlar", icon: FolderArchive },
  { href: "/presets", label: "Pazar Yeri & Hazır Haritalar", icon: ShoppingBag },
  { href: "/datalogger", label: "Canlı Test (OBD2 Logger)", icon: Activity },
  { href: "/learn", label: "Tuning Akademisi", icon: GraduationCap },
  { href: "/settings", label: "Güvenlik & Ayarlar", icon: Settings },
  { href: "/about", label: "Hakkında", icon: Info },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col overflow-y-auto border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
      {/* Logo Başlığı */}
      <div className="flex h-20 flex-col justify-center px-6 border-b border-slate-100 dark:border-slate-800/80">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 shadow-sm transition-transform duration-200 group-hover:scale-105">
            <svg
              className="h-5 w-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 14v-4" />
              <path d="M3.34 19a10 10 0 1 1 17.32 0" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-900" />
          </div>
          <div className="leading-tight">
            <div className="flex items-baseline">
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                AutoTune
              </span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400 ml-1">
                AI
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Otomotiv Yazılım Stüdyosu
            </p>
          </div>
        </Link>
      </div>

      {/* Gezinti Menüsü */}
      <nav className="flex-1 space-y-1.5 px-4 pt-3 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-xs transition-all duration-150 ${
                isActive
                  ? "bg-[#e8f1fd] text-[#1d63ed] font-bold shadow-sm dark:bg-blue-950/50 dark:text-blue-400"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200 font-medium"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[#1d63ed] dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Alt Promosyon Kartı */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-[#f4f7fc] p-3 text-center dark:border-slate-800 dark:bg-slate-900/80 shadow-sm">
          <div className="mx-auto flex h-12 w-full items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/sidebar_car_transparent.png"
              alt="Volkswagen Golf"
              className="h-10 w-auto object-contain transition-transform duration-300 hover:scale-105"
            />
          </div>
          <div className="mt-1 text-center">
            <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
              Akıllı Modifiye.
            </p>
            <div className="relative inline-block">
              <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                Güvenli Sürüş.
              </span>
              <svg
                className="absolute -bottom-1 left-0 w-full"
                height="4"
                viewBox="0 0 60 4"
                fill="none"
              >
                <path
                  d="M1 2.5C18 0.5 42 0.5 59 2.5"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
