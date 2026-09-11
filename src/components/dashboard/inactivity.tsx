"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const LIMIT_MS = 15 * 60 * 1000;

export function InactivityGuard() {
  const router = useRouter();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    function arm() {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => router.push("/session-expired"), LIMIT_MS);
    }
    arm();
    const events = ["pointerdown", "keydown", "mousemove"];
    events.forEach((name) => window.addEventListener(name, arm));
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      events.forEach((name) => window.removeEventListener(name, arm));
    };
  }, [router]);

  return null;
}
