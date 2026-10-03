import Link from "next/link";
import { Badge } from "@/components/ui";
import type { JourneyStep } from "@/lib/org/client-journey";

const marks: Record<JourneyStep["status"], string> = {
  complete: "✓",
  current: "●",
  pending: "○",
  future: "○",
};

export function ClientJourney({ steps }: { steps: JourneyStep[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step) => (
        <li key={step.id} className="flex items-start gap-3 rounded-md border border-line p-3">
          <span className="mt-0.5 font-mono text-sm" aria-hidden>
            {marks[step.status]}
          </span>
          <div className="min-w-0 flex-1">
            {step.href && step.status === "complete" ? (
              <Link href={step.href} className="font-medium underline-offset-2 hover:underline">
                {step.label}
              </Link>
            ) : (
              <p className="font-medium">{step.label}</p>
            )}
            <p className="text-xs text-muted">
              {step.detail || (step.status === "future" ? "Not started in this phase" : step.status === "complete" ? "Supported by a real record" : "Waiting on a supporting record")}
            </p>
          </div>
          <Badge tone={step.status === "complete" ? "success" : step.status === "current" ? "warning" : "neutral"}>
            {step.status}
          </Badge>
        </li>
      ))}
    </ol>
  );
}
