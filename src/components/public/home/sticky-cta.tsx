"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trackPublic } from "@/lib/analytics/public-events";

export function StickyMobileCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    function onScroll() {
      setShow(window.scrollY > 520);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;
  return (
    <div className="sts-sticky-cta md:hidden">
      <Link
        href="/contact"
        className="btn-primary inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium"
        onClick={() => trackPublic("hero_start_project", { from: "sticky" })}
      >
        Start a Project
      </Link>
    </div>
  );
}
