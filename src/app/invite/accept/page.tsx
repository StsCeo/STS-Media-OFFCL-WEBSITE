import { AuthShell } from "@/components/auth/shell";
import { Button, Field, inputClass } from "@/components/ui";

export default function InviteAcceptPage() {
  return (
    <AuthShell title="Accept invitation" description="Set the initial password for this invited account. Public signup is not available.">
      <form className="space-y-4" action="/invite/accepted">
        <Field label="New password" name="password">
          <input id="password" name="password" type="password" required minLength={12} className={inputClass} />
        </Field>
        <Button type="submit" className="w-full">Activate account</Button>
      </form>
    </AuthShell>
  );
}
