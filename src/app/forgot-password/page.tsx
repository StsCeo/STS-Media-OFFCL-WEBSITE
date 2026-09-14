import { ForgotForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/auth/shell";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot password?" description="If an invited account exists for this email, Supabase Auth will send a single-use reset link. The confirmation is the same either way.">
      <ForgotForm />
    </AuthShell>
  );
}
