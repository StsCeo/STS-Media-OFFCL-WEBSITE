import { PageHeader } from "@/components/ui";
import { BrandForm } from "./brand-form";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Brand settings" };

export default function BrandSettingsPage() {
  return (
    <div>
      <PageHeader title="Brand settings" description="Mission and brand statements power the public website. Palettes and accent color are CSS tokens — status colors stay semantic." />
      <BrandForm brand={getWorkspace().brand} />
    </div>
  );
}
