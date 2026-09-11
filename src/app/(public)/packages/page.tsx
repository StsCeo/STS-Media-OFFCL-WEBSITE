import { Badge, Button } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Packages" };

export default function PackagesPage() {
  const packages = getWorkspace().packages.filter((item) => item.active);
  return (
    <div className="bg-ivory text-ink">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="font-display text-4xl">Packages</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Packages are starting points, quoted after discovery. Pilot-client amounts are not the public rate card.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {packages.map((item) => (
            <article key={item.id} className={`lift rounded-xl border bg-white p-6 ${item.featured ? "border-gold shadow-[var(--shadow-card)]" : "border-line"}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl">{item.name}</h2>
                {item.featured ? <Badge tone="gold">Featured</Badge> : null}
              </div>
              <p className="mt-3 text-sm">{item.description}</p>
              <p className="mt-4 text-sm text-muted">
                Setup: {item.setupPrice == null ? "Quoted after discovery" : formatCurrency(item.setupPrice)}
              </p>
              <p className="text-sm text-muted">
                Monthly: {item.monthlyPrice == null ? "Quoted after discovery" : formatCurrency(item.monthlyPrice)}
              </p>
              <p className="mt-2 text-xs text-muted">Delivery: {item.deliveryEstimate}</p>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
                {item.included.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-4 text-xs uppercase tracking-wide text-muted">Add-ons</p>
              <p className="text-sm">{item.addOns.join(" · ")}</p>
              <Button href={item.ctaHref} className="mt-6 w-full">
                {item.ctaLabel}
              </Button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
