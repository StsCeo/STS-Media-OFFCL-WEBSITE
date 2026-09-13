import { DEMO_SESSION_MAX_AGE_SECONDS } from "@/lib/config";

const TOKEN_VERSION = "v1";
const MIN_SECRET_LENGTH = 32;

export type DemoSessionMode = "owner" | "needs_mfa";

export interface DemoSessionPayload {
  mode: DemoSessionMode;
  iat: number;
  exp: number;
}

export interface DemoSessionCryptoOptions {
  now?: number;
  secret?: string | null;
  maxAgeMs?: number;
}

export function getDemoSessionSecret(): string | null {
  const secret = process.env.DEMO_SESSION_SECRET?.trim() ?? "";
  if (secret.length < MIN_SECRET_LENGTH) return null;
  return secret;
}

export function isDemoSessionConfigured() {
  return Boolean(getDemoSessionSecret());
}

export function demoSessionCookieOptions(maxAgeSeconds = DEMO_SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function signDemoSession(
  mode: DemoSessionMode,
  options: DemoSessionCryptoOptions = {},
): Promise<string> {
  const secret = options.secret === undefined ? getDemoSessionSecret() : options.secret;
  if (!secret) {
    throw new Error("Demo session is not available.");
  }
  if (mode !== "owner" && mode !== "needs_mfa") {
    throw new Error("Demo session is not available.");
  }

  const now = options.now ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? DEMO_SESSION_MAX_AGE_SECONDS * 1000;
  const payload: DemoSessionPayload = {
    mode,
    iat: now,
    exp: now + maxAgeMs,
  };
  const payloadPart = utf8ToBase64Url(JSON.stringify(payload));
  const signature = await hmacSha256(secret, signingInput(payloadPart));
  return `${TOKEN_VERSION}.${payloadPart}.${bytesToBase64Url(signature)}`;
}

export async function verifyDemoSession(
  value: string | undefined | null,
  options: DemoSessionCryptoOptions = {},
): Promise<DemoSessionPayload | null> {
  const secret = options.secret === undefined ? getDemoSessionSecret() : options.secret;
  if (!value || !secret) return null;

  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [version, payloadPart, signaturePart] = parts;
  if (version !== TOKEN_VERSION || !payloadPart || !signaturePart) return null;

  let provided: Uint8Array;
  try {
    provided = base64UrlToBytes(signaturePart);
  } catch {
    return null;
  }

  const expected = await hmacSha256(secret, signingInput(payloadPart));
  if (!timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlToUtf8(payloadPart)) as DemoSessionPayload;
    const now = options.now ?? Date.now();
    if (payload.mode !== "owner" && payload.mode !== "needs_mfa") return null;
    if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)) return null;
    if (payload.exp <= now) return null;
    if (payload.iat > now + 60_000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function unsignedDemoCookieValues() {
  return ["owner", "needs_mfa"] as const;
}

function signingInput(payloadPart: string) {
  return `${TOKEN_VERSION}.${payloadPart}`;
}

async function hmacSha256(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.byteLength !== b.byteLength) return false;
  let different = 0;
  for (let i = 0; i < a.byteLength; i += 1) different |= a[i] ^ b[i];
  return different === 0;
}

function utf8ToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToUtf8(value: string) {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
