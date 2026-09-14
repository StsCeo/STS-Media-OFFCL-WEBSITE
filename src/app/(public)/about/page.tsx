import Link from "next/link";
import { getWorkspace } from "@/lib/data/store";
import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";

export const metadata = { title: "About" };

export default function AboutPage() {
  const { brand } = getWorkspace();
  return (
    <IvoryShell>
      <PageKicker>About</PageKicker>
      <PageTitle>The Scars to Stars story</PageTitle>
      <PageLede>{brand.mission}</PageLede>
      <p className="mt-6 leading-7 text-[#4f564f]">
        Plenty of businesses already have the scars — the years of work, the overlooked storefront, the idea that never got a serious website. STS Media exists to turn that substance into a public presence people can trust.
      </p>
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <Link href="/for/owners" className="public-card bg-white p-5">
          <p className="text-xs uppercase tracking-[0.16em]">Owners</p>
          <p className="mt-2 text-sm">A public presence that matches the shop, practice, or service you already run.</p>
        </Link>
        <Link href="/for/creators" className="public-card bg-white p-5">
          <p className="text-xs uppercase tracking-[0.16em]">Creators</p>
          <p className="mt-2 text-sm">Collaboration pages and content systems that can be checked, not borrowed.</p>
        </Link>
      </div>
      <div className="mt-10 border border-[#0B0D0C]/10 bg-white p-6">
        <p className="public-kicker">{brand.founderRole}</p>
        <h2 className="public-display mt-2 text-3xl">{brand.founderName}</h2>
        <p className="mt-3 text-sm leading-6 text-[#4f564f]">{brand.founderBio}</p>
      </div>
    </IvoryShell>
  );
}
