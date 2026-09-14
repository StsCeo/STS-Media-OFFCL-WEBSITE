import { Badge, Button } from "@/components/ui";
import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
import { getWorkspace } from "@/lib/data/store";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Packages" };

export default function PackagesPage() {
  const packages = getWorkspace().packages.filter((item) => item.active);
  return (
    <IvoryShell wide>
      <PageKicker>Packages</PageKicker>
      <PageTitle>Starting points, quoted after discovery.</PageTitle>
      <PageLede>Pilot-client amounts are not the public rate card.</PageLede>
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {packages.map((item) => (
          <article
            key={item.id}
            className={`public-card p-6 ${item.featured ? "bg-[#0B0D0C] text-[#F3EFE7]" : "bg-white"}`}
          >
            <div className="flex items-center justify-between">
              <h2 className="public-display text-3xl">{item.name}</h2>
              {item.featured ? <Badge tone="gold">Featured</Badge> : null}
            </div>
            <p className="mt-3 text-sm leading-6">{item.description}</p>
            <p className={`mt-4 text-sm ${item.featured ? "text-[#B8BDBA]" : "text-[#4f564f]"}`}>
              Setup: {item.setupPrice == null ? "Quoted after discovery" : formatCurrency(item.setupPrice)}
            </p>
            <p className={`text-sm ${item.featured ? "text-[#B8BDBA]" : "text-[#4f564f]"}`}>
              Monthly: {item.monthlyPrice == null ? "Quoted after discovery" : formatCurrency(item.monthlyPrice)}
            </p>
            <p className={`mt-2 text-xs ${item.featured ? "text-[#91A38F]" : "text-[#4f564f]"}`}>Delivery: {item.deliveryEstimate}</p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
              {item.included.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs uppercase tracking-wide">Add-ons</p>
            <p className="text-sm">{item.addOns.join(" · ")}</p>
            <Button href={item.ctaHref} className="mt-6 w-full">
              {item.ctaLabel}
            </Button>
          </article>
        ))}
      </div>
    </IvoryShell>
  );
}
