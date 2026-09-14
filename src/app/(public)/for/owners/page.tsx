import Link from "next/link";
import { Button } from "@/components/ui";
import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
import { ownerPath } from "@/lib/content/public";

export const metadata = { title: "For business owners" };

export default function OwnersPage() {
  return (
    <IvoryShell wide>
      <PageKicker>{ownerPath.eyebrow}</PageKicker>
      <PageTitle>{ownerPath.title}</PageTitle>
      <PageLede>{ownerPath.lede}</PageLede>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button href="/contact?for=owners">Start a Project</Button>
        <Button href="/work" variant="secondary">
          See published work
        </Button>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {ownerPath.points.map((point) => (
          <article key={point.title} className="lift rounded-xl border border-line bg-white p-6">
            <h2 className="font-medium">{point.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{point.body}</p>
          </article>
        ))}
      </div>
      <section className="mt-14 rounded-xl border border-line bg-white p-6">
        <h2 className="font-display text-2xl">What to have ready</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6">
          {ownerPath.prepare.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm">
          A fuller brief lives in{" "}
          <Link className="underline" href="/resources/what-to-send-before-a-website">
            What to send before a website project
          </Link>
          .
        </p>
      </section>
    </IvoryShell>
  );
}
