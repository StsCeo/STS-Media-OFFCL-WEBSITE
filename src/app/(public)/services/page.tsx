import { Button } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Services" };

export default function ServicesPage() {
  const services = getWorkspace().services.filter((item) => item.active);
  return (
    <div className="bg-canvas text-ink">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="font-display text-4xl tracking-tight">Services</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Practical digital work for business owners who already know how to serve people, and for creators who need a public story that holds up. The public side should catch up to the work — not the other way around.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <article key={service.id} className="public-card lift p-6">
              <h2 className="text-lg font-semibold">{service.name}</h2>
              <p className="mt-2 text-sm text-muted">{service.summary}</p>
              <p className="mt-3 text-sm leading-6">{service.description}</p>
            </article>
          ))}
        </div>
        <Button href="/contact" className="mt-10 rounded-full">
          Start a Project
        </Button>
      </div>
    </div>
  );
}
