"use client";

import { useEffect, useRef, useState } from "react";
import { homeProcess } from "@/lib/content/home";

export function ProcessTrack() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observers = refs.current.map((node, index) => {
      if (!node) return null;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) setActive(index);
        },
        { threshold: 0.6 },
      );
      observer.observe(node);
      return observer;
    });
    return () => observers.forEach((observer) => observer?.disconnect());
  }, []);

  return (
    <ol className="process-rail">
      {homeProcess.map((step, index) => (
        <li
          key={step.n}
          ref={(node) => {
            refs.current[index] = node;
          }}
          style={{ fontWeight: active === index ? 600 : 400 }}
        >
          <p className="font-mono text-xs text-muted">{step.n}</p>
          <h3 className="mt-1 font-display text-2xl tracking-tight">{step.title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
