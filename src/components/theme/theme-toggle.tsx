"use client";

import { useState, useTransition } from "react";
import { Moon, Sun } from "lucide-react";
import { toggleTheme } from "@/app/actions";
import { applyAppearance } from "@/lib/theme/apply-appearance";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  theme,
  className,
  variant = "icon",
}: {
  theme: "light" | "dark";
  className?: string;
  variant?: "icon" | "pair";
}) {
  const [optimistic, setOptimistic] = useState<"light" | "dark" | null>(null);
  const [, start] = useTransition();
  const current = optimistic ?? theme;
  const next = current === "dark" ? "light" : "dark";

  function select(value: "light" | "dark") {
    if (value === current) return;
    setOptimistic(value);
    applyAppearance(value);
    start(() => toggleTheme(value));
  }

  if (variant === "pair") {
    return (
      <div
        role="group"
        aria-label="Appearance"
        className={cn("inline-flex rounded-full border border-line bg-canvas p-0.5", className)}
      >
        <button
          type="button"
          aria-pressed={current === "light"}
          aria-label="Day mode"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium",
            current === "light" ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
          onClick={() => select("light")}
        >
          <Sun size={14} aria-hidden />
          <span className="hidden sm:inline">Day</span>
        </button>
        <button
          type="button"
          aria-pressed={current === "dark"}
          aria-label="Night mode"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium",
            current === "dark" ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
          onClick={() => select("dark")}
        >
          <Moon size={14} aria-hidden />
          <span className="hidden sm:inline">Night</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn("rounded-md p-2 hover:bg-canvas", className)}
      aria-label={next === "dark" ? "Switch to Night mode" : "Switch to Day mode"}
      onClick={() => select(next)}
    >
      {current === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}
