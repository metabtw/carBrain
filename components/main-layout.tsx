import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 flex-1">
        <TopNav />
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}