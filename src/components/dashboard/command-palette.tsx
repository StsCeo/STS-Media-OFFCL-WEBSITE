"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { dashboardNav, publicNav } from "@/lib/nav";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const items = useMemo(() => {
    const all = [
      ...dashboardNav.map((item) => ({ href: item.href, label: item.label, group: "Command Center" })),
      ...publicNav.map((item) => ({ href: item.href, label: item.label, group: "Public site" })),
      { href: "/dashboard/settings/security", label: "Security", group: "Command Center" },
      { href: "/dashboard/settings/brand", label: "Brand settings", group: "Command Center" },
      { href: "/lookbook", label: "Color lookbook", group: "Public site" },
      { href: "/faq", label: "FAQ", group: "Public site" },
      { href: "/security", label: "Security practices", group: "Public site" },
      { href: "/resources", label: "Resources", group: "Public site" },
      { href: "/portal", label: "Client portal preview", group: "Public site" },
    ];
    const q = query.toLowerCase();
    return all.filter((item) => item.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("sts:open-command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("sts:open-command", onOpen);
    };
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/40 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-lg border border-line bg-card p-3 shadow-[var(--shadow-card)]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Go to…"
          className="h-10 w-full rounded-md border border-line px-3 text-sm"
        />
        <ul className="mt-2 max-h-72 overflow-y-auto text-sm">
          {items.map((item) => (
            <li key={item.href}>
              <button
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover:bg-canvas"
                onClick={() => {
                  setOpen(false);
                  router.push(item.href);
                }}
              >
                <span>{item.label}</span>
                <span className="text-xs text-muted">{item.group}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
