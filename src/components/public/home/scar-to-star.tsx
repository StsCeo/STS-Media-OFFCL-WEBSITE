"use client";

import { useEffect, useId, useRef } from "react";

export function ScarToStarVisual() {
  const wrap = useRef<HTMLDivElement>(null);
  const svgId = useId();

  useEffect(() => {
    const node = wrap.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const surface = node;
    function onScroll() {
      const y = Math.min(window.scrollY / 380, 1);
      surface.style.transform = `translate3d(0, ${y * 18}px, 0)`;
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={wrap} className="public-path" aria-hidden="true">
      <p className="public-kicker">Scar to star</p>
      <p className="mt-2 text-sm leading-6 text-muted">
        A rough line becoming a clear path. That is the work: from overlooked to easy to trust.
      </p>
      <svg viewBox="0 0 280 72" fill="none" className="mt-4 text-muted">
        <path
          className="sts-path-draw"
          d="M8 52 C36 52 44 38 62 38 C78 38 82 58 108 50 C132 42 138 18 176 22 C214 26 228 48 272 14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="8" cy="52" r="3.5" fill="currentColor" className="text-ink" />
        <path
          id={svgId}
          className="sts-star-in text-ink"
          d="M264 8 l4 10 10 1.5-7.5 6.5 2 10-8.5-5-8.5 5 2-10-7.5-6.5 10-1.5z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
