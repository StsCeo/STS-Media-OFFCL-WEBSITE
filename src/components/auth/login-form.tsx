"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { requestMagicLink, requestOtp, requestPasswordReset, signInWithPassword, startDemoSession } from "@/app/actions";
import { Button, Field, inputClass } from "@/components/ui";

type State = { error?: string; locked?: boolean };

async function passwordAction(_prev: State, formData: FormData): Promise<State> {
  return (await signInWithPassword(formData)) ?? {};
}

export function LoginForm({ next, demoEnabled, supabaseConfigured }: { next: string; demoEnabled: boolean; supabaseConfigured: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"password" | "code" | "magic">("password");
  const [state, formAction, pending] = useActionState(passwordAction, {});
  const [otpState, setOtpState] = useState<string>("");

  useEffect(() => {
    if (state.locked) router.replace("/auth/locked");
  }, [state.locked, router]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-1 rounded-md bg-black/30 p-1 text-xs" role="tablist" aria-label="Sign-in method">
        {(["password", "code", "magic"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={`rounded-md px-2 py-2 ${tab === item ? "btn-primary text-white" : "text-soft-gray"}`}
          >
            {item === "password" ? "Password" : item === "code" ? "Email code" : "Magic link"}
          </button>
        ))}
      </div>

      {tab === "password" ? (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field label="Email" name="email">
            <input id="email" name="email" type="email" required className={inputClass} autoComplete="username" />
          </Field>
          <Field label="Password" name="password">
            <input id="password" name="password" type="password" required className={inputClass} autoComplete="current-password" />
          </Field>
          {state.error ? (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-sm">
            <Link href="/forgot-password" className="text-gold">
              Forgot password?
            </Link>
          </p>
        </form>
      ) : null}

      {tab === "code" ? (
        <form
          className="space-y-4"
          action={async (formData) => {
            const result = await requestOtp(formData);
            if (result.error) setOtpState(result.error);
            else router.push(`/login/code?email=${encodeURIComponent(String(formData.get("email") || ""))}`);
          }}
        >
          <Field label="Email" name="email">
            <input id="email-code" name="email" type="email" required className={inputClass} />
          </Field>
          {otpState ? (
            <p className="text-sm text-danger" role="alert">
              {otpState}
            </p>
          ) : null}
          <Button type="submit" className="w-full">
            Send verification code
          </Button>
        </form>
      ) : null}

      {tab === "magic" ? (
        <form
          className="space-y-4"
          action={async (formData) => {
            const result = await requestMagicLink(formData);
            if (result.error) setOtpState(result.error);
            else router.push(`/login/magic-link?email=${encodeURIComponent(String(formData.get("email") || ""))}`);
          }}
        >
          <Field label="Email" name="email">
            <input id="email-magic" name="email" type="email" required className={inputClass} />
          </Field>
          <Button type="submit" className="w-full">
            Send magic link
          </Button>
        </form>
      ) : null}

      <div className="space-y-2 border-t border-white/10 pt-4 text-sm text-soft-gray">
        <p>Google sign-in: optional, needs OAuth credentials. Currently {supabaseConfigured ? "provider-ready once enabled in Supabase" : "unavailable until Supabase is configured"}.</p>
        <p>Passkeys: optional future enhancement. Not enabled.</p>
        {!supabaseConfigured ? <p>Supabase environment variables are not set. Real sign-in is paused on purpose.</p> : null}
      </div>

      {demoEnabled ? (
        <form action={startDemoSession}>
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="gold" className="w-full">
            Explore demo workspace
          </Button>
          <p className="mt-2 text-xs text-soft-gray">Development/demo only. Not a production backdoor. Disable with NEXT_PUBLIC_ENABLE_DEMO_MODE=false.</p>
        </form>
      ) : null}
    </div>
  );
}

export function ForgotForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        const result = await requestPasswordReset(formData);
        if (result.error) setError(result.error);
        else router.push("/forgot-password/sent");
      }}
    >
      <Field label="Email" name="email">
        <input id="email" name="email" type="email" required className={inputClass} />
      </Field>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full">
        Send reset link
      </Button>
    </form>
  );
}
