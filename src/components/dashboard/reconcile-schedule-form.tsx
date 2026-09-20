import { reconcileScheduleForm } from "@/app/actions";
import { Button } from "@/components/ui";

export function ReconcileScheduleForm() {
  return (
    <form action={reconcileScheduleForm} className="flex flex-wrap items-center gap-3">
      <Button type="submit" size="sm" variant="secondary">Reconcile schedule</Button>
    </form>
  );
}
