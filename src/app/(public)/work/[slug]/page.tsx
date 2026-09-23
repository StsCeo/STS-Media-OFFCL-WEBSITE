import { notFound } from "next/navigation";
import { Button } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = getWorkspace();
  const item = workspace.portfolio.find((entry) => entry.slug === slug && entry.status === "published");
  if (!item) notFound();
  const quote = workspace.testimonials.find((entry) => entry.id === item.testimonialId && entry.published);

  return (
    <div className="bg-ivory text-ink">
      <div className="public-wrap max-w-4xl public-page">
        <p className="public-kicker">{item.industry}</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl">{item.companyName}</h1>
        <p className="mt-3 text-lg text-muted">{item.projectTitle}</p>
        <p className="mt-2 text-sm">Service: {item.serviceProvided}</p>
        <p className="mt-1 text-sm text-muted">
          {item.startDate}
          {item.endDate ? ` – ${item.endDate}` : " – in progress"}
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="font-medium">Challenge</h2>
            <p className="mt-2 text-sm leading-6">{item.challenge}</p>
          </section>
          <section>
            <h2 className="font-medium">STS Media solution</h2>
            <p className="mt-2 text-sm leading-6">{item.solution}</p>
          </section>
        </div>

        <section className="mt-10">
          <h2 className="font-medium">Deliverables</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {item.deliverables.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="device-frame rounded-lg p-8 text-center text-sm text-muted">{item.beforeImageLabel}</div>
          <div className="device-frame rounded-lg p-8 text-center text-sm text-muted">{item.afterImageLabel}</div>
          <div className="device-frame rounded-lg p-16 text-center text-sm text-muted">{item.desktopLabel}</div>
          <div className="device-frame mx-auto w-48 rounded-[28px] p-10 text-center text-sm text-muted">{item.mobileLabel}</div>
        </section>

        {item.videoUrl ? (
          <p className="mt-6">
            <a className="text-forest underline" href={item.videoUrl}>
              Watch project video
            </a>
          </p>
        ) : (
          <p className="mt-6 text-sm text-muted">Video: add when a real capture is available.</p>
        )}

        <section className="mt-10">
          <h2 className="font-medium">Results</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {item.results.map((line) => (
              <li key={line} className="rounded-md border border-dashed border-line px-3 py-2">
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-medium">Testimonial</h2>
          {quote ? (
            <blockquote className="mt-2 text-lg">“{quote.quote}”</blockquote>
          ) : (
            <p className="mt-2 text-sm text-muted">No approved client quote is on file yet.</p>
          )}
        </section>

        {item.websiteUrl ? (
          <Button href={item.websiteUrl} className="mt-8">
            Visit website
          </Button>
        ) : (
          <p className="mt-8 text-sm text-muted">Production URL will appear here after launch.</p>
        )}
      </div>
    </div>
  );
}
