"use client";

import { useActionState } from "react";
import { publishClientPortalRecordForm, unpublishClientPortalRecordForm } from "@/app/actions";
import { Button } from "@/components/ui";
import type { ClientPortalSourceType, ClientPortalVisibility } from "@/lib/org/client-portal-model";

type State = { error?: string; ok?: boolean };

async function publishAction(_prev: State, formData: FormData): Promise<State> {
  return (await publishClientPortalRecordForm(formData)) ?? { ok: true };
}

async function unpublishAction(_prev: State, formData: FormData): Promise<State> {
  return (await unpublishClientPortalRecordForm(formData)) ?? { ok: true };
}

export function ClientPortalPublishControls({
  sourceType,
  visibility,
}: {
  sourceType: ClientPortalSourceType;
  visibility: ClientPortalVisibility;
}) {
  const [publishState, publishFormAction, publishPending] = useActionState(publishAction, {});
  const [unpublishState, unpublishFormAction, unpublishPending] = useActionState(unpublishAction, {});
  const label = visibility.clientBusinessName || "this client";
  return (
    <div className="mt-4 rounded-md border border-line bg-canvas/60 p-3 text-sm">
      <p className="font-medium">Client portal visibility</p>
      <p className="mt-1 text-xs text-muted">
        {visibility.published
          ? `Currently visible to ${label}.`
          : `Not visible in the client portal.`}
      </p>
      {visibility.archived ? (
        <p className="mt-2 text-xs text-muted">Archived records cannot be newly published.</p>
      ) : null}
      {!visibility.mappingActive ? (
        <p className="mt-2 text-xs text-muted">
          Link an active client portal mapping for {label} before publishing. Publishing one record does not expose related internal records.
        </p>
      ) : null}
      {visibility.published ? (
        <form action={unpublishFormAction} className="mt-3">
          <input type="hidden" name="sourceType" value={sourceType} />
          <input type="hidden" name="sourceId" value={visibility.sourceId} />
          <Button type="submit" size="sm" variant="secondary" disabled={unpublishPending}>
            {unpublishPending ? "Unpublishing…" : "Unpublish"}
          </Button>
        </form>
      ) : (
        <form action={publishFormAction} className="mt-3 grid gap-2">
          <input type="hidden" name="sourceType" value={sourceType} />
          <input type="hidden" name="sourceId" value={visibility.sourceId} />
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" name="confirmClient" value="1" required disabled={!visibility.canPublish} />
            <span>Confirm publish to {label}. Related estimates, invoices, projects, and documents stay unpublished unless chosen separately.</span>
          </label>
          <Button type="submit" size="sm" disabled={!visibility.canPublish || publishPending}>
            {publishPending ? "Publishing…" : `Publish to ${label}`}
          </Button>
        </form>
      )}
      {publishState.error || unpublishState.error ? (
        <p className="mt-2 text-xs text-danger" role="alert">
          {publishState.error || unpublishState.error}
        </p>
      ) : null}
    </div>
  );
}
