import { Badge } from "@/components/ui";
import { formatCents } from "@/lib/money";

export type CommercialLine = {
  id?: string;
  description: string;
  quantity: number;
  unitCents: number;
  lineTotalCents: number;
  discountCents?: number;
};

export function CommercialDocument({
  kind,
  number,
  status,
  orgLegalName,
  orgDisplayName,
  clientBusinessName,
  clientContactName,
  clientEmail,
  issueDate,
  secondaryDateLabel,
  secondaryDate,
  currency,
  lines,
  subtotalCents,
  discountCents,
  taxCents,
  totalCents,
  amountPaidCents,
  customerNotes,
  terms,
  sourceEstimateNumber,
  showDiscountColumn = false,
}: {
  kind: "Estimate" | "Invoice";
  number: string;
  status: string;
  orgLegalName: string;
  orgDisplayName: string;
  clientBusinessName: string;
  clientContactName: string;
  clientEmail: string;
  issueDate: string | null;
  secondaryDateLabel: string;
  secondaryDate: string | null;
  currency: string;
  lines: CommercialLine[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents?: number;
  customerNotes?: string;
  terms?: string;
  sourceEstimateNumber?: string;
  showDiscountColumn?: boolean;
}) {
  return (
    <article className="print-document rounded-lg border border-line bg-card p-6 print:border-0 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Scars to Stars Media</p>
          <h1 className="text-2xl font-semibold tracking-tight">{orgDisplayName || orgLegalName || "STS Media"}</h1>
          {orgLegalName && orgLegalName !== orgDisplayName ? <p className="text-sm">{orgLegalName}</p> : null}
        </div>
        <div className="text-right text-sm">
          <p className="text-xs uppercase text-muted">{kind}</p>
          <p className="font-mono text-xl">{number}</p>
          <Badge tone="info">{status}</Badge>
        </div>
      </div>
      <div className="mt-6 grid gap-6 text-sm md:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-muted">Bill to</p>
          <p className="font-medium">{clientBusinessName || "Client"}</p>
          {clientContactName ? <p>{clientContactName}</p> : null}
          {clientEmail ? <p>{clientEmail}</p> : null}
        </div>
        <div className="md:text-right">
          <p>Issue {issueDate || "—"}</p>
          <p>{secondaryDateLabel} {secondaryDate || "—"}</p>
          {sourceEstimateNumber ? <p>Source estimate {sourceEstimateNumber}</p> : null}
        </div>
      </div>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-2">Description</th>
            <th className="py-2">Qty</th>
            <th className="py-2">Unit</th>
            {showDiscountColumn ? <th className="py-2">Discount</th> : null}
            <th className="py-2">Line</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={line.id || index} className="border-b border-line">
              <td className="py-2">{line.description}</td>
              <td className="py-2">{line.quantity}</td>
              <td className="py-2">{formatCents(line.unitCents, currency)}</td>
              {showDiscountColumn ? <td className="py-2">{formatCents(line.discountCents || 0, currency)}</td> : null}
              <td className="py-2">{formatCents(line.lineTotalCents, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-6 grid gap-2 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-mono">{formatCents(subtotalCents, currency)}</dd></div>
        <div className="flex justify-between"><dt>Discount</dt><dd className="font-mono">{formatCents(discountCents, currency)}</dd></div>
        <div className="flex justify-between"><dt>Tax</dt><dd className="font-mono">{formatCents(taxCents, currency)}</dd></div>
        <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="font-mono">{formatCents(totalCents, currency)}</dd></div>
        {typeof amountPaidCents === "number" ? (
          <div className="flex justify-between"><dt>Amount recorded paid</dt><dd className="font-mono">{formatCents(amountPaidCents, currency)}</dd></div>
        ) : null}
      </dl>
      {terms ? <p className="mt-6 whitespace-pre-wrap text-sm">{terms}</p> : null}
      {customerNotes ? <p className="mt-4 whitespace-pre-wrap text-sm">{customerNotes}</p> : null}
    </article>
  );
}
