import { PublicFooter, PublicHeader } from "@/components/public/chrome";
import { getWorkspace } from "@/lib/data/store";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const brand = getWorkspace().brand;
  return (
    <div data-surface="public" className="min-h-screen bg-obsidian text-ivory">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter email={brand.email} statement={brand.brandStatement} />
    </div>
  );
}
