"use client";

import { Button } from "@/components/ui";

export function PrintToolbar({
  backHref,
  backLabel,
}: {
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="no-print mb-6 flex flex-wrap items-center gap-3">
      <Button type="button" onClick={() => window.print()}>
        Print / Save as PDF
      </Button>
      <Button href={backHref} variant="secondary" size="sm">
        {backLabel}
      </Button>
      <p className="w-full text-xs text-muted">
        Uses the browser print dialog. The file is not uploaded or stored. This page is not a public document URL.
      </p>
    </div>
  );
}
