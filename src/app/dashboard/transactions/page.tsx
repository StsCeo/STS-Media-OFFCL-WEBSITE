import { Badge, Button, Card, PageHeader, inputClass, textareaClass } from "@/components/ui";
import { archiveOsTransaction, saveOsTransactionForm } from "@/app/actions";
import { getWorkspace } from "@/lib/data/store";
import { buildMasterTransactionLog } from "@/lib/os-transactions";
import { formatCents } from "@/lib/money";
import { TAX_DISCLAIMER } from "@/lib/tax";

export const metadata = { title: "Transactions" };

export default function TransactionsPage() {
  const workspace = getWorkspace();
  const rows = buildMasterTransactionLog(workspace);
  const net = rows.reduce((sum, row) => sum + row.amountCents, 0);
  return (
    <div>
      <PageHeader
        title="Master transaction log"
        description="One list of income, expenses, and owner-entered adjustments. Expense and revenue ledgers still store dollars; this view converts them to integer cents. New manual entries are stored as cents."
      />
      <Card className="mb-6">
        <p className="font-mono text-2xl">Net in view {formatCents(net, workspace.businessProfile.currency)}</p>
        <p className="mt-2 text-sm text-muted">{TAX_DISCLAIMER}</p>
        <p className="mt-2 text-sm text-muted">Owner draws, contributions, and transfers are not revenue or business expenses.</p>
      </Card>
      <Card id="add" className="mb-6">
        <h2 className="mb-4 font-semibold">Add manual entry</h2>
        <form action={saveOsTransactionForm} className="grid gap-3 md:grid-cols-2">
          <input name="date" type="date" required className={inputClass} defaultValue={new Date().toISOString().slice(0, 10)} />
          <select name="kind" className={inputClass} defaultValue="adjustment">
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="owner_draw">Owner draw</option>
            <option value="owner_contribution">Owner contribution</option>
            <option value="transfer">Transfer</option>
            <option value="adjustment">Adjustment</option>
          </select>
          <input name="description" required className={inputClass} placeholder="Description" />
          <input name="amount" type="number" step="0.01" required className={inputClass} placeholder="Amount (USD)" />
          <input name="category" className={inputClass} placeholder="Category" />
          <textarea name="notes" className={`${textareaClass} md:col-span-2`} placeholder="Notes" />
          <Button type="submit">Post entry</Button>
        </form>
      </Card>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="min-w-[900px] w-full text-left text-sm">
          <caption className="sr-only">Master transaction log</caption>
          <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Description</th>
              <th className="p-3">Kind</th>
              <th className="p-3">Source</th>
              <th className="p-3">Status</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-3 font-mono text-xs">{row.date}</td>
                <td className="p-3">
                  <p>{row.description}</p>
                  <p className="text-xs text-muted">{row.category}</p>
                </td>
                <td className="p-3"><Badge>{row.kind.replaceAll("_", " ")}</Badge></td>
                <td className="p-3 text-xs">{row.source.replaceAll("_", " ")}</td>
                <td className="p-3 text-xs">{row.status}</td>
                <td className={`p-3 font-mono ${row.amountCents < 0 ? "text-danger" : ""}`}>{formatCents(row.amountCents, row.currency)}</td>
                <td className="p-3">
                  {row.source === "manual" ? (
                    <form action={archiveOsTransaction}>
                      <input type="hidden" name="id" value={row.id} />
                      <Button type="submit" size="sm" variant="secondary">Archive</Button>
                    </form>
                  ) : (
                    <span className="text-xs text-muted">Edit in source ledger</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
