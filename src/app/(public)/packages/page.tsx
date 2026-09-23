import { Badge, Button } from "@/components/ui";
import { PricingBoard } from "@/components/public/pricing/pricing-board";
import { getWorkspace } from "@/lib/data/store";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Packages" };

export default function PackagesPage() {
  const packages = getWorkspace().packages.filter((item) => item.active);
  return (
    <div className="sts-pricing bg-ivory text-ink">
      <div className="public-wrap public-page">
        <PricingBoard
          titleAs="h1"
          heading="Clear starting points. Custom scope where it matters."
          showConversation={false}
        />

        <h2 className="mt-16 text-2xl font-bold tracking-tight">Quoted custom systems</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Presence, Care, and Signal stay discovery quotes. Pilot-client amounts are not the public rate card.
        </p>
        <div className="sts-pricing-grid">
          {packages.map((item) => (
            <article key={item.id} className={item.featured ? "sts-price-card is-featured" : "sts-price-card"}>
              <div className="flex items-center justify-between gap-3">
                <h2>{item.name}</h2>
                {item.featured ? <Badge>Featured</Badge> : null}
              </div>
              <p className="sts-price-summary">{item.description}</p>
              <p className="mt-4 text-sm text-muted">
                Setup: {item.setupPrice == null ? "Quoted after discovery" : formatCurrency(item.setupPrice)}
              </p>
              <p className="text-sm text-muted">
                Monthly: {item.monthlyPrice == null ? "Quoted after discovery" : formatCurrency(item.monthlyPrice)}
              </p>
              <p className="mt-2 text-xs text-muted">Delivery: {item.deliveryEstimate}</p>
              <ul>
                {item.included.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-4 text-xs uppercase tracking-wide text-muted">Add-ons</p>
              <p className="text-sm">{item.addOns.join(" · ")}</p>
              <Button href={item.ctaHref} className="sts-price-cta">
                {item.ctaLabel}
              </Button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
