"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

const NO_SIDEBAR_ROUTES = ["/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !NO_SIDEBAR_ROUTES.some((route) => pathname.startsWith(route));
  const [collapsed, setCollapsed] = useState(false);

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Collapsed state: show expand button */}
      {collapsed && (
        <div className="flex flex-col items-center py-4 px-1.5 bg-kb-surface border-r border-kb-border shrink-0">
          <button
            onClick={() => setCollapsed(false)}
            className="p-2 rounded-lg hover:bg-kb-surface-2 text-kb-text-muted hover:text-kb-primary transition-colors"
            title="Expand sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}

      {/* Expanded sidebar */}
      {!collapsed && <Sidebar onCollapse={() => setCollapsed(true)} />}

      <main className="flex-1 overflow-y-auto">{children}</main>
    </>
  );
}
