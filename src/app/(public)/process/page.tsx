import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Process" };

export default function ProcessPage() {
  const steps = getWorkspace().process;
  return (
    <div className="bg-ivory text-ink">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-4xl">Process</h1>
        <p className="mt-4 text-muted">A clear sequence. No mystery. No disappearing after launch.</p>
        <ol className="mt-10 space-y-6">
          {steps.map((step) => (
            <li key={step.id} className="rounded-xl border border-line bg-white p-6">
              <p className="text-xs text-gold">{String(step.order).padStart(2, "0")}</p>
              <h2 className="mt-1 font-display text-2xl">{step.title}</h2>
              <p className="mt-2 text-sm font-medium">{step.summary}</p>
              <p className="mt-2 text-sm text-muted">{step.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
