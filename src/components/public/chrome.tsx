"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui";
import { ownersMenu, publicFooterGroups, publicNav } from "@/lib/nav";

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const panel = panelRef.current;

    function onTab(event: KeyboardEvent) {
      if (event.key !== "Tab" || !panel) return;
      const nodes = [...panel.querySelectorAll<HTMLElement>("a, button")].filter((el) => !el.hasAttribute("disabled"));
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

    window.addEventListener("keydown", onTab);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onTab);
    };
  }, [open]);

  return (
    <header className="public-header sticky top-0 z-40">
      <div className="gold-rule" aria-hidden="true" />
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-4 md:px-8">
        <Logo invert />
        <nav className="hidden items-center gap-7 text-sm text-[#B8BDBA] lg:flex" aria-label="Primary">
          {publicNav.map((item) =>
            item.href === "/for/owners" ? (
              <OwnersDropdown key={item.href} pathname={pathname} />
            ) : (
              <NavLink key={item.href} href={item.href} label={item.label} pathname={pathname} />
            ),
          )}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Button href="/contact" size="sm">
            Start a Project
          </Button>
        </div>
        <button
          className="rounded-md p-2 text-[#F3EFE7] lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
      </div>
      {open ? (
        <div
          ref={panelRef}
          id={menuId}
          className="public-mobile-nav lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <button
            ref={closeRef}
            className="absolute right-4 top-4 rounded-md p-2 text-[#F3EFE7]"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X aria-hidden />
          </button>
          <nav className="flex flex-1 flex-col justify-center gap-1" aria-label="Mobile">
            {publicNav.map((item) => (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className="public-display block py-2 text-4xl text-[#F3EFE7]"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
                {item.href === "/for/owners"
                  ? ownersMenu
                      .filter((entry) => entry.href !== "/for/owners")
                      .map((entry) => (
                        <Link
                          key={entry.href}
                          className="block py-1 pl-1 text-sm uppercase tracking-[0.18em] text-[#B8BDBA]"
                          href={entry.href}
                          onClick={() => setOpen(false)}
                        >
                          {entry.label}
                        </Link>
                      ))
                  : null}
              </div>
            ))}
          </nav>
          <Button href="/contact" size="lg" className="mt-6 w-full">
            Start a Project
          </Button>
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
      className="underline-offset-4 transition hover:text-[#C7FF3D]"
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
        className="inline-flex items-center gap-1 bg-transparent p-0 text-inherit underline-offset-4 transition hover:text-[#C7FF3D]"
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
          className="absolute left-0 top-full z-50 mt-3 min-w-52 rounded-lg border border-white/10 bg-[#0B0D0C] p-1 shadow-[0_18px_40px_rgb(0_0_0_/_0.35)]"
        >
          {ownersMenu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className="block rounded-md px-3 py-2 text-[#F3EFE7] hover:bg-white/10 hover:text-[#C7FF3D]"
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

export function PublicFooter({
  email,
  statement,
  instagram,
  linkedin,
}: {
  email: string;
  statement: string;
  instagram?: string;
  linkedin?: string;
}) {
  return (
    <footer className="border-t border-white/10 bg-[#0B0D0C] text-[#B8BDBA]">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-14 md:px-8 lg:grid-cols-[1.2fr_2fr]">
        <div>
          <Logo invert />
          <p className="mt-4 max-w-sm text-sm leading-6">{statement}</p>
          <div className="mt-6 space-y-2 text-sm">
            <a className="block hover:text-[#C7FF3D]" href={`mailto:${email}`}>
              {email}
            </a>
            {instagram ? (
              <a className="block hover:text-[#C7FF3D]" href={instagram}>
                Instagram
              </a>
            ) : null}
            {linkedin ? (
              <a className="block hover:text-[#C7FF3D]" href={linkedin}>
                LinkedIn
              </a>
            ) : null}
          </div>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {publicFooterGroups.map((group) => (
            <nav key={group.label} aria-label={group.label}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C7FF3D]">{group.label}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {group.links.map((item) => (
                  <li key={item.href}>
                    <Link className="underline-offset-4 hover:text-[#F3EFE7] hover:underline" href={item.href}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs md:px-8">
        © {new Date().getFullYear()} Scars to Stars Media. stsmedia.co
      </div>
    </footer>
  );
}
