import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  compact = false,
  invert = false,
  href = "/",
}: {
  compact?: boolean;
  invert?: boolean;
  href?: string;
}) {
  return (
    <Link href={href} aria-label="STS Media home" className={cn("group inline-flex items-center gap-3", invert ? "text-ivory" : "text-ink")}>
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-md border",
          invert ? "border-gold/40 bg-obsidian text-gold" : "border-line bg-forest text-white",
        )}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path d="M4 16h16" stroke="currentColor" strokeWidth="1.4" />
          <path d="M7 16c2.2-2.8 4-6.6 5-11 1 4.4 2.8 8.2 5 11" stroke="currentColor" strokeWidth="1.4" />
          <path d="M12 4.2 12.7 6h1.6l-1.3 1 .5 1.6L12 7.7 10.5 8.6l.5-1.6-1.3-1h1.6L12 4.2Z" fill="currentColor" />
        </svg>
      </span>
      {compact ? (
        <span className="font-display text-lg tracking-tight">STS</span>
      ) : (
        <span className="leading-tight">
          <span className="block font-display text-lg tracking-tight">STS Media</span>
          <span className={cn("block text-[11px] uppercase tracking-[0.18em]", invert ? "text-soft-gray" : "text-muted")}>
            Scars to Stars
          </span>
        </span>
      )}
    </Link>
  );
}
