import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui";
import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
import { resourceBySlug, resources } from "@/lib/content/public";

export function generateStaticParams() {
  return resources.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = resourceBySlug(slug);
  return { title: item?.title ?? "Resource" };
}

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = resourceBySlug(slug);
  if (!item) notFound();
  return (
    <IvoryShell>
      <p className="text-sm">
        <Link href="/resources" className="text-muted underline">
          All guides
        </Link>
      </p>
      <PageKicker>{item.audience}</PageKicker>
      <PageTitle>{item.title}</PageTitle>
      <PageLede>{item.summary}</PageLede>
      <ol className="mt-10 space-y-4">
        {item.body.map((line, index) => (
          <li key={line} className="rounded-xl border border-line bg-white p-5 text-sm leading-6">
            <span className="text-xs text-gold">{String(index + 1).padStart(2, "0")}</span>
            <p className="mt-2">{line}</p>
          </li>
        ))}
      </ol>
      <Button href="/contact" className="mt-10">
        Start a Project
      </Button>
    </IvoryShell>
  );
}
