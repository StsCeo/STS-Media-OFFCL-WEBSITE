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
          "grid h-9 w-9 place-items-center rounded-full",
          invert ? "bg-white/10 text-lavender" : "bg-lavender text-violet",
        )}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 2.4 14.2 9h7.1l-5.8 4.2 2.2 6.8L12 16.1 6.3 20l2.2-6.8L2.7 9h7.1L12 2.4Z" />
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
