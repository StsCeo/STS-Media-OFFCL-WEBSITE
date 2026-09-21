"use client";

import { useActionState } from "react";
import { disableClientPortalIdentityForm, linkClientPortalIdentityForm } from "@/app/actions";
import { Badge, Button, Card, inputClass } from "@/components/ui";
import type { ClientPortalCandidate, ClientPortalIdentity, ClientPortalPublication } from "@/lib/org/client-portal-model";
import type { ClientRecord } from "@/lib/types";

type State = { error?: string; ok?: boolean };

async function linkAction(_prev: State, formData: FormData): Promise<State> {
  return (await linkClientPortalIdentityForm(formData)) ?? { ok: true };
}

async function disableAction(_prev: State, formData: FormData): Promise<State> {
  return (await disableClientPortalIdentityForm(formData)) ?? { ok: true };
}

export function ClientPortalOwnerForms({
  identities,
  candidates,
  clients,
  publications,
}: {
  identities: ClientPortalIdentity[];
  candidates: ClientPortalCandidate[];
  clients: Pick<ClientRecord, "id" | "businessName">[];
  publications: ClientPortalPublication[];
}) {
  const [linkState, linkFormAction, linkPending] = useActionState(linkAction, {});
  const [disableState, disableFormAction, disablePending] = useActionState(disableAction, {});
  const unmapped = candidates.filter((candidate) => !candidate.mapped);
  const activeClients = clients.filter((client) => !identities.some((identity) => identity.crmClientId === client.id && identity.status === "active"));
  return (
    <div className="grid gap-6">
      <Card>
        <h2 className="mb-3 font-semibold">Link a client user</h2>
        <p className="mb-4 text-sm text-muted">
          Only existing client-role members can be linked. This form does not send invitations or create production clients.
        </p>
        {unmapped.length === 0 || activeClients.length === 0 ? (
          <p className="text-sm text-muted">No unmapped client-role member and active CRM client pair is available.</p>
        ) : (
          <form action={linkFormAction} className="grid gap-3 md:grid-cols-2">
            <select name="userId" className={inputClass} required defaultValue="">
              <option value="">Select client user</option>
              {unmapped.map((candidate) => (
                <option key={candidate.userId} value={candidate.userId}>{candidate.userEmail}</option>
              ))}
            </select>
            <select name="crmClientId" className={inputClass} required defaultValue="">
              <option value="">Select CRM client</option>
              {activeClients.map((client) => (
                <option key={client.id} value={client.id}>{client.businessName}</option>
              ))}
            </select>
            <div className="md:col-span-2">
              <Button type="submit" disabled={linkPending}>{linkPending ? "Linking…" : "Link mapping"}</Button>
            </div>
          </form>
        )}
        {linkState.error ? <p className="mt-3 text-sm text-danger" role="alert">{linkState.error}</p> : null}
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Active and disabled mappings</h2>
        {identities.length === 0 ? (
          <p className="text-sm text-muted">No client portal mappings yet.</p>
        ) : (
          <div className="grid gap-3">
            {identities.map((identity) => (
              <div key={identity.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3">
                <div>
                  <p className="font-medium">{identity.clientBusinessName}</p>
                  <p className="text-xs text-muted">{identity.userEmail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={identity.status === "active" ? "success" : "warning"}>{identity.status}</Badge>
                  {identity.status === "active" ? (
                    <form action={disableFormAction}>
                      <input type="hidden" name="identityId" value={identity.id} />
                      <Button type="submit" size="sm" variant="secondary" disabled={disablePending}>Disable</Button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
        {disableState.error ? <p className="mt-3 text-sm text-danger" role="alert">{disableState.error}</p> : null}
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Publication log</h2>
        {publications.length === 0 ? (
          <p className="text-sm text-muted">No publications yet. Use the publish controls on estimates, invoices, projects, and documents.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {publications.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 py-2">
                <span>{row.sourceType} · {row.clientBusinessName}</span>
                <Badge tone={row.published ? "success" : "neutral"}>{row.published ? "visible" : "unpublished"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
