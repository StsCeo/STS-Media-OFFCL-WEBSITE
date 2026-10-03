import { ContactForm } from "@/components/public/contact-form";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Contact" };

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ for?: string; service?: string; intent?: string }>;
}) {
  const params = await searchParams;
  const workspace = getWorkspace();
  const { brand } = workspace;
  const interests = [
    { slug: "website", name: "Website", active: true },
    { slug: "content", name: "Content", active: true },
    { slug: "custom-work", name: "Custom work", active: true },
  ];
  const interestNames = new Set(interests.map((item) => item.name));
  const services = [...interests, ...workspace.services.filter((service) => !interestNames.has(service.name))];
  const audience = params.for === "creators" ? "creator" : params.for === "owners" ? "owner" : "both";
  const audit = params.intent === "audit";
  return (
    <div className="bg-ivory text-ink">
      <div className="public-wrap grid gap-10 public-page lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-medium tracking-wide text-muted">Your next step.</p>
          <h1 className="mt-3 max-w-[14ch] font-display text-4xl text-ink">
            {audit ? "Request a review" : "Start a project"}
          </h1>
          <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-muted">
            {audit
              ? "Tell us what to review. We’ll reply with practical notes. This form does not book a call."
              : "Tell us what you need. We’ll reply with a clear next step."}
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
          submissionKey={crypto.randomUUID()}
          defaultAudience={audience}
          defaultService={params.service || (audit ? "digital-optimization" : undefined)}
          services={services.filter((item) => item.active).map((item) => ({ slug: item.slug, name: item.name }))}
        />
      </div>
    </div>
  );
}
