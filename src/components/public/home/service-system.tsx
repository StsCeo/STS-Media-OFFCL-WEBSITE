"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { homeServices } from "@/lib/content/home";
import { ServiceConstellation } from "@/components/public/home/service-constellation";

export function ServiceSystem() {
  const base = useId();
  const [open, setOpen] = useState(0);

  return (
    <div>
      <ServiceConstellation active={open} onPick={setOpen} />
      {homeServices.map((service, index) => {
        const expanded = open === index;
        const panelId = `${base}-${index}`;
        return (
          <article key={service.title} className="service-row">
            <p className="font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</p>
            <div className="md:col-span-2">
              <h3>
                <button
                  type="button"
                  className="min-h-11 w-full text-left text-lg font-semibold tracking-tight"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setOpen(index)}
                >
                  {service.title}
                </button>
              </h3>
              <div id={panelId} hidden={!expanded}>
                <p className="mt-2 text-sm leading-6 text-muted">{service.body}</p>
                <p className="mt-2 text-sm leading-6">
                  <span className="font-medium">Problem: </span>
                  {service.problem}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">{service.deliverables}</p>
                <Link href={service.href} className="mt-3 inline-block text-sm font-medium underline-offset-4 hover:underline">
                  See related services
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
