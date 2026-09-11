import { ContactForm } from "@/components/public/contact-form";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Contact" };

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ for?: string; service?: string }>;
}) {
  const params = await searchParams;
  const { brand, services } = getWorkspace();
  const audience = params.for === "creators" ? "creator" : params.for === "owners" ? "owner" : "both";
  return (
    <div className="bg-ivory text-ink">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h1 className="font-display text-4xl">Start a project</h1>
          <p className="mt-4 text-muted">
            Tell us what you need. We answer with a clear next step — not a fake waitlist or inflated promise.
          </p>
          <dl className="mt-8 space-y-3 text-sm">
            <div>
              <dt className="text-muted">Email</dt>
              <dd>
                <a href={`mailto:${brand.email}`}>{brand.email}</a>
              </dd>
            </div>
            {brand.phone ? (
              <div>
                <dt className="text-muted">Phone</dt>
                <dd>{brand.phone}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted">Social</dt>
              <dd className="space-x-3">
                {brand.instagram ? <a href={brand.instagram}>Instagram</a> : null}
                {brand.linkedin ? <a href={brand.linkedin}>LinkedIn</a> : null}
                {brand.facebook ? <a href={brand.facebook}>Facebook</a> : null}
                {brand.tiktok ? <a href={brand.tiktok}>TikTok</a> : null}
              </dd>
            </div>
          </dl>
        </div>
        <ContactForm
          calendlyUrl={brand.calendlyUrl}
          defaultAudience={audience}
          defaultService={params.service}
          services={services.filter((item) => item.active).map((item) => ({ slug: item.slug, name: item.name }))}
        />
      </div>
    </div>
  );
}
