"use server";

import { redirect } from "next/navigation";
import { assertSameOrigin } from "@/lib/security/origin";
import { GENERIC_AUTH_ERROR } from "@/lib/auth/owner";
import {
  describeMfaEnrollmentAccess,
  isRecentAuthentication,
  MFA_ENROLL_GENERIC_ERROR,
} from "@/lib/auth/mfa-enroll";
import { describeMfaAttempt, NOT_CONFIGURED_MESSAGE } from "@/lib/auth/phase1-flows";
import { createSupabaseServer, getSession } from "@/lib/auth/session";
import { isDemoModeEnabled, isSupabaseConfigured } from "@/lib/config";
import { stampAudit } from "@/lib/data/store";

export type MfaEnrollState = {
  error?: string;
  factorId?: string;
  qrCode?: string;
  enrolled?: boolean;
  cancelled?: boolean;
};

async function requireEnrollContext() {
  const factory = createSupabaseServer();
  if (!factory || !isSupabaseConfigured() || isDemoModeEnabled()) {
    return { error: NOT_CONFIGURED_MESSAGE } as const;
  }
  const supabase = await factory();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) {
    return { error: GENERIC_AUTH_ERROR } as const;
  }
  const session = await getSession();
  const authorized = session.user?.membershipStatus === "active" && Boolean(session.user.organizationId);
  const access = describeMfaEnrollmentAccess({
    signedIn: true,
    authorized,
    recentAuth: isRecentAuthentication(user.last_sign_in_at),
    demoMode: isDemoModeEnabled(),
    backendConfigured: isSupabaseConfigured(),
  });
  if (!access.allowed) {
    return { error: access.message } as const;
  }
  return { supabase, user, session } as const;
}

export async function startMfaEnrollment(
  _prev: MfaEnrollState,
  formData: FormData,
): Promise<MfaEnrollState> {
  await assertSameOrigin();
  void formData;
  const context = await requireEnrollContext();
  if ("error" in context) {
    stampAudit("mfa_enroll_rejected", "auth", "MFA enrollment rejected. No secret was logged.");
    return { error: context.error };
  }

  const { data: factors } = await context.supabase.auth.mfa.listFactors();
  const totpAll = (factors?.all ?? []).filter((factor) => factor.factor_type === "totp");
  const verified = totpAll.find((factor) => factor.status === "verified");
  const { data: assurance } = await context.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (verified && assurance?.currentLevel !== "aal2") {
    stampAudit("mfa_enroll_rejected", "auth", "MFA enrollment rejected. No secret was logged.");
    return { error: "Verify the existing authenticator before changing enrollment." };
  }
  if (verified && assurance?.currentLevel === "aal2") {
    return { enrolled: true };
  }

  const unverified = totpAll.filter((factor) => factor.status !== "verified");
  for (const factor of unverified) {
    await context.supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await context.supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "authenticator",
  });
  if (error || !data?.id || !data.totp?.qr_code) {
    stampAudit("mfa_enroll_rejected", "auth", "MFA enrollment rejected. No secret was logged.");
    return { error: MFA_ENROLL_GENERIC_ERROR };
  }
  stampAudit("mfa_enroll_started", "auth", "MFA enrollment started. No secret was logged.");
  return { factorId: data.id, qrCode: data.totp.qr_code };
}

export async function confirmMfaEnrollment(
  _prev: MfaEnrollState,
  formData: FormData,
): Promise<MfaEnrollState> {
  await assertSameOrigin();
  const context = await requireEnrollContext();
  if ("error" in context) {
    stampAudit("mfa_enroll_rejected", "auth", "MFA enrollment rejected. No secret was logged.");
    return { error: context.error };
  }
  const factorId = String(formData.get("factorId") || "");
  const code = String(formData.get("code") || "");
  const format = describeMfaAttempt({
    code,
    demoMode: isDemoModeEnabled(),
    backendConfigured: isSupabaseConfigured(),
    production: process.env.NODE_ENV === "production",
    verifiedByProvider: false,
  });
  if (!factorId || format.status === "missing" || format.status === "forged" || format.status === "invalid") {
    stampAudit("mfa_enroll_rejected", "auth", "MFA enrollment rejected. No secret was logged.");
    return { error: format.status === "missing" ? "Enter the authenticator code." : MFA_ENROLL_GENERIC_ERROR, factorId };
  }

  const { data: challenge, error: challengeError } = await context.supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) {
    stampAudit("mfa_enroll_rejected", "auth", "MFA enrollment rejected. No secret was logged.");
    return { error: MFA_ENROLL_GENERIC_ERROR, factorId };
  }
  const { error: verifyError } = await context.supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  const { data: assurance } = await context.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (verifyError || assurance?.currentLevel !== "aal2") {
    stampAudit("mfa_enroll_rejected", "auth", "MFA enrollment rejected. No secret was logged.");
    return { error: MFA_ENROLL_GENERIC_ERROR, factorId };
  }
  stampAudit("mfa_enrolled", "auth", "MFA enrollment verified. No secret was logged.");
  redirect("/dashboard");
}

export async function cancelMfaEnrollment(
  _prev: MfaEnrollState,
  formData: FormData,
): Promise<MfaEnrollState> {
  await assertSameOrigin();
  const context = await requireEnrollContext();
  if ("error" in context) {
    return { error: context.error };
  }
  const factorId = String(formData.get("factorId") || "");
  if (!factorId) {
    return {};
  }
  const { data: factors } = await context.supabase.auth.mfa.listFactors();
  const match = (factors?.all ?? []).find((factor) => factor.id === factorId);
  if (!match || match.factor_type !== "totp" || match.status === "verified") {
    stampAudit("mfa_enroll_cancel_rejected", "auth", "MFA enrollment cancel rejected. No secret was logged.");
    return { error: MFA_ENROLL_GENERIC_ERROR };
  }
  await context.supabase.auth.mfa.unenroll({ factorId });
  stampAudit("mfa_enroll_cancelled", "auth", "Unverified MFA enrollment cancelled. No secret was logged.");
  return { cancelled: true, factorId };
}
