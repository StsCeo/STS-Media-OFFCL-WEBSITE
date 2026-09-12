export const DEFAULT_OWNER_EMAIL = "info@stsmedia.co";

export const GENERIC_AUTH_ERROR =
  "We could not sign you in. Check the details or try another method.";

export function ownerAllowlist(): string[] {
  const fromEnv = (process.env.OWNER_EMAIL || DEFAULT_OWNER_EMAIL)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : [DEFAULT_OWNER_EMAIL];
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isAllowedOwnerEmail(email: string | null | undefined) {
  if (!email) return false;
  return ownerAllowlist().includes(normalizeEmail(email));
}
