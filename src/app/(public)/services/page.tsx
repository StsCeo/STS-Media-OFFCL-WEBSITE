import { Button } from "@/components/ui";
import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Services" };

const visuals = ["grid", "split", "stack", "marks", "pin", "orbit"] as const;

export default function ServicesPage() {
  const services = getWorkspace().services.filter((item) => item.active);
  return (
    <IvoryShell wide>
      <PageKicker>Services</PageKicker>
      <PageTitle>Websites, systems, and support.</PageTitle>
      <PageLede>Practical digital work for owners and creators. Each tile is a starting point — we quote after discovery.</PageLede>
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {services.map((service, index) => (
          <article
            key={service.id}
            id={service.slug}
            className="public-card overflow-hidden bg-[#111412] text-[#F3EFE7]"
          >
            <div className="service-visual h-32" data-visual={visuals[index % visuals.length]} aria-hidden="true" />
            <div className="p-6">
              <h2 className="public-display text-3xl">{service.name}</h2>
              <p className="mt-3 text-sm text-[#B8BDBA]">{service.summary}</p>
              <p className="mt-3 text-sm leading-6 text-[#F3EFE7]/80">{service.description}</p>
            </div>
          </article>
        ))}
      </div>
      <Button href="/contact" className="mt-10">
        Start a Project
      </Button>
    </IvoryShell>
  );
}
