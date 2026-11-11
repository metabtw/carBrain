"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderArchive, ShoppingBag, GraduationCap, Activity, Settings, Info, Menu, X } from "lucide-react";

const navItems = [
  { href: "/", label: "Kontrol Paneli", icon: LayoutDashboard },
  { href: "/my-files", label: "Dosya Arşivi & Versiyonlar", icon: FolderArchive },
  { href: "/presets", label: "Pazar Yeri & Hazır Haritalar", icon: ShoppingBag },
  { href: "/datalogger", label: "Canlı Test (OBD2 Logger)", icon: Activity },
  { href: "/learn", label: "Tuning Akademisi", icon: GraduationCap },
  { href: "/settings", label: "Güvenlik & Ayarlar", icon: Settings },
  { href: "/about", label: "Hakkında", icon: Info },
];

/**
 * Küçük ekranlar için çekmece menü.
 *
 * Masaüstünde sabit sidebar kullanılır; 1024px altında sidebar gizlenir ve
 * içerik tam genişliğe yayılır. Bu olmadan `fixed w-64` sidebar içeriği
 * ekran dışına itiyordu.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menüyü aç"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 lg:hidden"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Menüyü kapat"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          <aside className="relative flex h-full w-[82%] max-w-xs flex-col border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="flex h-20 items-center justify-between border-b border-slate-100 px-5 dark:border-slate-800/80">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 shadow-sm">
                  <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 14v-4" />
                    <path d="M3.34 19a10 10 0 1 1 17.32 0" />
                  </svg>
                </div>
                <div className="leading-tight">
                  <div className="flex items-baseline">
                    <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">AutoTune</span>
                    <span className="ml-1 text-lg font-bold text-blue-600 dark:text-blue-400">AI</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Otomotiv Yazılım Stüdyosu</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Menüyü kapat"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 pt-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-xs transition-all duration-150 ${
                      isActive
                        ? "bg-[#e8f1fd] font-bold text-[#1d63ed] shadow-sm dark:bg-blue-950/50 dark:text-blue-400"
                        : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[#1d63ed] dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-slate-100 p-4 dark:border-slate-800">
              <p className="text-center text-[10px] leading-snug text-slate-400">
                Akıllı Modifiye. Güvenli Sürüş.
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
