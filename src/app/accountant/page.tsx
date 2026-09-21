import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { loadAccountantCenter } from "@/lib/org/accountant";
import { ACCOUNTANT_READONLY_NOTE } from "@/lib/org/accountant-model";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Accountant Center" };
export const dynamic = "force-dynamic";

function money(amount: number) {
  return formatCurrency(amount);
}

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" {
  if (status === "paid") return "success";
  if (status === "overdue") return "danger";
  if (status === "issued") return "warning";
  return "neutral";
}

export default async function AccountantPage() {
  const data = await loadAccountantCenter();
  return (
    <div>
      <PageHeader
        eyebrow="Read-only review"
        title="Accountant Center"
        description="Organization-scoped operational figures for financial review. This surface cannot create, edit, pay, archive, or export editable workbooks."
      />
      <Card className="mb-4 space-y-2 text-sm text-muted">
        <p>{data.recordNote}</p>
        <p>{data.revenueNote}</p>
        <p>{data.archiveNote}</p>
        <p>{ACCOUNTANT_READONLY_NOTE}</p>
      </Card>
      {data.unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">Operational records could not be loaded from the database.</p>
        </Card>
      ) : null}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Paid revenue</p>
          <p className="font-mono text-2xl">{money(data.overview.paidRevenue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Outstanding revenue</p>
          <p className="font-mono text-2xl">{money(data.overview.outstandingRevenue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Non-archived expenses</p>
          <p className="font-mono text-2xl">{money(data.overview.expenses)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Unreimbursed expenses</p>
          <p className="font-mono text-2xl">{money(data.overview.unreimbursedExpenses)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Operational net income</p>
          <p className="font-mono text-2xl">{money(data.overview.netIncome)}</p>
          <p className="mt-1 text-xs text-muted">Paid revenue minus non-archived expenses. Estimate only.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Draft invoices</p>
          <p className="font-mono text-2xl">{money(data.overview.invoiceDraftTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Open invoices</p>
          <p className="font-mono text-2xl">{money(data.overview.invoiceOpenTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Overdue invoices</p>
          <p className="font-mono text-2xl">{money(data.overview.invoiceOverdueTotal)}</p>
        </Card>
        <Card className="p-4 sm:col-span-2 xl:col-span-4">
          <p className="text-xs uppercase text-muted">Paid invoices</p>
          <p className="font-mono text-2xl">{money(data.overview.invoicePaidTotal)}</p>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">CSV downloads</h2>
          <p className="text-xs text-muted">Server-generated on demand. No public links or stored files.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary inline-flex h-10 items-center rounded-md px-4 text-sm" href="/accountant/export/invoices">
            Download invoices CSV
          </Link>
          <Link className="btn-secondary inline-flex h-10 items-center rounded-md px-4 text-sm" href="/accountant/export/revenue">
            Download revenue CSV
          </Link>
          <Link className="btn-secondary inline-flex h-10 items-center rounded-md px-4 text-sm" href="/accountant/export/expenses">
            Download expenses CSV
          </Link>
        </div>
      </Card>

      <Card className="mb-6 overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Monthly revenue and expense summary</h2>
        {data.overview.monthly.length === 0 ? (
          <p className="text-sm text-muted">No monthly operational totals yet.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase text-muted">
                <th className="py-2 pr-3">Month</th>
                <th className="py-2 pr-3">Paid revenue</th>
                <th className="py-2 pr-3">Outstanding</th>
                <th className="py-2 pr-3">Expenses</th>
                <th className="py-2">Unreimbursed</th>
              </tr>
            </thead>
            <tbody>
              {data.overview.monthly.map((row) => (
                <tr key={row.month} className="border-b border-line/70">
                  <td className="py-2 pr-3 font-mono">{row.month}</td>
                  <td className="py-2 pr-3 font-mono">{money(row.paidRevenue)}</td>
                  <td className="py-2 pr-3 font-mono">{money(row.outstandingRevenue)}</td>
                  <td className="py-2 pr-3 font-mono">{money(row.expenses)}</td>
                  <td className="py-2 font-mono">{money(row.unreimbursedExpenses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mb-6 overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Invoices</h2>
        {data.invoices.length === 0 ? (
          <p className="text-sm text-muted">No invoices in this organization.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase text-muted">
                <th className="py-2 pr-3">Number</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Issue</th>
                <th className="py-2 pr-3">Due</th>
                <th className="py-2 pr-3">Client business</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-line/70">
                  <td className="py-2 pr-3 font-mono">{invoice.invoiceNumber}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={statusTone(invoice.derivedStatus)}>{invoice.derivedStatus}</Badge>
                    {invoice.archived ? <Badge tone="warning">Archived</Badge> : null}
                  </td>
                  <td className="py-2 pr-3 font-mono">{invoice.issueDate || "—"}</td>
                  <td className="py-2 pr-3 font-mono">{invoice.dueDate || "—"}</td>
                  <td className="py-2 pr-3">{invoice.clientBusinessName || "—"}</td>
                  <td className="py-2 font-mono">{money(invoice.totalCents / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mb-6 overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Expenses</h2>
        {data.expenses.length === 0 ? (
          <p className="text-sm text-muted">No expenses in this organization.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase text-muted">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2">Reimbursement</th>
              </tr>
            </thead>
            <tbody>
              {data.expenses.map((expense) => (
                <tr key={expense.id} className="border-b border-line/70">
                  <td className="py-2 pr-3 font-mono">{expense.transactionDate}</td>
                  <td className="py-2 pr-3">{expense.category}</td>
                  <td className="py-2 pr-3">{expense.description}</td>
                  <td className="py-2 pr-3 font-mono">{money(expense.totalCents / 100)}</td>
                  <td className="py-2">
                    {expense.reimbursementStatus}
                    {expense.archived ? <Badge tone="warning">Archived</Badge> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mb-6 overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Revenue</h2>
        {data.revenue.length === 0 ? (
          <p className="text-sm text-muted">No operational revenue in this organization.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase text-muted">
                <th className="py-2 pr-3">Earned</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2">Payment</th>
              </tr>
            </thead>
            <tbody>
              {data.revenue.map((entry) => (
                <tr key={entry.id} className="border-b border-line/70">
                  <td className="py-2 pr-3 font-mono">{entry.earnedDate}</td>
                  <td className="py-2 pr-3">{entry.entryType}</td>
                  <td className="py-2 pr-3">{entry.description}</td>
                  <td className="py-2 pr-3 font-mono">{money(entry.amountCents / 100)}</td>
                  <td className="py-2">
                    {entry.paymentStatus}
                    {entry.archived ? <Badge tone="warning">Archived</Badge> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Sanitized finance audit</h2>
        {data.audit.length === 0 ? (
          <p className="text-sm text-muted">No finance-related audit events are visible for this session.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase text-muted">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Entity</th>
                <th className="py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {data.audit.map((event, index) => (
                <tr key={`${event.occurredAt}-${event.action}-${index}`} className="border-b border-line/70">
                  <td className="py-2 pr-3 font-mono">{event.occurredAt.slice(0, 19).replace("T", " ")}</td>
                  <td className="py-2 pr-3">{event.action}</td>
                  <td className="py-2 pr-3">{event.entityType}</td>
                  <td className="py-2">{event.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
