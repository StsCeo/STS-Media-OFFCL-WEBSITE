import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
import { faqs } from "@/lib/content/public";

export const metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <IvoryShell>
      <PageKicker>Questions</PageKicker>
      <PageTitle>Straight answers.</PageTitle>
      <PageLede>If a number, quote, or login is not real yet, we say so here too.</PageLede>
      <dl className="mt-10 space-y-4">
        {faqs.map((item) => (
          <div key={item.q} className="border-t border-line pt-5">
            <dt className="font-medium">{item.q}</dt>
            <dd className="mt-2 text-sm leading-6 text-muted">{item.a}</dd>
          </div>
        ))}
      </dl>
    </IvoryShell>
  );
}
