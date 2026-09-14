"use client";

import { useActionState } from "react";
import { acceptInvitation, completePasswordReset, verifyEmailCode, verifyMfaCode } from "@/app/actions";
import { PasswordField } from "@/components/auth/password-field";
import { Button, Field, inputClass } from "@/components/ui";
import { NOT_CONFIGURED_MESSAGE } from "@/lib/auth/phase1-flows";

type AuthActionState = { error?: string; ok?: boolean };

async function resetAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  return (await completePasswordReset(formData)) ?? {};
}

async function inviteAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  return (await acceptInvitation(formData)) ?? {};
}

async function mfaAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const result = await verifyMfaCode(formData);
  return { error: result.error };
}

async function emailCodeAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  return (await verifyEmailCode(formData)) ?? {};
}

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetAction, {});
  if (state.ok) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-soft-gray" role="status">
          Password updated after a server-verified recovery session. Sign in with the new password.
        </p>
        <Button href="/login" className="w-full">
          Sign in
        </Button>
      </div>
    );
  }
  return (
    <form className="space-y-4" action={formAction} method="post">
      <PasswordField />
      <Field label="Confirm password" name="confirm">
        <input id="confirm" name="confirm" type="password" required minLength={12} autoComplete="new-password" className={inputClass} />
      </Field>
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}

export function InviteAcceptForm() {
  const [state, formAction, pending] = useActionState(inviteAction, {});
  if (state.ok) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-soft-gray" role="status">
          Invitation accepted after a server-verified token. Enroll MFA before using owner tools.
        </p>
        <Button href="/login" className="w-full">
          Sign in
        </Button>
      </div>
    );
  }
  return (
    <form className="space-y-4" action={formAction} method="post">
      <PasswordField />
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Activating…" : "Activate account"}
      </Button>
    </form>
  );
}

export function MfaVerifyForm() {
  const [state, formAction, pending] = useActionState(mfaAction, {});
  return (
    <form className="space-y-4" action={formAction} method="post">
      <Field label="Authenticator code" name="code">
        <input id="code" name="code" required inputMode="numeric" autoComplete="one-time-code" className={inputClass} />
      </Field>
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : (
        <p className="text-xs text-soft-gray">{NOT_CONFIGURED_MESSAGE}</p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        Verify
      </Button>
    </form>
  );
}

export function EmailCodeForm() {
  const [state, formAction, pending] = useActionState(emailCodeAction, {});
  return (
    <form className="space-y-4" action={formAction} method="post">
      <Field label="Email" name="email">
        <input id="email" name="email" type="email" required autoComplete="username" className={inputClass} />
      </Field>
      <Field label="Six-digit code" name="code">
        <input id="code" name="code" inputMode="numeric" maxLength={8} required autoComplete="one-time-code" className={inputClass} />
      </Field>
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        Continue
      </Button>
    </form>
  );
}
