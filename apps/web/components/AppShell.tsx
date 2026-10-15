"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <>{children}</>;
  }
  return (
    <div className="flex min-h-screen gap-8 px-4 py-8 sm:px-8">
      <Sidebar />
      <main className="min-w-0 flex-1 pb-16">{children}</main>
    </div>
  );
}
