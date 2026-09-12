import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getWorkspace().legal.find((item) => item.slug === slug);
  if (!page) notFound();
  return (
    <div className="bg-ivory text-ink">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-xs uppercase tracking-[0.18em] text-forest">Legal</p>
        <h1 className="mt-3 font-display text-4xl">{page.title}</h1>
        {page.needsProfessionalReview ? (
          <div className="mt-6">
            <Badge tone="warning">Must be reviewed by a qualified professional</Badge>
            <p className="mt-3 text-sm text-muted">
              This copy is an editable placeholder. It is not legal advice and is not an official policy until it is reviewed.
            </p>
          </div>
        ) : null}
        <p className="mt-8 whitespace-pre-wrap leading-7">{page.body}</p>
        <p className="mt-10 text-sm">
          <Link href="/rights" className="text-forest underline">Your rights</Link>
          {" · "}
          <Link href="/accessibility" className="underline">Accessibility</Link>
          {" · "}
          <Link href="/security/vulnerabilities" className="underline">Report a vulnerability</Link>
          {" · "}
          <Link href="/legal/privacy" className="underline">Privacy</Link>
          {" · "}
          <Link href="/legal/terms" className="underline">Terms</Link>
          {" · "}
          <Link href="/legal/cookies" className="underline">Cookies</Link>
          {" · "}
          <Link href="/legal/accessibility" className="underline">Accessibility statement</Link>
        </p>
      </div>
    </div>
  );
}
