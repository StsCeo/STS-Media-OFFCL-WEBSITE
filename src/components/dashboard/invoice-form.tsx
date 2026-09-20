"use client";

import { useActionState, useMemo, useState } from "react";
import {
  archiveInvoiceForm,
  issueInvoiceForm,
  recordInvoicePaymentForm,
  saveInvoiceForm,
  voidInvoiceForm,
} from "@/app/actions";
import { Button, inputClass, textareaClass } from "@/components/ui";
import { centsToDollars, formatCents } from "@/lib/money";
import { computeInvoiceTotals } from "@/lib/org/workspace-model";
import type { ClientRecord, WorkspaceInvoice } from "@/lib/types";

type State = { error?: string; ok?: boolean };
type LineDraft = { description: string; quantity: string; unit: string };

async function saveAction(_prev: State, formData: FormData): Promise<State> {
  return (await saveInvoiceForm(formData)) ?? { ok: true };
}

function wrap(action: (formData: FormData) => Promise<State | void>) {
  return async (_prev: State, formData: FormData): Promise<State> => (await action(formData)) ?? { ok: true };
}

const issueAction = wrap(issueInvoiceForm);
const payAction = wrap(recordInvoicePaymentForm);
const voidAction = wrap(voidInvoiceForm);
const archiveAction = wrap(archiveInvoiceForm);

function linesFromInvoice(invoice?: WorkspaceInvoice): LineDraft[] {
  if (!invoice?.lines.length) return [{ description: "", quantity: "1", unit: "0.00" }];
  return invoice.lines.map((line) => ({
    description: line.description,
    quantity: String(line.quantity),
    unit: centsToDollars(line.unitCents).toFixed(2),
  }));
}

export function InvoiceForm({
  invoice,
  clients,
}: {
  invoice?: WorkspaceInvoice;
  clients: Pick<ClientRecord, "id" | "businessName">[];
}) {
  const [state, formAction, pending] = useActionState(saveAction, {});
  const [issueState, issueFormAction, issuePending] = useActionState(issueAction, {});
  const [payState, payFormAction, payPending] = useActionState(payAction, {});
  const [voidState, voidFormAction, voidPending] = useActionState(voidAction, {});
  const [archiveState, archiveFormAction, archivePending] = useActionState(archiveAction, {});
  const [lines, setLines] = useState<LineDraft[]>(() => linesFromInvoice(invoice));
  const [discount, setDiscount] = useState(invoice ? centsToDollars(invoice.discountCents).toFixed(2) : "0");
  const [tax, setTax] = useState(invoice ? centsToDollars(invoice.taxCents).toFixed(2) : "0");
  const preview = useMemo(
    () =>
      computeInvoiceTotals(
        lines.map((line) => ({
          quantity: Number(line.quantity) || 0,
          unitCents: Math.round(Number(line.unit || 0) * 100),
        })),
        Math.round(Number(discount || 0) * 100),
        Math.round(Number(tax || 0) * 100),
      ),
    [lines, discount, tax],
  );
  const locked = Boolean(invoice && invoice.status !== "draft");

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-3 md:grid-cols-2">
        {invoice ? <input type="hidden" name="id" value={invoice.id} /> : null}
        <select name="clientId" className={inputClass} defaultValue={invoice?.clientId ?? ""} disabled={locked} required={false}>
          <option value="">Select client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.businessName}</option>
          ))}
        </select>
        <input name="currency" className={inputClass} defaultValue={invoice?.currency || "USD"} maxLength={3} disabled={locked} />
        <input name="issueDate" type="date" className={inputClass} defaultValue={invoice?.issueDate ?? ""} disabled={locked} />
        <input name="dueDate" type="date" className={inputClass} defaultValue={invoice?.dueDate ?? ""} disabled={locked} />
        <textarea name="notes" maxLength={4000} className={`${textareaClass} md:col-span-2`} placeholder="Internal notes" defaultValue={invoice?.notes} disabled={locked} />
        <textarea name="paymentInstructions" maxLength={2000} className={`${textareaClass} md:col-span-2`} placeholder="Payment instructions (recorded only; nothing is emailed)" defaultValue={invoice?.paymentInstructions} disabled={locked} />
        <div className="md:col-span-2 grid gap-3">
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[2fr_1fr_1fr]">
              <input
                name="lineDescription"
                className={inputClass}
                placeholder="Line description"
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
                value={line.unit}
                disabled={locked}
                onChange={(event) => {
                  const next = [...lines];
                  next[index] = { ...next[index], unit: event.target.value };
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
              onClick={() => setLines([...lines, { description: "", quantity: "1", unit: "0.00" }])}
            >
              Add line
            </Button>
          )}
        </div>
        <input name="discount" className={inputClass} value={discount} disabled={locked} onChange={(event) => setDiscount(event.target.value)} placeholder="Discount" />
        <input name="tax" className={inputClass} value={tax} disabled={locked} onChange={(event) => setTax(event.target.value)} placeholder="Tax" />
        <p className="md:col-span-2 text-sm text-muted">
          Preview only: subtotal {formatCents(preview.subtotalCents)}, total {formatCents(preview.totalCents)}. The server recalculates and stores the authoritative totals.
        </p>
        {state.error ? <p className="md:col-span-2 text-sm text-danger" role="alert">{state.error}</p> : null}
        {locked ? null : <Button type="submit" disabled={pending}>{pending ? "Saving…" : invoice ? "Update draft" : "Save draft"}</Button>}
      </form>
      {invoice ? (
        <div className="flex flex-wrap gap-2">
          {invoice.status === "draft" ? (
            <form action={issueFormAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <Button type="submit" size="sm" disabled={issuePending}>{issuePending ? "Issuing…" : "Record issued"}</Button>
              {issueState.error ? <p className="mt-2 text-sm text-danger">{issueState.error}</p> : null}
            </form>
          ) : null}
          {invoice.status === "issued" ? (
            <form action={payFormAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <Button type="submit" size="sm" disabled={payPending}>{payPending ? "Recording…" : "Record payment"}</Button>
              {payState.error ? <p className="mt-2 text-sm text-danger">{payState.error}</p> : null}
            </form>
          ) : null}
          {invoice.status === "draft" || invoice.status === "issued" ? (
            <form action={voidFormAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <Button type="submit" size="sm" variant="secondary" disabled={voidPending}>{voidPending ? "Voiding…" : "Void"}</Button>
              {voidState.error ? <p className="mt-2 text-sm text-danger">{voidState.error}</p> : null}
            </form>
          ) : null}
          <form action={archiveFormAction}>
            <input type="hidden" name="id" value={invoice.id} />
            <Button type="submit" size="sm" variant="secondary" disabled={archivePending}>{archivePending ? "Archiving…" : "Archive"}</Button>
            {archiveState.error ? <p className="mt-2 text-sm text-danger">{archiveState.error}</p> : null}
          </form>
          <Button href={`/dashboard/invoices/${invoice.id}/print`} size="sm" variant="secondary">Print view</Button>
        </div>
      ) : null}
    </div>
  );
}
