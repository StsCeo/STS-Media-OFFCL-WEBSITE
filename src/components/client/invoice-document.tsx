import { Badge } from "@/components/ui";
import { formatCents } from "@/lib/money";
import type { ClientPortalLine } from "@/lib/org/client-portal-model";

function statusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "paid" || status === "accepted") return "success";
  if (status === "issued" || status === "ready") return "info";
  if (status === "void" || status === "declined" || status === "expired") return "warning";
  if (status === "overdue") return "danger";
  return "neutral";
}

export function ClientInvoiceDocument({
  kind,
  number,
  status,
  orgLegalName,
  orgDisplayName,
  clientBusinessName,
  clientContactName,
  issueDate,
  secondaryDateLabel,
  secondaryDate,
  currency,
  lines,
  subtotalCents,
  discountCents,
  taxCents,
  totalCents,
  customerNotes,
  terms,
  title,
  description,
}: {
  kind: "Estimate" | "Invoice";
  number: string;
  status: string;
  orgLegalName: string;
  orgDisplayName: string;
  clientBusinessName: string;
  clientContactName: string;
  issueDate: string | null;
  secondaryDateLabel: string;
  secondaryDate: string | null;
  currency: string;
  lines: ClientPortalLine[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  customerNotes?: string;
  terms?: string;
  title?: string;
  description?: string;
}) {
  const company = orgDisplayName || orgLegalName || "STS Media";
  return (
    <article className="client-invoice print-document overflow-hidden rounded-xl border border-line bg-card print:border-0">
      <header className="client-invoice-hero px-6 py-6 text-white md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/80">Scars to Stars Media</p>
            <h1 className="mt-1 font-display text-3xl tracking-tight">{company}</h1>
            {orgLegalName && orgLegalName !== company ? <p className="text-sm text-white/90">{orgLegalName}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-white/80">{kind}</p>
            <p className="font-mono text-2xl">{number}</p>
            <div className="mt-2 flex justify-end">
              <Badge tone={statusTone(status)}>{status}</Badge>
            </div>
          </div>
        </div>
      </header>
      <div className="grid gap-6 px-6 py-6 text-sm md:grid-cols-2 md:px-8">
        <section>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">From</p>
          <p className="mt-1 font-medium">{company}</p>
          {orgLegalName && orgLegalName !== company ? <p>{orgLegalName}</p> : null}
        </section>
        <section>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Bill to</p>
          <p className="mt-1 font-medium">{clientBusinessName || "Client"}</p>
          {clientContactName ? <p>{clientContactName}</p> : null}
        </section>
        <section className="md:col-span-2 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-muted">Issue date</p>
            <p className="font-mono">{issueDate || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted">{secondaryDateLabel}</p>
            <p className="font-mono">{secondaryDate || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted">{kind} number</p>
            <p className="font-mono">{number}</p>
          </div>
        </section>
        {title ? (
          <section className="md:col-span-2">
            <p className="text-xs uppercase text-muted">Title</p>
            <p className="font-medium">{title}</p>
            {description ? <p className="mt-2 whitespace-pre-wrap text-muted">{description}</p> : null}
          </section>
        ) : null}
      </div>
      <div className="overflow-x-auto px-6 md:px-8">
        <table className="mb-6 w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">
              <th className="py-2 pr-3">Description</th>
              <th className="py-2 pr-3">Qty</th>
              <th className="py-2 pr-3">Unit</th>
              {kind === "Estimate" ? <th className="py-2 pr-3">Discount</th> : null}
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.length ? (
              lines.map((line) => (
                <tr key={`${line.parentId}-${line.position}`} className="border-b border-line/70">
                  <td className="py-3 pr-3">{line.description}</td>
                  <td className="py-3 pr-3 font-mono">{line.quantity}</td>
                  <td className="py-3 pr-3 font-mono">{formatCents(line.unitCents, currency)}</td>
                  {kind === "Estimate" ? (
                    <td className="py-3 pr-3 font-mono">{formatCents(line.discountCents, currency)}</td>
                  ) : null}
                  <td className="py-3 text-right font-mono">{formatCents(line.lineTotalCents, currency)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-3 text-muted" colSpan={kind === "Estimate" ? 5 : 4}>
                  No line items were published with this {kind.toLowerCase()}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <dl className="mx-6 mb-6 max-w-sm space-y-2 text-sm md:ml-auto md:mr-8">
        <div className="flex justify-between gap-6">
          <dt>Subtotal</dt>
          <dd className="font-mono">{formatCents(subtotalCents, currency)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt>Discount</dt>
          <dd className="font-mono">{formatCents(discountCents, currency)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt>Tax</dt>
          <dd className="font-mono">{formatCents(taxCents, currency)}</dd>
        </div>
        <div className="flex justify-between gap-6 border-t border-line pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd className="font-mono">{formatCents(totalCents, currency)}</dd>
        </div>
      </dl>
      {terms ? (
        <section className="border-t border-line px-6 py-4 text-sm md:px-8">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Terms</p>
          <p className="mt-2 whitespace-pre-wrap">{terms}</p>
        </section>
      ) : null}
      {customerNotes ? (
        <section className="border-t border-line px-6 py-4 text-sm md:px-8">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Notes</p>
          <p className="mt-2 whitespace-pre-wrap">{customerNotes}</p>
        </section>
      ) : null}
      <p className="border-t border-line px-6 py-4 text-xs text-muted md:px-8">
        Payments, signatures, messaging, and uploads are not available in this portal.
      </p>
    </article>
  );
}
