"use client";

import { useActionState } from "react";
import { reconcileScheduleForm } from "@/app/actions";
import { Button } from "@/components/ui";

type State = { error?: string; ok?: boolean };

async function reconcileAction(_prev: State, formData: FormData): Promise<State> {
  return (await reconcileScheduleForm(formData)) ?? { ok: true };
}

export function ReconcileScheduleForm() {
  const [state, formAction, pending] = useActionState(reconcileAction, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Reconciling…" : "Reconcile schedule"}
      </Button>
      {state.error ? <p className="text-sm text-danger" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-muted">Generated entries were reconciled. No external calendar was contacted.</p> : null}
    </form>
  );
}
