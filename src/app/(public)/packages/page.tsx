import { Badge, Button } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Packages" };

export default function PackagesPage() {
  const packages = getWorkspace().packages.filter((item) => item.active);
  return (
    <div className="bg-ivory text-ink">
      <div className="public-wrap public-page">
        <h1 className="font-display text-4xl">Packages</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Packages are starting points, quoted after discovery. Pilot-client amounts are not the public rate card.
        </p>
        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          {packages.map((item) => (
            <article key={item.id} className={`flex flex-col border-t border-line pt-6 ${item.featured ? "public-section-sage rounded-[20px] border-t-0 p-6" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-2xl">{item.name}</h2>
                {item.featured ? <Badge>Featured</Badge> : null}
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
              <Button href={item.ctaHref} className="mt-6">
                {item.ctaLabel}
              </Button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
