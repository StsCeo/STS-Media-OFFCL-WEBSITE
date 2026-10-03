import Link from "next/link";
import { Button } from "@/components/ui";
import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
import { creatorPath } from "@/lib/content/public";

export const metadata = { title: "For creators" };

export default function CreatorsPage() {
  return (
    <IvoryShell wide>
      <PageKicker>{creatorPath.eyebrow}</PageKicker>
      <PageTitle>{creatorPath.title}</PageTitle>
      <PageLede>{creatorPath.lede}</PageLede>
      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button href="/contact?for=creators">Start a collaboration</Button>
        <Link href="/work" className="text-sm font-medium text-ink underline-offset-4 hover:underline">
          See published work
        </Link>
      </div>
      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {creatorPath.points.map((point) => (
          <article key={point.title} className="accent-edge">
            <h2 className="font-medium">{point.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{point.body}</p>
          </article>
        ))}
      </div>
      <section className="mt-14 grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl">What to have ready</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6">
            {creatorPath.prepare.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            See{" "}
            <Link className="underline" href="/resources/a-collaboration-page-that-holds-up">
              A collaboration page that holds up
            </Link>
            .
          </p>
        </div>
        <div className="public-section-sage rounded-[20px] p-6">
          <p className="public-kicker">Honesty rule</p>
          <h2 className="mt-2 font-display text-2xl">No borrowed metrics</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Follower counts, view spikes, and revenue screenshots stay off the site until they are yours to publish. Empty is better than inflated.
          </p>
        </div>
      </section>
    </IvoryShell>
  );
}
