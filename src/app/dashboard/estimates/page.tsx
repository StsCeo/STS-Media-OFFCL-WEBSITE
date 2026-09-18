import { PlannedSection } from "@/components/dashboard/planned-section";

export const metadata = { title: "Estimates & Proposals" };

export default function EstimatesPage() {
  return (
    <PlannedSection
      title="Estimates & Proposals"
      description="Drafting, sending, and versioning estimates will live here."
      phaseNote="Estimate numbering, proposal PDFs, and send history are not built yet. Prefixes saved in Business Settings will apply to new documents only."
      related={[
        { href: "/dashboard/crm", label: "CRM & Sales" },
        { href: "/dashboard/settings/business", label: "Business Settings" },
      ]}
    />
  );
}
