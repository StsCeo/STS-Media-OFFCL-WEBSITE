"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui";
import { publicNav } from "@/lib/nav";

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-obsidian/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Logo invert />
        <nav className="hidden items-center gap-6 text-sm text-soft-gray lg:flex">
          {publicNav.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-ivory">
              {item.label}
            </Link>
          ))}
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
          aria-label="Open menu"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-white/10 px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-3 text-ivory">
            {publicNav.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <Button href="/contact">Start a Project</Button>
            <Button href="/login" variant="gold">
              Command Center
            </Button>
          </div>
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
          <p className="mt-4 max-w-md text-sm">{statement}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold">Visit</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/work">Work</Link></li>
            <li><Link href="/services">Services</Link></li>
            <li><Link href="/packages">Packages</Link></li>
            <li><Link href="/contact">Book a call</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold">Trust</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/legal/privacy">Privacy</Link></li>
            <li><Link href="/legal/terms">Terms</Link></li>
            <li><Link href="/legal/cookies">Cookies</Link></li>
            <li><Link href="/legal/accessibility">Accessibility</Link></li>
            <li><Link href="/legal/client-portal">Client portal terms</Link></li>
            <li><a href={`mailto:${email}`}>{email}</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs">
        © {new Date().getFullYear()} Scars to Stars Media. stsmedia.co
      </div>
    </footer>
  );
}
