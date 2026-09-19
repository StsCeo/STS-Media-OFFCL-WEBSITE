"use client";

import { useState, useTransition } from "react";
import { Moon, Sun } from "lucide-react";
import { toggleTheme } from "@/app/actions";
import { applyAppearance } from "@/lib/theme/apply-appearance";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  theme,
  className,
}: {
  theme: "light" | "dark";
  className?: string;
}) {
  const [optimistic, setOptimistic] = useState<"light" | "dark" | null>(null);
  const [, start] = useTransition();
  const current = optimistic ?? theme;
  const next = current === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className={cn("rounded-md p-2 hover:bg-canvas", className)}
      aria-label={next === "dark" ? "Switch to Night mode" : "Switch to Day mode"}
      onClick={() => {
        setOptimistic(next);
        applyAppearance(next);
        start(() => toggleTheme(next));
      }}
    >
      {current === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}
