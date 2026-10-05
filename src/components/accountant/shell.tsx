"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Calculator, LogOut, X } from "lucide-react";
import { SkipLink } from "@/components/a11y/skip-link";
import { Logo } from "@/components/brand/logo";
import { InactivityGuard } from "@/components/dashboard/inactivity";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { endDemoSession } from "@/app/actions";
import { ACCOUNTANT_READONLY_NOTE } from "@/lib/org/accountant-model";
import { cn } from "@/lib/utils";

export function AccountantShell({
  children,
  theme,
  demo,
  email,
  canOpenDashboard,
}: {
  children: React.ReactNode;
  theme: "light" | "dark";
  demo: boolean;
  email: string;
  canOpenDashboard: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="min-h-screen bg-canvas text-ink" data-surface="accountant">
      <SkipLink />
      <InactivityGuard />
      <div className="bg-forest px-4 py-2 text-center text-xs text-white">
        {ACCOUNTANT_READONLY_NOTE}
      </div>
      {demo ? (
        <div className="no-print bg-lead px-4 py-2 text-center text-xs text-white">
          Demo oversight view — labeled draft data, not production books. No accountant identity was created.
        </div>
      ) : null}
      <div className="flex min-h-screen">
        <aside className="no-print sticky top-0 z-30 hidden h-screen w-[240px] shrink-0 flex-col border-r border-line bg-obsidian text-ink md:flex">
          <div className="px-3 py-4">
            <Logo invert={theme === "dark"} href="/accountant" />
          </div>
          <nav className="flex-1 px-2" aria-label="Accountant Center">
            <Link
              href="/accountant"
              className="sts-nav-link flex items-center gap-3 rounded-md bg-lavender px-2.5 py-2 text-sm text-ink shadow-[inset_3px_0_0_0_var(--violet)]"
              aria-current="page"
            >
              <Calculator size={18} aria-hidden />
              Accountant Center
            </Link>
            {canOpenDashboard ? (
              <Link
                href="/dashboard"
                className="sts-nav-link mt-1 flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted hover:bg-lavender hover:text-ink"
              >
                Command Center
              </Link>
            ) : null}
          </nav>
        </aside>

        {mobileOpen ? (
          <div className="no-print fixed inset-0 z-40 md:hidden">
            <button className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
            <aside id={menuId} className="relative flex h-full w-[min(100%,20rem)] flex-col overflow-y-auto bg-obsidian p-4 text-ink">
              <div className="flex items-center justify-between gap-3">
                <Logo invert={theme === "dark"} href="/accountant" />
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
              <nav className="mt-6 space-y-2" aria-label="Accountant Center">
                <Link href="/accountant" className="sts-nav-link flex items-center gap-3 rounded-md bg-lavender px-2.5 py-2 text-sm text-ink" onClick={() => setMobileOpen(false)}>
                  <Calculator size={18} aria-hidden />
                  Accountant Center
                </Link>
                {canOpenDashboard ? (
                  <Link href="/dashboard" className="sts-nav-link flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted" onClick={() => setMobileOpen(false)}>
                    Command Center
                  </Link>
                ) : null}
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
            <p className="min-w-0 flex-1 truncate text-sm text-muted">Read-only financial review</p>
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
