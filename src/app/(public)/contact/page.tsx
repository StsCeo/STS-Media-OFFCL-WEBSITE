import { ContactForm } from "@/components/public/contact-form";
import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
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
    <IvoryShell wide>
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <PageKicker>Contact</PageKicker>
          <PageTitle>Start a project</PageTitle>
          <PageLede>Tell us what you need. We answer with a clear next step.</PageLede>
          <dl className="mt-8 space-y-3 text-sm">
            <div>
              <dt className="text-[#4f564f]">Email</dt>
              <dd>
                <a className="underline-offset-4 hover:underline" href={`mailto:${brand.email}`}>
                  {brand.email}
                </a>
              </dd>
            </div>
            {brand.phone ? (
              <div>
                <dt className="text-[#4f564f]">Phone</dt>
                <dd>{brand.phone}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-[#4f564f]">Social</dt>
              <dd className="space-x-3">
                {brand.instagram ? (
                  <a className="underline-offset-4 hover:underline" href={brand.instagram}>
                    Instagram
                  </a>
                ) : null}
                {brand.linkedin ? (
                  <a className="underline-offset-4 hover:underline" href={brand.linkedin}>
                    LinkedIn
                  </a>
                ) : null}
                {brand.facebook ? (
                  <a className="underline-offset-4 hover:underline" href={brand.facebook}>
                    Facebook
                  </a>
                ) : null}
                {brand.tiktok ? (
                  <a className="underline-offset-4 hover:underline" href={brand.tiktok}>
                    TikTok
                  </a>
                ) : null}
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
    </IvoryShell>
  );
}
