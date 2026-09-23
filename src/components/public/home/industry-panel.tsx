"use client";

import { useState } from "react";
import { homeIndustries } from "@/lib/content/home";
import { trackPublic } from "@/lib/analytics/public-events";

export function IndustryPanel() {
  const [id, setId] = useState<(typeof homeIndustries)[number]["id"]>("auto");
  const current = homeIndustries.find((item) => item.id === id) ?? homeIndustries[0];

  return (
    <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
      <div role="tablist" aria-label="Industries" className="flex flex-col gap-1">
        {homeIndustries.map((item) => {
          const selected = item.id === current.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`min-h-11 rounded-md px-3 py-2 text-left text-sm font-medium ${
                selected ? "bg-lavender text-ink" : "text-muted hover:text-ink"
              }`}
              onClick={() => {
                setId(item.id);
                trackPublic("industry_selector", { industry: item.id });
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="accent-edge" aria-live="polite">
        <p className="public-kicker">{current.label}</p>
        <h3 className="mt-3 text-lg font-semibold tracking-tight">The usual problem</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{current.problem}</p>
        <h3 className="mt-5 text-lg font-semibold tracking-tight">What we build</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{current.solution}</p>
        <p className="mt-4 text-sm leading-6">{current.outcome}</p>
        <p className="mt-3 text-sm text-muted">Related work: {current.service}</p>
      </div>
    </div>
  );
}
