"use client";

import { useMemo, useState, useTransition } from "react";
import { archiveExpenses, deleteExpenses, duplicateExpense, upsertExpense } from "@/app/actions";
import { Badge, Button, Card, inputClass } from "@/components/ui";
import { EXPENSE_CATEGORIES, type Expense } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const columns: { key: keyof Expense; label: string }[] = [
  { key: "transactionDate", label: "Transaction date" },
  { key: "postedDate", label: "Posted date" },
  { key: "vendor", label: "Vendor" },
  { key: "description", label: "Description" },
  { key: "pretaxAmount", label: "Pre-tax" },
  { key: "salesTax", label: "Sales tax" },
  { key: "totalAmount", label: "Total" },
  { key: "currency", label: "Currency" },
  { key: "category", label: "Category" },
  { key: "subcategory", label: "Subcategory" },
  { key: "businessPurpose", label: "Business purpose" },
  { key: "paymentAccount", label: "Payment account" },
  { key: "paymentMethod", label: "Payment method" },
  { key: "billingFrequency", label: "Frequency" },
  { key: "receiptStatus", label: "Receipt" },
  { key: "confirmationStatus", label: "Confirmation" },
  { key: "taxYear", label: "Tax year" },
];

export function ExpenseLedger({ expenses }: { expenses: Expense[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<keyof Expense>("transactionDate");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"all" | "missing" | "draft">("all");
  const [editing, setEditing] = useState<Expense | null>(null);
  const [receipt, setReceipt] = useState<Expense | null>(null);
  const [pending, start] = useTransition();
  const pageSize = 10;

  const filtered = useMemo(() => {
    return expenses
      .filter((item) => !item.archived)
      .filter((item) => (view === "missing" ? item.receiptStatus === "missing" : true))
      .filter((item) => (view === "draft" ? item.confirmationStatus === "draft" : true))
      .filter((item) => (category ? item.category === category : true))
      .filter((item) => `${item.vendor} ${item.description} ${item.category}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        const av = a[sort];
        const bv = b[sort];
        if (av === bv) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av > bv ? 1 : -1) * (dir === "asc" ? 1 : -1);
      });
  }, [expenses, query, category, sort, dir, view]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const yearTotal = filtered.reduce((sum, item) => sum + item.totalAmount, 0);

  function exportCsv() {
    const header = columns.map((col) => col.label).join(",");
    const body = filtered
      .map((row) => columns.map((col) => `"${String(row[col.key] ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sts-media-expenses.csv";
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
        Mileage and actual vehicle expenses may require different tax treatment and should not be double-counted. Treat every expense as a potential business expense—professional review may be required. This ledger is not legal or tax advice.
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input className={inputClass + " max-w-xs"} placeholder="Search vendor, description…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
        <select className={inputClass + " max-w-xs"} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <Button size="sm" variant={view === "all" ? "primary" : "secondary"} onClick={() => setView("all")}>All</Button>
        <Button size="sm" variant={view === "missing" ? "primary" : "secondary"} onClick={() => setView("missing")}>Missing receipts</Button>
        <Button size="sm" variant={view === "draft" ? "primary" : "secondary"} onClick={() => setView("draft")}>Drafts to confirm</Button>
        <Button size="sm" onClick={() => setEditing(blankExpense())}>Add expense</Button>
        <Button size="sm" variant="secondary" onClick={exportCsv}>Export CSV</Button>
        <Button size="sm" variant="secondary" onClick={() => window.print()}>Print / PDF</Button>
        <Button size="sm" variant="secondary" href="mailto:info@stsmedia.co?subject=STS%20Media%20expense%20report">Email report</Button>
      </div>
      <p className="text-sm text-muted">
        Showing {filtered.length} records. Total in view: <span className="font-mono">{formatCurrency(yearTotal)}</span>. Saved views: Missing receipts, Drafts needing confirmation.
      </p>
      {selected.length ? (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(() => archiveExpenses(selected))}>Archive selected</Button>
          <Button size="sm" variant="danger" disabled={pending} onClick={() => {
            if (confirm("Delete selected expenses? This cannot be undone in demo storage.")) start(() => deleteExpenses(selected));
          }}>Delete selected</Button>
        </div>
      ) : null}

      <div className="hidden overflow-x-auto rounded-lg border border-line md:block">
        <table className="min-w-[1400px] w-full text-left text-sm">
          <caption className="sr-only">Expense ledger</caption>
          <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="p-2" scope="col"><input type="checkbox" aria-label="Select all expenses" onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])} /></th>
              {columns.map((col) => (
                <th key={col.key} className="p-2" scope="col">
                  <button type="button" onClick={() => { setSort(col.key); setDir(dir === "asc" ? "desc" : "asc"); }}>{col.label}</button>
                </th>
              ))}
              <th className="p-2" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-2"><input type="checkbox" aria-label={`Select ${row.vendor}`} checked={selected.includes(row.id)} onChange={(e) => setSelected((cur) => e.target.checked ? [...cur, row.id] : cur.filter((id) => id !== row.id))} /></td>
                {columns.map((col) => (
                  <td key={col.key} className="p-2 align-top">
                    {col.key === "confirmationStatus" && row.confirmationStatus === "draft" ? <Badge tone="warning">Draft</Badge> : null}
                    {col.key === "receiptStatus" && row.receiptStatus === "missing" ? <Badge tone="danger">Missing</Badge> : null}
                    {["pretaxAmount", "salesTax", "totalAmount"].includes(col.key) ? formatCurrency(Number(row[col.key])) : String(row[col.key] ?? "")}
                    {row.demoLabel && col.key === "vendor" ? <div><Badge tone="demo">Demo / draft</Badge></div> : null}
                  </td>
                ))}
                <td className="p-2">
                  <div className="flex flex-col gap-1">
                    <button type="button" className="text-forest underline" onClick={() => setEditing(row)}>Edit</button>
                    <button type="button" className="underline" onClick={() => start(() => duplicateExpense(row.id))}>Duplicate</button>
                    <button type="button" className="underline" onClick={() => setReceipt(row)}>Receipt</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <Card key={row.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{row.vendor}</p>
                <p className="text-sm text-muted">{row.description}</p>
              </div>
              <p className="font-mono">{formatCurrency(row.totalAmount)}</p>
            </div>
            <p className="mt-2 text-xs">{row.transactionDate} · {row.category}</p>
            <div className="mt-2 flex gap-2">
              {row.confirmationStatus === "draft" ? <Badge tone="warning">Draft</Badge> : null}
              {row.receiptStatus === "missing" ? <Badge tone="danger">Missing receipt</Badge> : null}
            </div>
            <Button size="sm" className="mt-3" onClick={() => setEditing(row)}>Edit</Button>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm">
        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-card p-6"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              start(async () => {
                await upsertExpense({
                  id: editing.id.startsWith("new") ? undefined : editing.id,
                  transactionDate: String(data.get("transactionDate")),
                  postedDate: String(data.get("postedDate")),
                  vendor: String(data.get("vendor")),
                  description: String(data.get("description")),
                  pretaxAmount: Number(data.get("pretaxAmount")),
                  salesTax: Number(data.get("salesTax")),
                  category: String(data.get("category")),
                  subcategory: String(data.get("subcategory")),
                  businessPurpose: String(data.get("businessPurpose")),
                  paymentAccount: String(data.get("paymentAccount")),
                  paymentMethod: String(data.get("paymentMethod")),
                  billingFrequency: String(data.get("billingFrequency")) as Expense["billingFrequency"],
                  confirmationStatus: String(data.get("confirmationStatus")) as Expense["confirmationStatus"],
                  notes: String(data.get("notes")),
                  receiptStatus: String(data.get("receiptStatus")) as Expense["receiptStatus"],
                });
                setEditing(null);
              });
            }}
          >
            <h2 className="text-lg font-semibold">{editing.id.startsWith("new") ? "Add expense" : "Edit expense"}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input name="transactionDate" className={inputClass} defaultValue={editing.transactionDate} required />
              <input name="postedDate" className={inputClass} defaultValue={editing.postedDate} required />
              <input name="vendor" className={inputClass} defaultValue={editing.vendor} required placeholder="Vendor" />
              <input name="description" className={inputClass} defaultValue={editing.description} required placeholder="Description" />
              <input name="pretaxAmount" type="number" step="0.01" className={inputClass} defaultValue={editing.pretaxAmount} />
              <input name="salesTax" type="number" step="0.01" className={inputClass} defaultValue={editing.salesTax} />
              <select name="category" className={inputClass} defaultValue={editing.category}>
                {EXPENSE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
              <input name="subcategory" className={inputClass} defaultValue={editing.subcategory} placeholder="Subcategory" />
              <input name="businessPurpose" className={inputClass} defaultValue={editing.businessPurpose} placeholder="Business purpose" />
              <input name="paymentAccount" className={inputClass} defaultValue={editing.paymentAccount} placeholder="Payment account" />
              <input name="paymentMethod" className={inputClass} defaultValue={editing.paymentMethod} placeholder="Payment method" />
              <select name="billingFrequency" className={inputClass} defaultValue={editing.billingFrequency}>
                <option value="one_time">One-time</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <select name="confirmationStatus" className={inputClass} defaultValue={editing.confirmationStatus}>
                <option value="draft">Draft — needs confirmation</option>
                <option value="confirmed">Confirmed</option>
              </select>
              <select name="receiptStatus" className={inputClass} defaultValue={editing.receiptStatus}>
                <option value="missing">Missing</option>
                <option value="attached">Attached</option>
                <option value="needs_review">Needs review</option>
              </select>
              <textarea name="notes" className={inputClass + " md:col-span-2 h-20"} defaultValue={editing.notes} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        </div>
      ) : null}

      {receipt ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Card className="w-full max-w-xl">
            <h2 className="font-semibold">Receipt · {receipt.vendor}</h2>
            <p className="mt-2 text-sm text-muted">{receipt.receiptName ? receipt.receiptName : "No file attached. Upload is stored privately when Supabase Storage is connected. Do not put secrets in the filename."}</p>
            <input type="file" accept="image/*,application/pdf" className="mt-4 text-sm" />
            <div className="mt-4 flex gap-2">
              <Button onClick={() => setReceipt(null)}>Close</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function blankExpense(): Expense {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `new-${Date.now()}`,
    transactionDate: today,
    postedDate: today,
    vendor: "",
    description: "",
    pretaxAmount: 0,
    salesTax: 0,
    totalAmount: 0,
    currency: "USD",
    category: "Needs review",
    subcategory: "",
    clientId: null,
    projectId: null,
    businessPurpose: "",
    paymentAccount: "",
    paymentMethod: "",
    recurring: false,
    billingFrequency: "one_time",
    receiptName: null,
    receiptStatus: "missing",
    reimbursable: false,
    reimbursementStatus: "n/a",
    directProjectCost: false,
    taxReviewStatus: "needs_review",
    deductibilityStatus: "unknown",
    taxYear: new Date().getFullYear(),
    notes: "",
    createdBy: "Owner",
    createdAt: today,
    updatedAt: today,
    archived: false,
    confirmationStatus: "draft",
    demoLabel: true,
  };
}
