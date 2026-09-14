import { Button, Card, PageHeader, inputClass, textareaClass } from "@/components/ui";
import { saveTaxChecklistItem } from "@/app/actions";
import { getWorkspace } from "@/lib/data/store";
import { formatCents } from "@/lib/money";
import { POTENTIAL_EXPENSE_LABEL, TAX_DISCLAIMER } from "@/lib/tax";

export const metadata = { title: "Taxes" };

export default function TaxesPage() {
  const { taxChecklist, businessProfile } = getWorkspace();
  const year = 2026;
  const items = taxChecklist.filter((item) => item.taxYear === year);
  return (
    <div>
      <PageHeader title="Taxes" description="Owner checklist and recordkeeping only. This is not a tax product." />
      <Card className="mb-6 border-warning/40">
        <h2 className="font-semibold">Professional review required</h2>
        <p className="mt-3 text-sm">{TAX_DISCLAIMER}</p>
        <p className="mt-3 text-sm">{POTENTIAL_EXPENSE_LABEL}</p>
      </Card>
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Accounting method</p>
          <p className="mt-2 font-medium capitalize">{businessProfile.accountingMethod}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Fiscal year</p>
          <p className="mt-2 font-medium capitalize">{businessProfile.fiscalYearType}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Owner-entered tax reserve</p>
          <p className="mt-2 font-mono">{businessProfile.taxReservePercent}% · {formatCents(businessProfile.reservedTaxAmountCents)}</p>
          <p className="mt-1 text-xs text-muted">Not a calculated tax liability.</p>
        </Card>
      </div>
      <Card className="mb-6">
        <h2 className="mb-4 font-semibold">{year} checklist</h2>
        <div className="space-y-4">
          {items.map((item) => (
            <form key={item.id} action={saveTaxChecklistItem} className="rounded-md border border-line p-3">
              <input type="hidden" name="id" value={item.id} />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted">Due {item.dueDate ?? "unscheduled"}{item.ownerEntered ? " · owner-entered" : ""}</p>
                </div>
                <select name="status" className={inputClass + " max-w-48"} defaultValue={item.status}>
                  <option value="todo">To do</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                  <option value="not_applicable">Not applicable</option>
                </select>
              </div>
              <textarea name="notes" className={`${textareaClass} mt-3`} defaultValue={item.notes} />
              <Button type="submit" size="sm" className="mt-3">Save item</Button>
            </form>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="mb-4 font-semibold">Add owner reminder</h2>
        <form action={saveTaxChecklistItem} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="taxYear" value={String(year)} />
          <input name="title" required className={inputClass} placeholder="Reminder title" />
          <input name="dueDate" type="date" className={inputClass} />
          <textarea name="notes" className={`${textareaClass} md:col-span-2`} placeholder="Notes for you or your professional" />
          <Button type="submit">Add reminder</Button>
        </form>
      </Card>
    </div>
  );
}
