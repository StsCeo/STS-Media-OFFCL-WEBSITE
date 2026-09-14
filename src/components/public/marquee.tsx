"use client";

import { capabilityStrip } from "@/lib/content/homepage";

export function CapabilityMarquee() {
  const items = [...capabilityStrip, ...capabilityStrip];
  return (
    <div className="public-marquee" aria-label="Capabilities">
      <div className="public-marquee-track">
        {items.map((item, index) => (
          <span className="public-marquee-item" key={`${item}-${index}`}>
            <span>{item}</span>
            <span className="public-marquee-dot" aria-hidden="true">
              ✦
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
