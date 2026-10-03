"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ownersMenu, publicFooterAudience, publicFooterTrust, publicFooterVisit, publicNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function PublicHeader({ theme }: { theme: "light" | "dark" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const root = panelRef.current;
    if (!root) return;
    root.querySelector<HTMLElement>("a, button")?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab" || !root) return;
      const nodes = [...root.querySelectorAll<HTMLElement>("a, button, input, select, textarea")].filter(
        (node) => !node.hasAttribute("disabled"),
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    root.addEventListener("keydown", trap);
    return () => root.removeEventListener("keydown", trap);
  }, [open]);

  return (
    <header className={cn("sticky top-0 z-40 border-b border-line bg-card/90 backdrop-blur", pathname === "/" && "sts-home-chrome")}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Logo invert={theme === "dark"} />
        <nav className="hidden items-center gap-4 text-sm text-muted xl:flex xl:gap-6" aria-label="Primary">
          {publicNav.map((item) =>
            item.href === "/for/owners" ? (
              <OwnersDropdown key={item.href} pathname={pathname} />
            ) : (
              <NavLink key={item.href} href={item.href} label={item.label} pathname={pathname} />
            ),
          )}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} variant="pair" />
          <span className="hidden lg:inline-flex">
            <Button href="/contact" size="sm" className="rounded-full">
              Start a Project
            </Button>
          </span>
          <button
            className="rounded-md p-2 text-ink xl:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
        </div>
      </div>
      {open ? (
        <div id={menuId} ref={panelRef} className="border-t border-line px-4 py-4 xl:hidden">
          <nav className="flex flex-col gap-3 text-ink" aria-label="Mobile">
            {publicNav.map((item) => (
              <div key={item.href}>
                <Link href={item.href} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
                {item.href === "/for/owners" ? (
                  <Link className="mt-2 block pl-3 text-sm text-soft-gray" href="/login" onClick={() => setOpen(false)}>
                    Owner login
                  </Link>
                ) : null}
              </div>
            ))}
            <Button href="/contact">Start a Project</Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const current = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className="underline-offset-4 transition hover:text-ink hover:underline"
      aria-current={current ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

function OwnersDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = pathname === "/for/owners" || pathname.startsWith("/for/owners/") || pathname === "/login";

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className="inline-flex items-center gap-1 bg-transparent p-0 text-inherit underline-offset-4 transition hover:text-ink hover:underline"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-current={current ? "page" : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        Owners
        <ChevronDown size={14} aria-hidden className={open ? "rotate-180" : ""} />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 top-full z-50 mt-3 min-w-52 rounded-lg border border-line bg-card p-1 shadow-[var(--shadow-card)]"
        >
          {ownersMenu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className="block rounded-md px-3 py-2 text-ink hover:bg-lavender"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PublicFooter({ email, statement, theme }: { email: string; statement: string; theme: "light" | "dark" }) {
  return (
    <footer className="border-t border-line bg-card text-muted">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo invert={theme === "dark"} />
          <p className="mt-4 max-w-md text-sm leading-6">{statement}</p>
          <p className="mt-3 text-xs">Scars to Stars Media LLC · stsmedia.co</p>
          <p className="mt-3 text-xs">Built for business owners and creators who already did the hard part.</p>
        </div>
        <nav aria-label="Visit">
          <p className="text-sm font-medium text-ink">Visit</p>
          <ul className="mt-3 space-y-2 text-sm">
            {publicFooterVisit.map((item) => (
              <li key={item.href}>
                <Link className="underline-offset-4 hover:text-ink hover:underline" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Trust">
          <p className="text-sm font-medium text-ink">Trust</p>
          <ul className="mt-3 space-y-2 text-sm">
            {publicFooterAudience.map((item) => (
              <li key={item.href}>
                <Link className="underline-offset-4 hover:text-ink hover:underline" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
            {publicFooterTrust.map((item) => (
              <li key={item.href}>
                <Link className="underline-offset-4 hover:text-ink hover:underline" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a className="underline-offset-4 hover:text-ink hover:underline" href={`mailto:${email}`}>
                {email}
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line px-4 py-4 text-center text-xs">
        <p>© {new Date().getFullYear()} Scars to Stars Media LLC. stsmedia.co</p>
        <a href="#main" className="mt-2 inline-block min-h-11 underline-offset-4 hover:underline">
          Back to top
        </a>
      </div>
    </footer>
  );
}
