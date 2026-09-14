import { Button, EmptyState } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Testimonials" };

export default function TestimonialsPage() {
  const quotes = getWorkspace().testimonials.filter((item) => item.approved && item.published);
  return (
    <div className="bg-ivory text-ink">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="font-display text-4xl">Testimonials</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Quotes are managed from the command center and only appear here when they are approved and published. STS Media does not generate customer quotes.
        </p>
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
              <blockquote key={item.id} className="rounded-xl border border-line bg-white p-6">
                <p className="text-xl leading-8">“{item.quote}”</p>
                <footer className="mt-3 text-sm text-muted">
                  {item.authorName}
                  {item.authorRole ? `, ${item.authorRole}` : ""}
                  {item.company ? ` · ${item.company}` : ""}
                </footer>
              </blockquote>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
