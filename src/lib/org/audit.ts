const FORBIDDEN_KEY =
  /(password|passwd|token|secret|ssn|ein|itin|cvv|cvc|pan|card|bank|routing|iban|swift|account_number|access_token|refresh_token|api[_-]?key|authorization|credential|private_key|session|cookie)/i;

const FORBIDDEN_VALUE =
  /(password|secret|token|ssn|ein|cvv|card number|routing number|account number|authorization:\s*bearer)/i;

export function sanitizeAuditMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (FORBIDDEN_KEY.test(key)) continue;
    if (typeof value === "string" && FORBIDDEN_VALUE.test(value)) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeAuditMetadata(value);
      continue;
    }
    if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === "object" ? sanitizeAuditMetadata(item) : typeof item === "string" && FORBIDDEN_VALUE.test(item) ? "[redacted]" : item,
      );
      continue;
    }
    result[key] = value;
  }
  return result;
}

export function auditResultMetadata(result: "success" | "failure" | "denied", extra: Record<string, unknown> = {}) {
  return sanitizeAuditMetadata({
    result,
    ...extra,
  });
}
