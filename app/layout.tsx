import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "AutoTune AI | Yapay Zeka Destekli ECU Tuning Platformu",
  description:
    "Yeni başlayanlar için yapay zeka destekli otomotiv ECU kalibrasyon stüdyosu. .bin dosyanızı yükleyin, güvenli harita önerilerini görün ve checksum imzalı dosyanızı indirin.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}