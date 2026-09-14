import { Button, EmptyState } from "@/components/ui";
import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Testimonials" };

export default function TestimonialsPage() {
  const quotes = getWorkspace().testimonials.filter((item) => item.approved && item.published);
  return (
    <IvoryShell>
      <PageKicker>Testimonials</PageKicker>
      <PageTitle>Client quotes, when they exist.</PageTitle>
      <PageLede>Quotes appear only when they are approved and published.</PageLede>
      {quotes.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No published testimonials yet"
            body="When a client offers a quote and it is approved, it will be listed here."
            action={<Button href="/contact">Start a Project</Button>}
          />
        </div>
      ) : (
        <div className="mt-10 space-y-4">
          {quotes.map((item) => (
            <blockquote key={item.id} className="border border-[#0B0D0C]/10 bg-white p-6">
              <p className="public-display text-2xl leading-8">“{item.quote}”</p>
              <footer className="mt-3 text-sm text-[#4f564f]">
                {item.authorName}
                {item.authorRole ? `, ${item.authorRole}` : ""}
                {item.company ? ` · ${item.company}` : ""}
              </footer>
            </blockquote>
          ))}
        </div>
      )}
    </IvoryShell>
  );
}
