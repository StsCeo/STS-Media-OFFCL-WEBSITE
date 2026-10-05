"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import type { AgendaBucket, AgendaItem } from "@/lib/org/command-center";

const tabs: { id: AgendaBucket; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue", label: "Overdue" },
];

export function OperationalAgenda({ items }: { items: AgendaItem[] }) {
  const [tab, setTab] = useState<AgendaBucket>("today");
  const visible = items.filter((item) => item.bucket === tab);
  const empty = {
    today: { title: "Nothing due today", body: "No invoices, follow-ups, tasks, or deadlines land on today." },
    upcoming: { title: "Nothing upcoming", body: "Future follow-ups, invoices, and project deadlines will appear here." },
    overdue: { title: "Nothing overdue", body: "No open tasks, invoices, or deadlines are past due." },
  }[tab];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Operational agenda">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`rounded-md border px-3 py-1.5 text-sm ${tab === item.id ? "border-line bg-card" : "border-transparent text-muted"}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            <span className="ml-2 font-mono">{items.filter((row) => row.bucket === item.id).length}</span>
          </button>
        ))}
      </div>
      {visible.length ? (
        <ul className="space-y-2 text-sm">
          {visible.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="underline-offset-2 hover:underline">
                {item.label}
              </Link>
              <span className="ml-2 text-xs text-muted">{item.date}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={empty.title} body={empty.body} />
      )}
    </div>
  );
}
