"use client";

import { useEffect } from "react";

export function HomeHeaderScroll() {
  useEffect(() => {
    function onScroll() {
      document.documentElement.classList.toggle("sts-header-compact", window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.documentElement.classList.remove("sts-header-compact");
    };
  }, []);
  return null;
}
