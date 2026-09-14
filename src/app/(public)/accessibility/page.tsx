import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
import { Button } from "@/components/ui";
import { REVIEW_DISCLAIMER, accessibility } from "@/lib/content/trust";

export const metadata = { title: "Accessibility" };

export default function AccessibilityPage() {
  return (
    <IvoryShell>
      <PageKicker>ADA and WCAG</PageKicker>
      <PageTitle>{accessibility.title}</PageTitle>
      <PageLede>{accessibility.lede}</PageLede>
      <p className="mt-4 text-sm text-muted">{REVIEW_DISCLAIMER}</p>
      <div className="mt-10 space-y-4">
        {accessibility.commitment.map((item) => (
          <article key={item.title} className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-medium">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
          </article>
        ))}
      </div>
      <section className="mt-10 rounded-xl border border-line bg-white p-5">
        <h2 className="font-medium">Keyboard</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
          {accessibility.keyboard.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section className="mt-4 rounded-xl border border-line bg-white p-5">
        <h2 className="font-medium">Known limits</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
          {accessibility.knownLimits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button href="/contact">Report a barrier</Button>
        <Button href="/rights" variant="secondary">
          Your rights
        </Button>
      </div>
    </IvoryShell>
  );
}
