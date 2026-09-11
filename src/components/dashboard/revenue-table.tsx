"use client";

import { useState, useTransition } from "react";
import { upsertRevenue } from "@/app/actions";
import { Badge, Button, Card, PageHeader, inputClass } from "@/components/ui";
import type { RevenueEntry } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function RevenueTable({ rows, clients }: { rows: RevenueEntry[]; clients: { id: string; businessName: string }[] }) {
  const [editing, setEditing] = useState<RevenueEntry | null>(null);
  const [, start] = useTransition();
  return (
    <div>
      <div className="mb-3">
        <Button size="sm" onClick={() => setEditing({
          id: `new-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          type: "one_time_project",
          description: "",
          amount: 0,
          currency: "USD",
          clientId: clients[0]?.id ?? null,
          projectId: null,
          service: "",
          invoiceStatus: "draft",
          paymentStatus: "unpaid",
          dueDate: new Date().toISOString().slice(0, 10),
          stripeCustomerId: "",
          stripeSubscriptionId: "",
          recognized: false,
          notes: "",
          demoLabel: true,
        })}>Add revenue</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="min-w-[1000px] w-full text-left text-sm">
          <thead className="bg-canvas text-xs uppercase text-muted">
            <tr>
              {["Date", "Type", "Description", "Amount", "Invoice", "Payment", "Due", "Stripe refs", ""].map((h) => <th key={h} className="p-2">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="p-2">{row.date}</td>
                <td className="p-2">{row.type.replaceAll("_", " ")}</td>
                <td className="p-2">{row.description} {row.demoLabel ? <Badge tone="demo">Pilot / demo</Badge> : null}</td>
                <td className="p-2 font-mono">{formatCurrency(row.amount)}</td>
                <td className="p-2"><Badge>{row.invoiceStatus}</Badge></td>
                <td className="p-2"><Badge tone={row.paymentStatus === "paid" ? "success" : "warning"}>{row.paymentStatus}</Badge></td>
                <td className="p-2">{row.dueDate}</td>
                <td className="p-2 text-xs">{row.stripeCustomerId || "—"} / {row.stripeSubscriptionId || "—"}</td>
                <td className="p-2"><button className="text-forest" onClick={() => setEditing(row)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form className="w-full max-w-lg rounded-lg bg-card p-6" onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            start(() => upsertRevenue({
              id: editing.id.startsWith("new") ? undefined : editing.id,
              date: String(data.get("date")),
              type: String(data.get("type")) as RevenueEntry["type"],
              description: String(data.get("description")),
              amount: Number(data.get("amount")),
              invoiceStatus: String(data.get("invoiceStatus")) as RevenueEntry["invoiceStatus"],
              paymentStatus: String(data.get("paymentStatus")) as RevenueEntry["paymentStatus"],
              dueDate: String(data.get("dueDate")),
              recognized: data.get("recognized") === "on",
              service: String(data.get("service")),
              notes: String(data.get("notes")),
            }).then(() => setEditing(null)));
          }}>
            <h2 className="font-semibold">Edit revenue</h2>
            <div className="mt-4 space-y-3">
              <input name="date" className={inputClass} defaultValue={editing.date} />
              <select name="type" className={inputClass} defaultValue={editing.type}>
                {["one_time_project","deposit","final_payment","recurring_maintenance","add_on","refund","discount","tax_collected","processing_fee"].map((t) => <option key={t}>{t}</option>)}
              </select>
              <input name="description" className={inputClass} defaultValue={editing.description} />
              <input name="amount" type="number" step="0.01" className={inputClass} defaultValue={editing.amount} />
              <input name="service" className={inputClass} defaultValue={editing.service} />
              <select name="invoiceStatus" className={inputClass} defaultValue={editing.invoiceStatus}>
                {["draft","sent","viewed","partial","paid","overdue","void"].map((t) => <option key={t}>{t}</option>)}
              </select>
              <select name="paymentStatus" className={inputClass} defaultValue={editing.paymentStatus}>
                {["unpaid","pending","paid","refunded","failed"].map((t) => <option key={t}>{t}</option>)}
              </select>
              <input name="dueDate" className={inputClass} defaultValue={editing.dueDate ?? ""} />
              <label className="flex gap-2 text-sm"><input type="checkbox" name="recognized" defaultChecked={editing.recognized} /> Recognized (still requires paid status for cash)</label>
              <textarea name="notes" className={inputClass + " h-20"} defaultValue={editing.notes} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function RevenuePageClient(props: { rows: RevenueEntry[]; clients: { id: string; businessName: string }[] }) {
  return (
    <div>
      <PageHeader title="Revenue" description="One-time fees are never ARR. Unpaid invoices are not cash collected." />
      <Card>
        <RevenueTable {...props} />
      </Card>
    </div>
  );
}
