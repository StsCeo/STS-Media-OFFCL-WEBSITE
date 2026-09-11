"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { endDemoSession } from "@/app/actions";
import { Button } from "@/components/ui";

const LIMIT_MS = 15 * 60 * 1000;
const WARN_MS = 13 * 60 * 1000;

export function InactivityGuard() {
  const router = useRouter();
  const expire = useRef<number | null>(null);
  const warn = useRef<number | null>(null);
  const [showWarn, setShowWarn] = useState(false);

  useEffect(() => {
    function clear() {
      if (expire.current) window.clearTimeout(expire.current);
      if (warn.current) window.clearTimeout(warn.current);
    }
    function arm() {
      clear();
      setShowWarn(false);
      warn.current = window.setTimeout(() => setShowWarn(true), WARN_MS);
      expire.current = window.setTimeout(() => router.push("/session-expired"), LIMIT_MS);
    }
    arm();
    const events = ["pointerdown", "keydown"];
    events.forEach((name) => window.addEventListener(name, arm));
    return () => {
      clear();
      events.forEach((name) => window.removeEventListener(name, arm));
    };
  }, [router]);

  if (!showWarn) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div role="alertdialog" aria-labelledby="idle-title" aria-describedby="idle-body" className="w-full max-w-md rounded-lg border border-line bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 id="idle-title" className="text-lg font-semibold">
          Still there?
        </h2>
        <p id="idle-body" className="mt-2 text-sm text-muted">
          This session will end in about two minutes to protect the Command Center. Continue to stay signed in, or sign out now.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event("pointerdown"));
            }}
          >
            Continue session
          </Button>
          <form action={endDemoSession}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
