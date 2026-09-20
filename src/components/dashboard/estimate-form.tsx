"use client";

import { useActionState, useMemo, useState } from "react";
import {
  archiveEstimateForm,
  restoreEstimateForm,
  saveEstimateForm,
  setEstimateStatusForm,
} from "@/app/actions";
import { Button, Field, inputClass, textareaClass } from "@/components/ui";
import { centsToDollars, formatCents } from "@/lib/money";
import { computeEstimateTotals } from "@/lib/org/estimates-model";
import type { ClientRecord, WorkspaceEstimate } from "@/lib/types";

type State = { error?: string; ok?: boolean };
type LineDraft = { description: string; quantity: string; unit: string; discount: string };

async function saveAction(_prev: State, formData: FormData): Promise<State> {
  return (await saveEstimateForm(formData)) ?? { ok: true };
}

function wrap(action: (formData: FormData) => Promise<State | void>) {
  return async (_prev: State, formData: FormData): Promise<State> => (await action(formData)) ?? { ok: true };
}

const statusAction = wrap(setEstimateStatusForm);
const archiveAction = wrap(archiveEstimateForm);
const restoreAction = wrap(restoreEstimateForm);

function linesFromEstimate(estimate?: WorkspaceEstimate): LineDraft[] {
  if (!estimate?.lines.length) return [{ description: "", quantity: "1", unit: "0.00", discount: "0.00" }];
  return estimate.lines.map((line) => ({
    description: line.description,
    quantity: String(line.quantity),
    unit: centsToDollars(line.unitCents).toFixed(2),
    discount: centsToDollars(line.discountCents).toFixed(2),
  }));
}

export function EstimateForm({
  estimate,
  clients,
}: {
  estimate?: WorkspaceEstimate;
  clients: Pick<ClientRecord, "id" | "businessName">[];
}) {
  const [state, formAction, pending] = useActionState(saveAction, {});
  const [statusState, statusFormAction, statusPending] = useActionState(statusAction, {});
  const [archiveState, archiveFormAction, archivePending] = useActionState(archiveAction, {});
  const [restoreState, restoreFormAction, restorePending] = useActionState(restoreAction, {});
  const [lines, setLines] = useState<LineDraft[]>(() => linesFromEstimate(estimate));
  const [tax, setTax] = useState(estimate ? centsToDollars(estimate.taxCents).toFixed(2) : "0");
  const preview = useMemo(
    () =>
      computeEstimateTotals(
        lines.map((line) => ({
          quantity: Number(line.quantity) || 0,
          unitCents: Math.round(Number(line.unit || 0) * 100),
          discountCents: Math.round(Number(line.discount || 0) * 100),
        })),
        Math.round(Number(tax || 0) * 100),
      ),
    [lines, tax],
  );
  const locked = Boolean(estimate && (estimate.status !== "draft" || estimate.archived));

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-3 md:grid-cols-2">
        {estimate ? <input type="hidden" name="id" value={estimate.id} /> : null}
        <Field label="Title" name="title" hint="Internal working title for this quote.">
          <input id="title" name="title" className={inputClass} defaultValue={estimate?.title ?? ""} required minLength={2} maxLength={160} disabled={locked} />
        </Field>
        <Field label="Estimate number" name="estimateNumber" hint="Assigned by the organization. Prefix changes apply to new estimates only.">
          <input id="estimateNumber" className={inputClass} value={estimate?.estimateNumber ?? "Assigned on save"} readOnly aria-readonly="true" />
        </Field>
        <Field label="Client" name="clientId" hint="Optional. Must belong to this organization.">
          <select id="clientId" name="clientId" className={inputClass} defaultValue={estimate?.clientId ?? ""} disabled={locked}>
            <option value="">No client assigned</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.businessName}</option>
            ))}
          </select>
        </Field>
        <Field label="Currency" name="currency">
          <input id="currency" name="currency" className={inputClass} defaultValue={estimate?.currency || "USD"} maxLength={3} disabled={locked} />
        </Field>
        <Field label="Issue date" name="issueDate">
          <input id="issueDate" name="issueDate" type="date" className={inputClass} defaultValue={estimate?.issueDate ?? ""} disabled={locked} />
        </Field>
        <Field label="Expiration date" name="expiresOn" hint="Optional. Ready estimates past this date display as expired.">
          <input id="expiresOn" name="expiresOn" type="date" className={inputClass} defaultValue={estimate?.expiresOn ?? ""} disabled={locked} />
        </Field>
        <Field label="Customer business name" name="clientBusinessName">
          <input id="clientBusinessName" name="clientBusinessName" className={inputClass} defaultValue={estimate?.clientBusinessName ?? ""} maxLength={160} disabled={locked} />
        </Field>
        <Field label="Customer contact" name="clientContactName">
          <input id="clientContactName" name="clientContactName" className={inputClass} defaultValue={estimate?.clientContactName ?? ""} maxLength={160} disabled={locked} />
        </Field>
        <Field label="Customer email snapshot" name="clientEmail" hint="Stored on the estimate. Nothing is emailed.">
          <input id="clientEmail" name="clientEmail" type="email" className={inputClass} defaultValue={estimate?.clientEmail ?? ""} maxLength={254} disabled={locked} />
        </Field>
        <Field label="Description" name="description">
          <textarea id="description" name="description" maxLength={4000} className={textareaClass} defaultValue={estimate?.description} disabled={locked} />
        </Field>
        <Field label="Internal notes" name="internalNotes">
          <textarea id="internalNotes" name="internalNotes" maxLength={4000} className={textareaClass} defaultValue={estimate?.internalNotes} disabled={locked} />
        </Field>
        <Field label="Customer-facing notes" name="customerNotes" hint="Recorded on the quote. Not sent.">
          <textarea id="customerNotes" name="customerNotes" maxLength={4000} className={`${textareaClass} md:col-span-2`} defaultValue={estimate?.customerNotes} disabled={locked} />
        </Field>
        <Field label="Terms" name="terms">
          <textarea id="terms" name="terms" maxLength={4000} className={`${textareaClass} md:col-span-2`} defaultValue={estimate?.terms} disabled={locked} />
        </Field>
        <fieldset className="md:col-span-2 grid gap-3">
          <legend className="font-medium">Line items</legend>
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr]">
              <input
                name="lineDescription"
                className={inputClass}
                placeholder="Description"
                aria-label={`Line ${index + 1} description`}
                value={line.description}
                disabled={locked}
                onChange={(event) => {
                  const next = [...lines];
                  next[index] = { ...next[index], description: event.target.value };
                  setLines(next);
                }}
              />
              <input
                name="lineQuantity"
                className={inputClass}
                type="number"
                min={1}
                max={9999}
                aria-label={`Line ${index + 1} quantity`}
                value={line.quantity}
                disabled={locked}
                onChange={(event) => {
                  const next = [...lines];
                  next[index] = { ...next[index], quantity: event.target.value };
                  setLines(next);
                }}
              />
              <input
                name="lineUnit"
                className={inputClass}
                inputMode="decimal"
                placeholder="Unit price"
                aria-label={`Line ${index + 1} unit price`}
                value={line.unit}
                disabled={locked}
                onChange={(event) => {
                  const next = [...lines];
                  next[index] = { ...next[index], unit: event.target.value };
                  setLines(next);
                }}
              />
              <input
                name="lineDiscount"
                className={inputClass}
                inputMode="decimal"
                placeholder="Discount"
                aria-label={`Line ${index + 1} discount`}
                value={line.discount}
                disabled={locked}
                onChange={(event) => {
                  const next = [...lines];
                  next[index] = { ...next[index], discount: event.target.value };
                  setLines(next);
                }}
              />
            </div>
          ))}
          {locked ? null : (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setLines([...lines, { description: "", quantity: "1", unit: "0.00", discount: "0.00" }])}
            >
              Add line
            </Button>
          )}
        </fieldset>
        <Field label="Tax amount" name="tax" hint="Integer cents stored after conversion. Browser totals are preview only.">
          <input id="tax" name="tax" className={inputClass} value={tax} disabled={locked} onChange={(event) => setTax(event.target.value)} />
        </Field>
        <p className="md:col-span-2 text-sm text-muted">
          Preview only: subtotal {formatCents(preview.subtotalCents)}, discount {formatCents(preview.discountCents)}, tax {formatCents(preview.taxCents)}, total {formatCents(preview.totalCents)}. The server recalculates and stores the authoritative totals.
        </p>
        {state.error ? <p className="md:col-span-2 text-sm text-danger" role="alert">{state.error}</p> : null}
        {state.ok ? <p className="md:col-span-2 text-sm text-success" role="status">Estimate saved.</p> : null}
        {locked ? null : (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : estimate ? "Update draft" : "Save draft"}
          </Button>
        )}
      </form>
      {estimate ? (
        <div className="flex flex-wrap gap-2">
          {estimate.archived ? (
            <form action={restoreFormAction}>
              <input type="hidden" name="id" value={estimate.id} />
              <Button type="submit" size="sm" disabled={restorePending}>{restorePending ? "Restoring…" : "Restore"}</Button>
              {restoreState.error ? <p className="mt-2 text-sm text-danger" role="alert">{restoreState.error}</p> : null}
              {restoreState.ok ? <p className="mt-2 text-sm text-success" role="status">Estimate restored.</p> : null}
            </form>
          ) : (
            <>
              {estimate.status === "draft" ? (
                <form action={statusFormAction}>
                  <input type="hidden" name="id" value={estimate.id} />
                  <input type="hidden" name="status" value="ready" />
                  <Button type="submit" size="sm" disabled={statusPending}>{statusPending ? "Updating…" : "Mark ready"}</Button>
                </form>
              ) : null}
              {estimate.status === "ready" ? (
                <>
                  <form action={statusFormAction}>
                    <input type="hidden" name="id" value={estimate.id} />
                    <input type="hidden" name="status" value="accepted" />
                    <Button type="submit" size="sm" disabled={statusPending}>Record accepted</Button>
                  </form>
                  <form action={statusFormAction}>
                    <input type="hidden" name="id" value={estimate.id} />
                    <input type="hidden" name="status" value="declined" />
                    <Button type="submit" size="sm" variant="secondary" disabled={statusPending}>Record declined</Button>
                  </form>
                  <form action={statusFormAction}>
                    <input type="hidden" name="id" value={estimate.id} />
                    <input type="hidden" name="status" value="expired" />
                    <Button type="submit" size="sm" variant="secondary" disabled={statusPending}>Record expired</Button>
                  </form>
                  <form action={statusFormAction}>
                    <input type="hidden" name="id" value={estimate.id} />
                    <input type="hidden" name="status" value="draft" />
                    <Button type="submit" size="sm" variant="secondary" disabled={statusPending}>Return to draft</Button>
                  </form>
                </>
              ) : null}
              <form action={archiveFormAction}>
                <input type="hidden" name="id" value={estimate.id} />
                <Button type="submit" size="sm" variant="secondary" disabled={archivePending}>{archivePending ? "Archiving…" : "Archive"}</Button>
              </form>
            </>
          )}
          {statusState.error ? <p className="w-full text-sm text-danger" role="alert">{statusState.error}</p> : null}
          {statusState.ok ? <p className="w-full text-sm text-success" role="status">Status updated. No email or PDF was created.</p> : null}
          {archiveState.error ? <p className="w-full text-sm text-danger" role="alert">{archiveState.error}</p> : null}
          {archiveState.ok ? <p className="w-full text-sm text-success" role="status">Estimate archived.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
