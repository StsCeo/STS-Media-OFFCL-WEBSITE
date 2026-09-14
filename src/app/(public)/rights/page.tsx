import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
import { Button } from "@/components/ui";
import { REVIEW_DISCLAIMER, userRights } from "@/lib/content/trust";

export const metadata = { title: "Your rights" };

export default function RightsPage() {
  return (
    <IvoryShell>
      <PageKicker>Privacy</PageKicker>
      <PageTitle>{userRights.title}</PageTitle>
      <PageLede>{userRights.lede}</PageLede>
      <p className="mt-4 text-sm text-muted">{REVIEW_DISCLAIMER}</p>
      <section className="mt-10 rounded-xl border border-line bg-white p-5">
        <h2 className="font-medium">What we collect</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
          {userRights.collected.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <div className="mt-4 space-y-4">
        {userRights.rights.map((item) => (
          <article key={item.title} className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-medium">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
          </article>
        ))}
      </div>
      <section className="mt-4 rounded-xl border border-line bg-white p-5">
        <h2 className="font-medium">How to make a request</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{userRights.howTo}</p>
      </section>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button href="mailto:hello@stsmedia.co?subject=Privacy%20request">Email a privacy request</Button>
        <Button href="/legal/privacy" variant="secondary">
          Privacy policy
        </Button>
      </div>
    </IvoryShell>
  );
}
