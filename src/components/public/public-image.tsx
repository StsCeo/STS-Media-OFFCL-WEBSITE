import Image from "next/image";
import { cn } from "@/lib/utils";
import type { PublicMedia } from "@/lib/content/media";

export function PublicImage({
  media,
  className,
  sizes,
  priority = false,
  fit = "contain",
  fill = false,
}: {
  media: PublicMedia;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fit?: "contain" | "cover";
  fill?: boolean;
}) {
  const svg = media.src.endsWith(".svg");
  const fitClass = fit === "contain" ? "object-contain" : "object-cover";
  if (fill) {
    return (
      <Image
        src={media.src}
        alt={media.alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={svg}
        className={cn(fitClass, className)}
      />
    );
  }
  return (
    <Image
      src={media.src}
      alt={media.alt}
      width={media.width}
      height={media.height}
      sizes={sizes}
      priority={priority}
      unoptimized={svg}
      className={cn("h-full w-full", fitClass, className)}
    />
  );
}

export function AssetCaption({ media }: { media: PublicMedia }) {
  if (!media.placeholder) return null;
  return (
    <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-public-muted text-[#B8BDBA]">
      Replaceable placeholder · {media.recommendedFile} · {media.recommendedSize}
    </p>
  );
}
