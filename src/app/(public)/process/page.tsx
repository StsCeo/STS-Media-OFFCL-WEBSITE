import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
import { ProcessStages } from "@/components/public/process-stages";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Process" };

export default function ProcessPage() {
  const steps = getWorkspace().process;
  return (
    <div className="bg-[#0B0D0C]">
      <IvoryShell>
        <PageKicker>Process</PageKicker>
        <PageTitle>A clear sequence.</PageTitle>
        <PageLede>Four public stages. The operating detail stays here so the homepage can stay visual.</PageLede>
      </IvoryShell>
      <div className="px-4 pb-20 md:px-8">
        <div className="mx-auto max-w-[1440px]">
          <ProcessStages steps={steps} />
        </div>
      </div>
      <IvoryShell>
        <ol className="space-y-4">
          {steps.map((step) => (
            <li key={step.id} className="border border-[#0B0D0C]/10 bg-white p-6">
              <p className="font-mono text-xs text-[#1B1E1C]">{String(step.order).padStart(2, "0")}</p>
              <h2 className="public-display mt-2 text-3xl">{step.title}</h2>
              <p className="mt-2 text-sm font-medium">{step.summary}</p>
              <p className="mt-2 text-sm leading-6 text-[#4f564f]">{step.detail}</p>
            </li>
          ))}
        </ol>
      </IvoryShell>
    </div>
  );
}
