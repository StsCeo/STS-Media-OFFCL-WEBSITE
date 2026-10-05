import { cn } from "@/lib/utils";

export function PublicCard({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "article" | "blockquote" | "section";
}) {
  return <Tag className={cn("public-card", className)}>{children}</Tag>;
}

export function IvoryShell({
  children,
  wide = false,
  className,
}: {
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div className="bg-canvas text-ink">
      <div className={cn("public-wrap public-page", wide ? "" : "max-w-3xl", className)}>{children}</div>
    </div>
  );
}

export function PageKicker({ children }: { children: React.ReactNode }) {
  return <p className="public-kicker">{children}</p>;
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight text-ink md:text-5xl">{children}</h1>;
}

export function PageLede({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-2xl text-base leading-7 text-muted md:text-lg">{children}</p>;
}
