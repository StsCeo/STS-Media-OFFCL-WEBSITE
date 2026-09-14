import Link from "next/link";
import type { ProcessStep } from "@/lib/types";
import { processStages } from "@/lib/content/homepage";

export function ProcessStages({ steps }: { steps: ProcessStep[] }) {
  const ordered = [...steps].sort((a, b) => a.order - b.order);
  return (
    <div>
      <div className="grid gap-px overflow-hidden bg-white/10 md:grid-cols-4">
        {processStages.map((stage) => (
          <article key={stage.number} className="bg-[#0B0D0C] p-6 md:p-8">
            <p className="font-mono text-sm text-[#C7FF3D]">{stage.number}</p>
            <h3 className="public-display mt-4 text-3xl text-[#F3EFE7] md:text-4xl">{stage.title}</h3>
            <p className="mt-4 text-sm leading-6 text-[#B8BDBA]">{stage.sentence}</p>
          </article>
        ))}
      </div>
      <details className="group border-t border-white/10 bg-[#111412] px-4 py-4 md:px-8">
        <summary className="cursor-pointer text-sm text-[#C7FF3D] marker:text-[#C7FF3D]">
          Full seven-step sequence
        </summary>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {ordered.map((step) => (
            <li key={step.id} className="border border-white/10 p-4">
              <p className="font-mono text-xs text-[#C7FF3D]">{String(step.order).padStart(2, "0")}</p>
              <p className="mt-1 font-medium text-[#F3EFE7]">{step.title}</p>
              <p className="mt-1 text-sm text-[#B8BDBA]">{step.summary}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm">
          <Link className="text-[#C7FF3D] underline-offset-4 hover:underline" href="/process">
            See the process page
          </Link>
        </p>
      </details>
    </div>
  );
}
