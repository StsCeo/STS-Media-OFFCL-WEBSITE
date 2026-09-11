"use client";

import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/shell";
import { Button, Field, inputClass } from "@/components/ui";

export default function CodePage() {
  const [seconds, setSeconds] = useState(30);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <AuthShell title="Enter verification code" description="Codes expire and cannot be reused. We will not confirm whether an email has an account.">
      <form className="space-y-4" action="/login">
        <Field label="Six-digit code" name="code">
          <input id="code" name="code" inputMode="numeric" maxLength={8} required className={inputClass} />
        </Field>
        <Button type="submit" className="w-full">
          Continue
        </Button>
        <p className="text-xs text-soft-gray">
          Resend {seconds > 0 ? `available in ${seconds}s` : "available now"}. If Supabase is not configured, no code is issued — this is the complete UI for the flow.
        </p>
      </form>
    </AuthShell>
  );
}
