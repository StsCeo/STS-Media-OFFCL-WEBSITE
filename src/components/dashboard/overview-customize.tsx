"use client";

import { useMemo, useState, useTransition } from "react";
import { saveDashboardPreferences } from "@/app/actions";
import { Button } from "@/components/ui";

export const OVERVIEW_CARDS = [
  { id: "attention", label: "Today at STS Media" },
  { id: "quick-actions", label: "Quick actions" },
  { id: "kpis", label: "KPI cards" },
  { id: "charts", label: "Charts" },
  { id: "insights", label: "Recommendations and cash vs profit" },
] as const;

export function OverviewCustomize({ hiddenCards }: { hiddenCards: string[] }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(hiddenCards);
  const [, start] = useTransition();
  const value = useMemo(() => hidden.join(","), [hidden]);

  return (
    <div>
      <Button size="sm" variant="secondary" type="button" onClick={() => setOpen((current) => !current)}>
        Customize cards
      </Button>
      {open ? (
        <form
          className="mt-3 rounded-md border border-line p-3 text-sm"
          action={(formData) => start(() => saveDashboardPreferences(formData))}
        >
          <input type="hidden" name="hiddenCards" value={value} />
          <p className="mb-2 text-muted">Hide sections you do not need today. Order stays as shown.</p>
          {OVERVIEW_CARDS.map((card) => (
            <label key={card.id} className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={!hidden.includes(card.id)}
                onChange={(event) => {
                  setHidden((current) =>
                    event.target.checked ? current.filter((id) => id !== card.id) : [...current, card.id],
                  );
                }}
              />
              {card.label}
            </label>
          ))}
          <Button type="submit" size="sm" className="mt-2">
            Save layout
          </Button>
        </form>
      ) : null}
    </div>
  );
}
