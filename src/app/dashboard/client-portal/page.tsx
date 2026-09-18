import { PlannedSection } from "@/components/dashboard/planned-section";

export const metadata = { title: "Client Portal" };

export default function ClientPortalStaffPage() {
  return (
    <PlannedSection
      title="Client Portal"
      description="A future authenticated client area, separate from the public marketing site."
      phaseNote="Clients cannot access the owner dashboard. The public /portal page is unchanged marketing copy. No client logins are issued from this screen."
      related={[
        { href: "/portal", label: "Public portal page" },
        { href: "/dashboard/clients", label: "Client records" },
      ]}
    />
  );
}
