import Link from "next/link";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";

export function PlannedSection({
  title,
  description,
  phaseNote,
  related,
}: {
  title: string;
  description: string;
  phaseNote: string;
  related?: { href: string; label: string }[];
}) {
  return (
    <div>
      <PageHeader
        eyebrow="STS Media Business OS"
        title={title}
        description={description}
        actions={<Badge tone="info">Coming in a future phase</Badge>}
      />
      <EmptyState
        title="Planned — not implemented yet"
        body={phaseNote}
        action={
          related?.length ? (
            <div className="flex flex-wrap justify-center gap-2">
              {related.map((item) => (
                <Button key={item.href} href={item.href} variant="secondary" size="sm">
                  {item.label}
                </Button>
              ))}
            </div>
          ) : (
            <Button href="/dashboard" variant="secondary" size="sm">
              Back to Command Center
            </Button>
          )
        }
      />
      <Card className="mt-4">
        <h2 className="font-semibold">What this section will cover</h2>
        <p className="mt-2 text-sm text-muted">
          This page is an architecture placeholder. It does not calculate revenue, process payments, file taxes, run payroll, or connect third-party accounting tools.
        </p>
        {related?.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {related.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="underline-offset-2 hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
