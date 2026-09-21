"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Briefcase, FileText, FolderKanban, LogOut, Receipt, X } from "lucide-react";
import { SkipLink } from "@/components/a11y/skip-link";
import { Logo } from "@/components/brand/logo";
import { InactivityGuard } from "@/components/dashboard/inactivity";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { endDemoSession } from "@/app/actions";
import { CLIENT_PORTAL_READONLY_NOTE } from "@/lib/org/client-portal-model";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/client", label: "Overview", icon: Briefcase },
  { href: "/client#estimates", label: "Estimates", icon: FileText },
  { href: "/client#invoices", label: "Invoices", icon: Receipt },
  { href: "/client#projects", label: "Projects", icon: FolderKanban },
  { href: "/client#documents", label: "Documents", icon: FileText },
];

export function ClientPortalShell({
  children,
  theme,
  email,
  businessName,
}: {
  children: React.ReactNode;
  theme: "light" | "dark";
  email: string;
  businessName: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuId = useId();

  return (
    <div className="min-h-screen bg-canvas text-ink" data-surface="client">
      <SkipLink />
      <InactivityGuard />
      <div className="bg-forest px-4 py-2 text-center text-xs text-white">{CLIENT_PORTAL_READONLY_NOTE}</div>
      <div className="flex min-h-screen">
        <aside className="no-print sticky top-0 z-30 hidden h-screen w-[240px] shrink-0 flex-col border-r border-line bg-obsidian text-ink md:flex">
          <div className="px-3 py-4">
            <Logo invert={theme === "dark"} href="/client" />
          </div>
          <p className="px-4 pb-3 text-xs uppercase tracking-[0.16em] text-muted">Client portal</p>
          <nav className="flex-1 px-2" aria-label="Client portal">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="sts-nav-link mt-1 flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted hover:bg-lavender hover:text-ink"
              >
                <item.icon size={18} aria-hidden />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {mobileOpen ? (
          <div className="no-print fixed inset-0 z-40 md:hidden">
            <button className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
            <aside id={menuId} className="relative flex h-full w-[min(100%,20rem)] flex-col overflow-y-auto bg-obsidian p-4 text-ink">
              <div className="flex items-center justify-between gap-3">
                <Logo invert={theme === "dark"} href="/client" />
                <button type="button" className="rounded-md p-2 text-soft-gray hover:bg-white/5" aria-label="Close menu" onClick={() => setMobileOpen(false)}>
                  <X size={18} aria-hidden />
                </button>
              </div>
              <nav className="mt-6 space-y-2" aria-label="Client portal">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="sts-nav-link flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted" onClick={() => setMobileOpen(false)}>
                    <item.icon size={18} aria-hidden />
                    {item.label}
                  </Link>
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
            <p className="min-w-0 flex-1 truncate text-sm text-muted">{businessName || "Client portal"}</p>
            <ThemeToggle theme={theme} />
            <span className={cn("hidden rounded-md border border-line px-3 py-1.5 text-xs sm:block")}>{email}</span>
            <form action={endDemoSession}>
              <button className="rounded-md p-2 hover:bg-canvas" aria-label="Sign out">
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
