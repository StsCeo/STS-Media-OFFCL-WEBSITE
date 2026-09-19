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
      <div className="mt-8 flex flex-wrap gap-3">
        <Button href="/contact?for=creators">Start a collaboration</Button>
        <Button href="/lookbook" variant="secondary">
          Browse color systems
        </Button>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {creatorPath.points.map((point) => (
          <article key={point.title} className="public-card lift p-6">
            <h2 className="font-medium">{point.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{point.body}</p>
          </article>
        ))}
      </div>
      <section className="mt-14 grid gap-8 md:grid-cols-[1fr_1fr]">
        <div className="public-card p-6">
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
        <div className="public-card bg-lavender/70 p-6">
          <p className="text-sm font-medium text-muted">Honesty rule</p>
          <h2 className="mt-2 font-display text-2xl">No borrowed metrics</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Follower counts, view spikes, and revenue screenshots stay off the site until they are yours to publish. Empty is better than inflated.
          </p>
          <Button href="/contact?for=creators" className="mt-6 rounded-full">
            Start a collaboration
          </Button>
        </div>
      </section>
    </IvoryShell>
  );
}
