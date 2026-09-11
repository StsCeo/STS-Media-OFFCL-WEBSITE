import Link from "next/link";
import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
import { resources } from "@/lib/content/public";

export const metadata = { title: "Resources" };

export default function ResourcesPage() {
  return (
    <IvoryShell wide>
      <PageKicker>Guides</PageKicker>
      <PageTitle>Practical notes for owners and creators.</PageTitle>
      <PageLede>
        Short briefs you can send before a call. They are not lead magnets and they do not invent case-study numbers.
      </PageLede>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {resources.map((item) => (
          <Link key={item.slug} href={`/resources/${item.slug}`} className="lift rounded-xl border border-line bg-white p-6">
            <p className="text-xs uppercase tracking-[0.16em] text-forest">{item.audience}</p>
            <h2 className="mt-2 font-display text-2xl">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{item.summary}</p>
          </Link>
        ))}
      </div>
    </IvoryShell>
  );
}
