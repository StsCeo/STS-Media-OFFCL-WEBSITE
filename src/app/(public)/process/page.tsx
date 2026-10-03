import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Process" };

export default function ProcessPage() {
  const steps = getWorkspace().process;
  return (
    <div className="bg-ivory text-ink">
      <div className="public-wrap max-w-3xl public-page">
        <h1 className="font-display text-4xl">Process</h1>
        <p className="mt-4 text-muted">A clear sequence. No mystery. No disappearing after launch.</p>
        <ol className="process-rail mt-10">
          {steps.map((step) => (
            <li key={step.id}>
              <p className="font-mono text-xs text-muted">{String(step.order).padStart(2, "0")}</p>
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
