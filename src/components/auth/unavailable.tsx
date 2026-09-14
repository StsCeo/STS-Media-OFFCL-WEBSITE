import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui";
import { NOT_CONFIGURED_MESSAGE, type AuthFlowState } from "@/lib/auth/phase1-flows";

export function AuthFlowUnavailable({
  title,
  state,
}: {
  title: string;
  state: AuthFlowState;
}) {
  return (
    <AuthShell title={title} description={state.message}>
      <p className="text-sm text-soft-gray" role="status">
        {state.heading || NOT_CONFIGURED_MESSAGE}
      </p>
      <Button href="/login" className="mt-6 w-full">
        Return to sign in
      </Button>
    </AuthShell>
  );
}
