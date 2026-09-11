import { Badge, Card, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Content Studio" };

export default function ContentPage() {
  const items = getWorkspace().content;
  return (
    <div>
      <PageHeader title="Content Studio" description="Plan and preview STS Media content. Publishing APIs are not connected — nothing is claimed as posted." />
      <div className="grid gap-4 xl:grid-cols-2">
        {items.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{item.title}</h2>
              <Badge>{item.status}</Badge>
            </div>
            <p className="mt-2 text-sm"><strong>Hook:</strong> {item.hook}</p>
            <p className="text-sm"><strong>Caption:</strong> {item.caption}</p>
            <p className="text-sm"><strong>CTA:</strong> {item.cta}</p>
            <p className="mt-2 text-xs text-muted">{item.platform} · {item.pillar} · {item.campaign}</p>
            <p className="text-xs">{item.hashtags.map((tag) => `#${tag}`).join(" ")}</p>
            <Preview platform={item.platform} title={item.title} caption={item.caption} />
            {item.platform === "instagram" ? (
              <div className="mt-3 flex gap-3">
                <div className="aspect-[9/16] w-24 rounded-lg bg-obsidian p-2 text-ivory">
                  <p className="text-[10px] text-gold">Reel cover</p>
                  <p className="mt-6 text-[11px]">{item.hook}</p>
                </div>
                <div className="flex-1 rounded-lg border border-line p-3">
                  <p className="text-[10px] uppercase text-muted">Facebook / LinkedIn share card</p>
                  <p className="mt-2 text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted">{item.caption}</p>
                </div>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Preview({ platform, title, caption }: { platform: string; title: string; caption: string }) {
  if (platform === "instagram") {
    return (
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="aspect-square rounded-lg bg-obsidian p-4 text-ivory">
          <p className="text-xs text-gold">Instagram feed</p>
          <p className="mt-6 font-display text-xl">{title}</p>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square rounded bg-forest/20 text-[10px] text-muted grid place-items-center">{i === 0 ? "Cover" : ""}</div>
          ))}
        </div>
      </div>
    );
  }
  if (platform === "tiktok") {
    return <div className="mt-4 mx-auto aspect-[9/16] w-40 rounded-xl bg-obsidian p-3 text-ivory"><p className="text-xs">TikTok cover</p><p className="mt-8 text-sm">{title}</p></div>;
  }
  return (
    <div className="mt-4 rounded-lg border border-line p-4">
      <p className="text-xs uppercase text-muted">{platform} preview</p>
      <p className="mt-2 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{caption}</p>
    </div>
  );
}
