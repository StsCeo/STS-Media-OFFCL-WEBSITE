import { cn } from "@/lib/utils";

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
    <div className="bg-ivory text-ink">
      <div className={cn("mx-auto px-4 py-16", wide ? "max-w-6xl" : "max-w-3xl", className)}>{children}</div>
    </div>
  );
}

export function PageKicker({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase tracking-[0.18em] text-forest">{children}</p>;
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="headline-gradient mt-3 font-display text-4xl leading-tight md:text-5xl">{children}</h1>;
}

export function PageLede({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-2xl text-base leading-7 text-muted md:text-lg">{children}</p>;
}
