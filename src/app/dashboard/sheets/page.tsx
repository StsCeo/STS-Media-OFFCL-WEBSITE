import { PlannedSection } from "@/components/dashboard/planned-section";

export const metadata = { title: "STS Sheets & Charts" };

export default function SheetsPage() {
  return (
    <PlannedSection
      title="STS Sheets & Charts"
      description="Owner-built tables and charts for STS operating data will live here."
      phaseNote="This is not a spreadsheet clone of Numbers or Excel. No imported third-party sheet assets are used. Charting against Business OS ledgers is planned for a later phase."
      related={[
        { href: "/dashboard/reports", label: "Reports" },
        { href: "/dashboard/finance", label: "Finance" },
      ]}
    />
  );
}
