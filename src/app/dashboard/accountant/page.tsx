import { PlannedSection } from "@/components/dashboard/planned-section";

export const metadata = { title: "Accountant Center" };

export default function AccountantPage() {
  return (
    <PlannedSection
      title="Accountant Center"
      description="A future read-scoped workspace for an invited accountant."
      phaseNote="Accountant access is denied by default until a membership exists. This center will not expose owner credentials, security settings, or other organizations. QuickBooks syncing is not activated."
      related={[
        { href: "/dashboard/finance", label: "Finance" },
        { href: "/dashboard/taxes", label: "Taxes" },
        { href: "/dashboard/reports", label: "Reports" },
      ]}
    />
  );
}
