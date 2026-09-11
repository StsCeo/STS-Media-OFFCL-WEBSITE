import Link from "next/link";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "About" };

export default function AboutPage() {
  const { brand } = getWorkspace();
  return (
    <div className="bg-ivory text-ink">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-xs uppercase tracking-[0.18em] text-forest">About</p>
        <h1 className="mt-3 font-display text-4xl">The Scars to Stars story</h1>
        <p className="mt-6 text-lg leading-8">{brand.mission}</p>
        <p className="mt-6 leading-7 text-muted">
          The name is the point. Plenty of businesses already have the scars — the years of work, the overlooked storefront, the idea that never got a serious website. STS Media exists to turn that substance into a public presence people can trust.
        </p>
        <p className="mt-4 leading-7 text-muted">
          We do not invent results. We do not dress a thin offer in cinematic language and call it a brand. The work is websites, systems, content, and support that stay after launch.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link href="/for/owners" className="lift rounded-xl border border-line bg-white p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-forest">Owners</p>
            <p className="mt-2 text-sm">A public presence that matches the shop, practice, or service you already run.</p>
          </Link>
          <Link href="/for/creators" className="lift rounded-xl border border-line bg-white p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-forest">Creators</p>
            <p className="mt-2 text-sm">Collaboration pages and content systems that can be checked, not borrowed.</p>
          </Link>
        </div>
        <div className="mt-10 rounded-xl border border-line bg-white p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">{brand.founderRole}</p>
          <h2 className="mt-2 font-display text-2xl">{brand.founderName}</h2>
          <p className="mt-3 text-sm leading-6">{brand.founderBio}</p>
        </div>
      </div>
    </div>
  );
}
