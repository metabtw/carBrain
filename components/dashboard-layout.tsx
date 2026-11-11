import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      {/* Sabit sidebar yalnızca geniş ekranlarda; dar ekranlarda çekmece menü */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="lg:pl-64">
        <TopNav />
        <main className="px-4 pb-10 pt-2 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
