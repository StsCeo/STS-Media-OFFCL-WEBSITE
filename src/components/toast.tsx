"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

const ToastContext = createContext<{ push: (message: string, tone?: Toast["tone"]) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-md border px-4 py-3 text-sm shadow-[var(--shadow-card)] ${
              toast.tone === "error"
                ? "border-danger/30 bg-card text-danger"
                : toast.tone === "success"
                  ? "border-success/30 bg-card text-success"
                  : "border-line bg-card text-ink"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
