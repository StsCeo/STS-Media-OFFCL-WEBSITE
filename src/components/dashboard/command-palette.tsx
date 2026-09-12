"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { dashboardNav, publicNav } from "@/lib/nav";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const labelId = useId();
  const items = useMemo(() => {
    const all = [
      ...dashboardNav.map((item) => ({ href: item.href, label: item.label, group: "Business OS" })),
      { href: "/dashboard/export", label: "Export backup", group: "Business OS" },
      { href: "/dashboard/settings/business", label: "Business profile", group: "Business OS" },
      { href: "/dashboard/team", label: "Owner account", group: "Business OS" },
      ...publicNav.map((item) => ({ href: item.href, label: item.label, group: "Public site" })),
      { href: "/dashboard/settings/security", label: "Security", group: "Command Center" },
      { href: "/dashboard/settings/brand", label: "Brand settings", group: "Command Center" },
      { href: "/login", label: "Owner login", group: "Public site" },
      { href: "/lookbook", label: "Color lookbook", group: "Public site" },
      { href: "/faq", label: "FAQ", group: "Public site" },
      { href: "/accessibility", label: "Accessibility", group: "Public site" },
      { href: "/rights", label: "Your rights", group: "Public site" },
      { href: "/security", label: "Security practices", group: "Public site" },
      { href: "/security/vulnerabilities", label: "Report a vulnerability", group: "Public site" },
      { href: "/resources", label: "Resources", group: "Public site" },
    ];
    const q = query.toLowerCase();
    return all.filter((item) => item.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuery("");
        setActive(0);
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    }
    function onOpen() {
      setQuery("");
      setActive(0);
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
      <div
        className="w-full max-w-lg rounded-lg border border-line bg-card p-3 shadow-[var(--shadow-card)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
      >
        <p id={labelId} className="sr-only">
          Jump to a page
        </p>
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          placeholder="Go to…"
          aria-label="Search pages"
          aria-autocomplete="list"
          className="h-10 w-full rounded-md border border-line px-3 text-sm"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, Math.max(items.length - 1, 0)));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            }
            if (event.key === "Enter" && items[active]) {
              event.preventDefault();
              setOpen(false);
              router.push(items[active].href);
            }
          }}
        />
        <ul className="mt-2 max-h-72 overflow-y-auto text-sm">
          {items.length === 0 ? (
            <li className="px-2 py-2 text-muted">No matching pages.</li>
          ) : (
            items.map((item, index) => (
              <li key={`${item.group}-${item.href}`}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left ${index === active ? "bg-canvas" : "hover:bg-canvas"}`}
                  onClick={() => {
                    setOpen(false);
                    router.push(item.href);
                  }}
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-muted">{item.group}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
