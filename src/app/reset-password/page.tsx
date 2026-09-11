import { AuthShell } from "@/components/auth/shell";
import { Button, Field, inputClass } from "@/components/ui";

export const metadata = { title: "Create a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Create a new password" description="Choose a strong password. After it is changed, other sessions are revoked.">
      <form className="space-y-4" action="/password-changed">
        <Field label="New password" name="password">
          <input id="password" name="password" type="password" required minLength={12} className={inputClass} />
        </Field>
        <Field label="Confirm password" name="confirm">
          <input id="confirm" name="confirm" type="password" required minLength={12} className={inputClass} />
        </Field>
        <Button type="submit" className="w-full">Update password</Button>
        <p className="text-xs text-soft-gray">Requires a valid Supabase recovery token. Invalid or expired tokens are rejected.</p>
      </form>
    </AuthShell>
  );
}
