import { PlannedSection } from "@/components/dashboard/planned-section";

export const metadata = { title: "Contracts & Signatures" };

export default function ContractsPage() {
  return (
    <PlannedSection
      title="Contracts & Signatures"
      description="Contract records and signature status will live here."
      phaseNote="Electronic signatures are not activated. This page does not send, store, or verify legally binding e-sign events."
      related={[
        { href: "/dashboard/documents", label: "Documents" },
        { href: "/dashboard/projects", label: "Projects" },
      ]}
    />
  );
}
