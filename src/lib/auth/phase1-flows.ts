export const NOT_CONFIGURED_MESSAGE = "Not configured";

export type AuthTokenVerdict = "not_configured" | "missing" | "invalid" | "expired" | "forged" | "ok";
export type AuthCodeVerdict = AuthTokenVerdict;

export interface AuthFlowState {
  status: AuthTokenVerdict;
  heading: string;
  message: string;
  allowForm: boolean;
}

export interface MfaAttemptResult {
  ok: boolean;
  status: AuthCodeVerdict;
  message: string;
  grantOwnerSession: false | true;
}

const STATUS_COPY: Record<Exclude<AuthTokenVerdict, "ok">, { heading: string; message: string }> = {
  not_configured: {
    heading: NOT_CONFIGURED_MESSAGE,
    message: "This sign-in step is not connected to a verified authentication backend, so it cannot be completed.",
  },
  missing: {
    heading: "Missing token",
    message: "A server-verified reset or invitation token is required. Secrets are not read from the URL.",
  },
  invalid: {
    heading: "Invalid token",
    message: "This link or code is not valid. Request a new one from a configured authentication backend.",
  },
  expired: {
    heading: "Expired token",
    message: "This link or code has expired. Request a new one from a configured authentication backend.",
  },
  forged: {
    heading: "Invalid token",
    message: "This token or code could not be verified and was rejected.",
  },
};

export function describeAuthFlowState(input: {
  backendConfigured: boolean;
  hasServerVerifiedSession: boolean;
  production?: boolean;
  presentedToken?: string | null;
  tokenExpiresAt?: number | null;
  tokenSignatureValid?: boolean | null;
  now?: number;
}): AuthFlowState {
  const now = input.now ?? Date.now();
  const token = input.presentedToken == null ? null : String(input.presentedToken).trim();

  if (!input.backendConfigured) {
    return { status: "not_configured", allowForm: false, ...STATUS_COPY.not_configured };
  }

  if (input.tokenSignatureValid === false) {
    return { status: "forged", allowForm: false, ...STATUS_COPY.forged };
  }

  if (token) {
    if (looksForgedToken(token) && input.tokenSignatureValid !== true) {
      return { status: "forged", allowForm: false, ...STATUS_COPY.forged };
    }
    if (input.tokenExpiresAt != null && input.tokenExpiresAt <= now) {
      return { status: "expired", allowForm: false, ...STATUS_COPY.expired };
    }
    if (input.tokenSignatureValid !== true && !input.hasServerVerifiedSession) {
      return { status: "invalid", allowForm: false, ...STATUS_COPY.invalid };
    }
  }

  if (!input.hasServerVerifiedSession) {
    if (token === "") return { status: "missing", allowForm: false, ...STATUS_COPY.missing };
    if (token == null) return { status: "missing", allowForm: false, ...STATUS_COPY.missing };
    return { status: "invalid", allowForm: false, ...STATUS_COPY.invalid };
  }

  return {
    status: "ok",
    heading: "Verified",
    message: "A server-verified session is present. You can finish this step without putting secrets in the URL.",
    allowForm: true,
  };
}

export function describeMfaAttempt(input: {
  code: string | null | undefined;
  demoMode: boolean;
  backendConfigured: boolean;
  production?: boolean;
  verifiedByProvider?: boolean;
  codeExpiresAt?: number | null;
  now?: number;
}): MfaAttemptResult {
  const closed = (status: Exclude<AuthCodeVerdict, "ok">): MfaAttemptResult => ({
    ok: false,
    status,
    message: status === "not_configured" ? NOT_CONFIGURED_MESSAGE : STATUS_COPY[status].heading,
    grantOwnerSession: false,
  });

  if (input.demoMode || !input.backendConfigured) {
    return closed("not_configured");
  }

  const code = input.code == null ? "" : String(input.code).trim();
  if (!code) return closed("missing");
  if (looksForgedToken(code) || /[a-z]/i.test(code) && code.includes(".")) return closed("forged");
  if (input.codeExpiresAt != null && input.codeExpiresAt <= (input.now ?? Date.now())) return closed("expired");
  if (!/^\d{6,8}$/.test(code)) return closed("invalid");
  if (!input.verifiedByProvider) return closed("invalid");

  return {
    ok: true,
    status: "ok",
    message: "Verified",
    grantOwnerSession: true,
  };
}

export function describeMfaPage(input: {
  demoMode: boolean;
  backendConfigured: boolean;
  hasProviderChallenge: boolean;
  production?: boolean;
}): AuthFlowState {
  if (input.demoMode || !input.backendConfigured || !input.hasProviderChallenge) {
    return { status: "not_configured", allowForm: false, ...STATUS_COPY.not_configured };
  }
  return {
    status: "ok",
    heading: "Verified challenge",
    message: "Enter the authenticator code for the server-side MFA challenge.",
    allowForm: true,
  };
}

export function looksForgedToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("v1.") && trimmed.split(".").length >= 3) return true;
  if (trimmed.split(".").length === 3 && trimmed.length > 40) return true;
  return false;
}

export function urlContainsAuthSecret(search: string) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return ["password", "confirm", "token", "code", "otp", "secret", "access_token", "refresh_token"].some(
    (key) => params.has(key),
  );
}
