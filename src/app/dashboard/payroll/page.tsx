import { PlannedSection } from "@/components/dashboard/planned-section";

export const metadata = { title: "Payroll & Contractors" };

export default function PayrollPage() {
  return (
    <PlannedSection
      title="Payroll & Contractors"
      description="Contractor assignments, owner draws, and payroll records will live here."
      phaseNote="Payroll processing is not activated. Do not enter Social Security numbers, bank passwords, or payroll credentials. The existing owner account page remains under Settings."
      related={[
        { href: "/dashboard/team", label: "Owner account" },
        { href: "/dashboard/security", label: "Security & Ownership" },
      ]}
    />
  );
}
