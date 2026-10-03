"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button, inputClass } from "@/components/ui";
import { COMMAND_CENTER_PERIODS, type CommandCenterPeriod } from "@/lib/org/command-center";

export function CommandCenterPeriodForm({
  period,
  from,
  to,
}: {
  period: CommandCenterPeriod;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function apply(nextPeriod: string, nextFrom?: string, nextTo?: string) {
    const query = new URLSearchParams(params.toString());
    query.set("period", nextPeriod);
    if (nextPeriod === "custom" && nextFrom && nextTo) {
      query.set("from", nextFrom);
      query.set("to", nextTo);
    } else {
      query.delete("from");
      query.delete("to");
    }
    router.push(`/dashboard?${query.toString()}`);
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        apply("custom", String(data.get("from") || ""), String(data.get("to") || ""));
      }}
    >
      {COMMAND_CENTER_PERIODS.map((item) => (
        <Button
          key={item.value}
          size="sm"
          variant={period === item.value ? "primary" : "secondary"}
          onClick={() => apply(item.value, from, to)}
        >
          {item.label}
        </Button>
      ))}
      {period === "custom" || from || to ? (
        <>
          <input name="from" type="date" className={`${inputClass} w-auto`} defaultValue={from} required />
          <input name="to" type="date" className={`${inputClass} w-auto`} defaultValue={to} required />
          <Button type="submit" size="sm" variant="secondary">Apply</Button>
        </>
      ) : null}
    </form>
  );
}
