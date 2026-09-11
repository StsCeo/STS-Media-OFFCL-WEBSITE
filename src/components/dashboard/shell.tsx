"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell, ChevronLeft, ChevronRight, LogOut, Moon, Search, Sun } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { endDemoSession, toggleTheme } from "@/app/actions";
import { dashboardNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function DashboardShell({
  children,
  collapsedDefault,
  theme,
  demo,
  email,
}: {
  children: React.ReactNode;
  collapsedDefault: boolean;
  theme: "light" | "dark";
  demo: boolean;
  email: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(collapsedDefault);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      {demo ? (
        <div className="bg-forest px-4 py-2 text-center text-xs text-ivory">
          Demo workspace — labeled draft data, not production books. Supabase Auth is required before this is a live command center.
        </div>
      ) : null}
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "no-print sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-white/10 bg-obsidian text-ivory transition-[width] md:flex",
            collapsed ? "w-[76px]" : "w-[260px]",
          )}
        >
          <div className="flex items-center justify-between px-3 py-4">
            <Logo compact={collapsed} invert href="/dashboard" />
            <button
              className="rounded-md p-1 text-soft-gray hover:bg-white/5"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 pb-4">
            {dashboardNav.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "mb-0.5 flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-soft-gray hover:bg-white/5 hover:text-ivory",
                    active && "bg-white/8 text-ivory",
                    collapsed && "justify-center px-0",
                  )}
                  title={item.label}
                >
                  <Icon size={18} />
                  {collapsed ? null : item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
            <aside className="relative h-full w-72 overflow-y-auto bg-obsidian p-4 text-ivory">
              <Logo invert href="/dashboard" />
              <nav className="mt-6 space-y-1">
                {dashboardNav.map((item) => (
                  <Link key={item.href} href={item.href} className="block rounded-md px-2 py-2 text-sm text-soft-gray hover:bg-white/5" onClick={() => setMobileOpen(false)}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </aside>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-card/90 px-4 py-3 backdrop-blur">
            <button className="rounded-md border border-line px-2 py-1 text-sm md:hidden" onClick={() => setMobileOpen(true)}>
              Menu
            </button>
            <form
              className="relative hidden min-w-0 flex-1 md:block"
              onSubmit={(event) => {
                event.preventDefault();
                const q = new FormData(event.currentTarget).get("q");
                router.push(`/dashboard/inbox?q=${encodeURIComponent(String(q || ""))}`);
              }}
            >
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input name="q" placeholder="Search inbox, leads, projects…" className="h-9 w-full max-w-md rounded-md border border-line bg-canvas pl-9 pr-3 text-sm" />
            </form>
            <Link href="/dashboard/notifications" className="rounded-md p-2 hover:bg-canvas" aria-label="Notifications">
              <Bell size={18} />
            </Link>
            <button
              className="rounded-md p-2 hover:bg-canvas"
              aria-label="Toggle color theme"
              onClick={() => start(() => toggleTheme(theme === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link href="/dashboard/settings/security" className="hidden rounded-md border border-line px-3 py-1.5 text-xs sm:block">
              {email}
            </Link>
            <form action={endDemoSession}>
              <button className="rounded-md p-2 hover:bg-canvas" aria-label="Sign out" disabled={pending}>
                <LogOut size={18} />
              </button>
            </form>
          </header>
          <main id="main" className="px-4 py-6 md:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
