"use client";

import { Button } from "@/components/ui";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-card p-6">
      <h2 className="text-lg font-semibold">This page could not be loaded</h2>
      <p className="mt-2 text-sm text-muted">
        The dashboard hit an unexpected error. Details are not shown here so database and auth internals stay private.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-muted">Reference {error.digest}</p> : null}
      <Button type="button" className="mt-4" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
