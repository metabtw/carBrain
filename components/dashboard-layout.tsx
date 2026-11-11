import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />
      <div className="pl-60">
        <TopNav />
        <main className="px-8 pb-10 pt-2">{children}</main>
      </div>
    </div>
  );
}
