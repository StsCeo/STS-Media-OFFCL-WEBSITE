import { LeadBoard } from "@/components/dashboard/lead-board";
import { PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Leads" };

export default function LeadsPage() {
  const leads = getWorkspace().leads;
  return (
    <div>
      <PageHeader title="Leads" description="Pipeline stages, follow-ups, and conversion. Demo leads are unlabeled companies until real contacts are added." />
      <LeadBoard leads={leads} />
    </div>
  );
}
