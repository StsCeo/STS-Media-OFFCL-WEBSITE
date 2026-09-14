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
    <div className="public-page">
      <div className={cn("mx-auto px-4 py-16 md:px-8 md:py-24", wide ? "max-w-[1440px]" : "max-w-3xl", className)}>
        {children}
      </div>
    </div>
  );
}

export function PageKicker({ children }: { children: React.ReactNode }) {
  return <p className="public-kicker">{children}</p>;
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="public-display public-section-title mt-4 text-[#0B0D0C]">{children}</h1>;
}

export function PageLede({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-2xl text-base leading-7 text-[#4f564f] md:text-lg">{children}</p>;
}
