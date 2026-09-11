import { startDemoSession } from "@/app/actions";
import { AuthShell } from "@/components/auth/shell";
import { Button, Field, inputClass } from "@/components/ui";
import { isDemoModeEnabled } from "@/lib/config";

export const metadata = { title: "MFA challenge" };

export default function MfaVerifyPage() {
  return (
    <AuthShell title="Two-factor challenge" description="Enter a code from your authenticator app. This check is enforced on the server, not only in the browser.">
      <form className="space-y-4" action={isDemoModeEnabled() ? startDemoSession : "/dashboard"}>
        <input type="hidden" name="mode" value="owner" />
        <input type="hidden" name="next" value="/dashboard" />
        <Field label="Authenticator code" name="code">
          <input id="code" name="code" required inputMode="numeric" className={inputClass} />
        </Field>
        <Button type="submit" className="w-full">Verify</Button>
      </form>
      <p className="mt-4 text-xs text-soft-gray">
        Demo mode can complete this step only because demo MFA is labeled and disabled in production. Lost authenticator? Use recovery.
      </p>
      <Button href="/mfa/recovery" variant="ghost" className="mt-2 w-full">I lost my authenticator</Button>
    </AuthShell>
  );
}
