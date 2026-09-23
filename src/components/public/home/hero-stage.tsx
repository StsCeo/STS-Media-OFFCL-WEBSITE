"use client";

import { useEffect, useRef } from "react";
import { DesktopSchematic, PhoneSchematic } from "@/components/public/home/device-schematic";

const STARS = [
  [18, 22],
  [46, 64],
  [72, 18],
  [108, 48],
  [142, 14],
  [178, 58],
  [214, 26],
  [248, 70],
  [276, 20],
  [310, 44],
  [338, 12],
  [88, 86],
  [196, 90],
  [260, 40],
] as const;

export function HeroStage() {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || !motion) return;
    const surface = node;
    function onMove(event: PointerEvent) {
      const box = surface.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      surface.style.setProperty("--mx", x.toFixed(3));
      surface.style.setProperty("--my", y.toFixed(3));
    }
    function onLeave() {
      surface.style.setProperty("--mx", "0");
      surface.style.setProperty("--my", "0");
    }
    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerleave", onLeave);
    return () => {
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={stage} className="sts-hero-stage">
      <svg className="sts-starfield" viewBox="0 0 360 110" aria-hidden="true">
        {STARS.map(([x, y], index) => (
          <circle
            key={`${x}-${y}`}
            className="sts-twinkle"
            cx={x}
            cy={y}
            r={index % 4 === 0 ? 1.8 : 1.1}
            fill="currentColor"
            style={{ animationDelay: `${index * 180}ms` }}
          />
        ))}
        <path
          className="sts-path-draw"
          d="M12 78 C48 78 58 42 92 48 C118 54 128 92 168 70 C204 50 216 18 268 28 C304 34 322 62 348 22"
          stroke="currentColor"
          strokeWidth="1.35"
          fill="none"
          strokeLinecap="round"
        />
        <path
          className="sts-star-in"
          d="M348 10 l5 12 13 1.8-9.5 8.2 2.6 12.4-11.1-6.2-11.1 6.2 2.6-12.4-9.5-8.2 13-1.8z"
          fill="currentColor"
        />
      </svg>
      <p className="sts-hero-stage-kicker">From overlooked to easy to trust</p>
      <div className="sts-device-stack">
        <DesktopSchematic title="stsmedia.co" caption="Original schematic — not a client screenshot." />
        <PhoneSchematic title="Mobile" caption="Phone path: one offer, one action." />
      </div>
    </div>
  );
}
