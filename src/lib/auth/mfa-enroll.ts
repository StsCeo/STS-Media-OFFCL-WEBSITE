const RECENT_AUTH_WINDOW_MS = 15 * 60 * 1000;

export function isRecentAuthentication(lastSignInAt: string | null | undefined, now = Date.now()) {
  if (!lastSignInAt) return false;
  const stamp = Date.parse(lastSignInAt);
  if (!Number.isFinite(stamp)) return false;
  return now - stamp <= RECENT_AUTH_WINDOW_MS;
}

export function describeMfaEnrollmentAccess(input: {
  signedIn: boolean;
  authorized: boolean;
  recentAuth: boolean;
  demoMode: boolean;
  backendConfigured: boolean;
}): { allowed: boolean; message: string } {
  if (input.demoMode || !input.backendConfigured) {
    return { allowed: false, message: "Authenticator enrollment is not available in this environment." };
  }
  if (!input.signedIn) {
    return { allowed: false, message: "Sign in to enroll an authenticator." };
  }
  if (!input.authorized) {
    return { allowed: false, message: "This account is not authorized to enroll an authenticator." };
  }
  if (!input.recentAuth) {
    return { allowed: false, message: "Sign in again to enroll an authenticator." };
  }
  return { allowed: true, message: "A verified authenticator can be added for this account." };
}

export const MFA_ENROLL_GENERIC_ERROR = "Authenticator enrollment could not be completed.";
export const MFA_RECOVERY_UNAVAILABLE =
  "Recovery codes are not issued on this path. Use a verified authenticator, cancel an unfinished enrollment, or sign in again.";
