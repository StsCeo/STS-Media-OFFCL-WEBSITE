import Link from "next/link";
import { Button } from "@/components/ui";
import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
import { VulnerabilityForm } from "@/components/public/vulnerability-form";
import { REVIEW_DISCLAIMER, vulnerabilityPolicy } from "@/lib/content/trust";

export const metadata = { title: "Report a vulnerability" };

export default function VulnerabilityReportPage() {
  return (
    <IvoryShell wide>
      <PageKicker>Security</PageKicker>
      <PageTitle>{vulnerabilityPolicy.title}</PageTitle>
      <PageLede>{vulnerabilityPolicy.lede}</PageLede>
      <p className="mt-4 max-w-2xl text-sm text-muted">{REVIEW_DISCLAIMER}</p>
      <div className="mt-10 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <article className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-medium">In scope</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
              {vulnerabilityPolicy.inScope.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-medium">Out of scope</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
              {vulnerabilityPolicy.outOfScope.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-medium">Rules for good-faith research</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
              {vulnerabilityPolicy.rules.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-medium">What to include</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
              {vulnerabilityPolicy.include.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <p className="text-sm text-muted">
            Machine-readable contact:{" "}
            <a className="underline" href="/.well-known/security.txt">
              /.well-known/security.txt
            </a>
            . Acknowledgments: <Link className="underline" href="/security/acknowledgments">/security/acknowledgments</Link>.
          </p>
        </div>
        <VulnerabilityForm />
      </div>
      <Button href="/security" variant="secondary" className="mt-8">
        Back to security practices
      </Button>
    </IvoryShell>
  );
}
