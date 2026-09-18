import { PlannedSection } from "@/components/dashboard/planned-section";

export const metadata = { title: "Invoices & Payments" };

export default function InvoicesPage() {
  return (
    <PlannedSection
      title="Invoices & Payments"
      description="Invoice drafts, payment status, and collection follow-up will live here."
      phaseNote="Live Stripe charges are not enabled. Existing Phase 1 income records remain on the Income and Finance pages and are not treated as a production billing system."
      related={[
        { href: "/dashboard/revenue", label: "Income ledger" },
        { href: "/dashboard/finance", label: "Finance" },
        { href: "/dashboard/settings/business", label: "Invoice prefix" },
      ]}
    />
  );
}
