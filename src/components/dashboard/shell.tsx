"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Bell, ChevronLeft, ChevronRight, ExternalLink, LogOut, Moon, Search, Sun, X } from "lucide-react";
import { SkipLink } from "@/components/a11y/skip-link";
import { Logo } from "@/components/brand/logo";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { InactivityGuard } from "@/components/dashboard/inactivity";
import { endDemoSession, toggleTheme } from "@/app/actions";
import { dashboardNavGroups, type DashboardNavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

function navItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: DashboardNavItem;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const active = navItemActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "mb-0.5 flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-soft-gray hover:bg-white/5 hover:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric",
        active && "bg-white/10 text-ivory shadow-[inset_2px_0_0_0_#3b82f6]",
        collapsed && "justify-center px-0",
      )}
      title={item.status === "planned" ? `${item.label} (planned)` : item.label}
      aria-label={collapsed ? `${item.label}${item.status === "planned" ? ", planned" : ""}` : undefined}
      aria-current={active ? "page" : undefined}
    >
      <Icon size={18} aria-hidden />
      {collapsed ? null : (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate">{item.label}</span>
          {item.status === "planned" ? (
            <span className="rounded-full border border-violet/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-lavender">
              Planned
            </span>
          ) : null}
        </span>
      )}
    </Link>
  );
}

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
  const [collapsed, setCollapsed] = useState(collapsedDefault);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pending, start] = useTransition();
  const menuId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    closeButtonRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SkipLink />
      <CommandPalette />
      <InactivityGuard />
      {demo ? (
        <div className="bg-forest px-4 py-2 text-center text-xs text-ivory">
          Demo workspace — labeled draft data, not production books. Supabase Auth is required before this is a live command center.
        </div>
      ) : null}
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "no-print sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-white/10 bg-obsidian text-ivory transition-[width] md:flex",
            collapsed ? "w-[76px]" : "w-[272px]",
          )}
        >
          <div className="flex items-center justify-between px-3 py-4">
            <Logo compact={collapsed} invert href="/dashboard" />
            <button
              className="rounded-md p-1 text-soft-gray hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight size={16} aria-hidden /> : <ChevronLeft size={16} aria-hidden />}
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 pb-16" aria-label="Business OS">
            {dashboardNavGroups.map((group) => (
              <div key={group.id} className="mb-2">
                {collapsed ? (
                  <div className="mx-auto my-2 h-px w-6 bg-white/10" aria-hidden />
                ) : (
                  <p className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-soft-gray/70">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => (
                  <NavLink key={`${group.id}-${item.href}`} item={item} pathname={pathname} collapsed={collapsed} />
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
            <aside id={menuId} className="relative flex h-full w-[min(100%,20rem)] flex-col overflow-y-auto bg-obsidian p-4 text-ivory">
              <div className="flex items-center justify-between gap-3">
                <Logo invert href="/dashboard" />
                <button
                  ref={closeButtonRef}
                  type="button"
                  className="rounded-md p-2 text-soft-gray hover:bg-white/5"
                  aria-label="Close menu"
                  onClick={() => setMobileOpen(false)}
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
              <nav className="mt-6 space-y-4 pb-16" aria-label="Business OS">
                {dashboardNavGroups.map((group) => (
                  <div key={group.id}>
                    <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-soft-gray/70">{group.label}</p>
                    {group.items.map((item) => (
                      <NavLink
                        key={`mobile-${group.id}-${item.href}`}
                        item={item}
                        pathname={pathname}
                        onNavigate={() => setMobileOpen(false)}
                      />
                    ))}
                  </div>
                ))}
              </nav>
            </aside>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-card/90 px-4 py-3 backdrop-blur">
            <button
              className="rounded-md border border-line px-2 py-1 text-sm md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              aria-controls={menuId}
            >
              Menu
            </button>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label="Open command palette"
              onClick={() => window.dispatchEvent(new Event("sts:open-command"))}
              className="relative hidden min-w-0 flex-1 items-center md:flex"
            >
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" aria-hidden />
              <span className="flex h-9 w-full max-w-md items-center rounded-md border border-line bg-canvas pl-9 pr-3 text-left text-sm text-muted">
                Search Command Center…
                <kbd className="ml-auto hidden rounded border border-line px-1.5 py-0.5 text-[10px] text-muted sm:inline">⌘K</kbd>
              </span>
            </button>
            <Link href="/" className="hidden rounded-md p-2 hover:bg-canvas lg:inline-flex" aria-label="View public site">
              <ExternalLink size={18} aria-hidden />
            </Link>
            <Link href="/dashboard/notifications" className="rounded-md p-2 hover:bg-canvas" aria-label="Notifications">
              <Bell size={18} aria-hidden />
            </Link>
            <button
              className="rounded-md p-2 hover:bg-canvas"
              aria-label="Toggle color theme"
              onClick={() => start(() => toggleTheme(theme === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
            </button>
            <Link href="/dashboard/settings/security" className="hidden rounded-md border border-line px-3 py-1.5 text-xs sm:block">
              {email}
            </Link>
            <form action={endDemoSession}>
              <button className="rounded-md p-2 hover:bg-canvas" aria-label="Sign out" disabled={pending}>
                <LogOut size={18} aria-hidden />
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
