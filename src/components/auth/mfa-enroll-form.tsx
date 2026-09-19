"use client";

import { useActionState } from "react";
import { cancelMfaEnrollment, confirmMfaEnrollment, startMfaEnrollment, type MfaEnrollState } from "@/app/mfa-actions";
import { Button, Field, inputClass } from "@/components/ui";

async function startAction(prev: MfaEnrollState, formData: FormData): Promise<MfaEnrollState> {
  return startMfaEnrollment(prev, formData);
}

async function confirmAction(prev: MfaEnrollState, formData: FormData): Promise<MfaEnrollState> {
  return confirmMfaEnrollment(prev, formData);
}

async function cancelAction(prev: MfaEnrollState, formData: FormData): Promise<MfaEnrollState> {
  return cancelMfaEnrollment(prev, formData);
}

export function MfaEnrollForm() {
  const [started, startFormAction, starting] = useActionState(startAction, {});
  const [confirmed, confirmFormAction, confirming] = useActionState(confirmAction, {});
  const [cancelled, cancelFormAction, cancelling] = useActionState(cancelAction, {});

  const factorId = started.factorId;
  const qrCode = started.qrCode;
  const error = confirmed.error || cancelled.error || started.error;
  const pending = starting || confirming || cancelling;

  if (started.enrolled) {
    return (
      <p className="text-sm text-soft-gray" role="status">
        An authenticator is already enrolled for this account. Use the verification page when a code is required.
      </p>
    );
  }

  if (!factorId || !qrCode) {
    return (
      <form className="space-y-4" action={startFormAction} method="post">
        <p className="text-sm text-soft-gray">
          Scan the next screen with an authenticator app. Enrollment details stay in this session only.
        </p>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {starting ? "Starting…" : "Start enrollment"}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-soft-gray">
        Scan this code in your authenticator app, then enter a code to finish. Cancel removes the unfinished factor.
      </p>
      {/* The QR is a session-only data URL. Do not screenshot or copy it into reports. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrCode} alt="Authenticator enrollment" width={180} height={180} className="mx-auto rounded-md border border-line bg-white p-2" />
      <form className="space-y-4" action={confirmFormAction} method="post">
        <input type="hidden" name="factorId" value={factorId} />
        <Field label="Authenticator code" name="code">
          <input id="code" name="code" required inputMode="numeric" autoComplete="one-time-code" className={inputClass} />
        </Field>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {confirming ? "Verifying…" : "Finish enrollment"}
        </Button>
      </form>
      <form action={cancelFormAction} method="post">
        <input type="hidden" name="factorId" value={factorId} />
        <Button type="submit" variant="secondary" disabled={pending} className="w-full">
          {cancelling ? "Cancelling…" : "Cancel enrollment"}
        </Button>
      </form>
    </div>
  );
}
