"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export function MagneticCta({
  href,
  children,
  eventName,
  className,
  size = "lg",
}: {
  href: string;
  children: React.ReactNode;
  eventName?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || !motion) return;
    const link = root.querySelector("a");
    if (!link) return;
    const magnet = link;
    function move(event: MouseEvent) {
      const box = magnet.getBoundingClientRect();
      const x = event.clientX - (box.left + box.width / 2);
      const y = event.clientY - (box.top + box.height / 2);
      magnet.style.transform = `translate(${x * 0.12}px, ${y * 0.18}px)`;
    }
    function leave() {
      magnet.style.transform = "";
    }
    magnet.addEventListener("mousemove", move);
    magnet.addEventListener("mouseleave", leave);
    return () => {
      magnet.removeEventListener("mousemove", move);
      magnet.removeEventListener("mouseleave", leave);
    };
  }, []);

  return (
    <span ref={ref} className="inline-flex" data-sts-event={eventName}>
      <Button href={href} size={size} className={cn(className)}>
        {children}
      </Button>
    </span>
  );
}
