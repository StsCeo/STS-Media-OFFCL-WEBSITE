"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui";
import { publicFooterAudience, publicFooterTrust, publicFooterVisit, publicNav } from "@/lib/nav";

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-obsidian/85 backdrop-blur">
      <div className="gold-rule" aria-hidden="true" />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Logo invert />
        <nav className="hidden items-center gap-6 text-sm text-soft-gray lg:flex" aria-label="Primary">
          {publicNav.map((item) => {
            const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="underline-offset-4 transition hover:text-ivory hover:underline"
                aria-current={current ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Button href="/login" variant="gold" size="sm">
            Command Center
          </Button>
          <Button href="/contact" size="sm">
            Start a Project
          </Button>
        </div>
        <button
          className="rounded-md p-2 text-ivory lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
      </div>
      {open ? (
        <div id={menuId} className="border-t border-white/10 px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-3 text-ivory" aria-label="Mobile">
            {publicNav.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <Button href="/contact">Start a Project</Button>
            <Button href="/login" variant="gold">
              Command Center
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function PublicFooter({ email, statement }: { email: string; statement: string }) {
  return (
    <footer className="border-t border-white/10 bg-obsidian text-soft-gray">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo invert />
          <p className="mt-4 max-w-md text-sm leading-6">{statement}</p>
          <p className="mt-3 text-xs">Built for business owners and creators who already did the hard part.</p>
        </div>
        <nav aria-label="Visit">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">Visit</p>
          <ul className="mt-3 space-y-2 text-sm">
            {publicFooterVisit.map((item) => (
              <li key={item.href}>
                <Link className="underline-offset-4 hover:text-ivory hover:underline" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Trust">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">Trust</p>
          <ul className="mt-3 space-y-2 text-sm">
            {publicFooterAudience.map((item) => (
              <li key={item.href}>
                <Link className="underline-offset-4 hover:text-ivory hover:underline" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
            {publicFooterTrust.map((item) => (
              <li key={item.href}>
                <Link className="underline-offset-4 hover:text-ivory hover:underline" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a className="underline-offset-4 hover:text-ivory hover:underline" href={`mailto:${email}`}>
                {email}
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs">
        © {new Date().getFullYear()} Scars to Stars Media. stsmedia.co
      </div>
    </footer>
  );
}
