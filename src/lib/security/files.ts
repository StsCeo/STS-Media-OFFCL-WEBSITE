export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "text/plain"] as const;
export const BLOCKED_DOCUMENT_EXTENSIONS = /\.(exe|html?|svg|js|mjs|cjs|sh|bat|cmd|com|msi|dll|php|asp|aspx|jsp|docm|xlsm|pptm|hta|ps1)$/i;

export function allowedFile(file: { name: string; type: string; size: number }) {
  const okType = (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type);
  const okName = /\.(pdf|jpe?g|png|webp|gif)$/i.test(file.name);
  return okType && okName && file.size > 0 && file.size <= MAX_UPLOAD_BYTES;
}

export function allowedDocumentFile(file: { name: string; type: string; size: number }) {
  if (BLOCKED_DOCUMENT_EXTENSIONS.test(file.name)) return false;
  const okType = (ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(file.type);
  const okName = /\.(pdf|jpe?g|png|txt)$/i.test(file.name);
  return okType && okName && file.size > 0 && file.size <= MAX_UPLOAD_BYTES;
}

export function documentUploadError(file: { name: string; type: string; size: number } | null | undefined) {
  if (!file || file.size <= 0) return "Choose a PDF, PNG, JPEG, or text file up to 8MB.";
  if (file.size > MAX_UPLOAD_BYTES) return "File is too large. Maximum size is 8MB.";
  if (!allowedDocumentFile(file)) return "Upload a PDF, PNG, JPEG, or plain text file up to 8MB.";
  return null;
}

export function safeObjectFileName(name: string) {
  const cleaned = name
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 80);
  return cleaned || "document";
}

export function sniffDocumentContentType(bytes: Uint8Array, fallbackType: string, fileName: string) {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (/\.txt$/i.test(fileName) && (fallbackType === "text/plain" || fallbackType === "" || fallbackType.startsWith("text/"))) {
    const sample = Buffer.from(bytes.slice(0, 512)).toString("utf8");
    if (/[\x00-\x08\x0e-\x1f]/.test(sample)) return null;
    return "text/plain";
  }
  return null;
}

export function uploadFileError(file: { name: string; type: string; size: number } | null | undefined) {
  if (!file || file.size <= 0) return "Choose a PDF or image up to 8MB.";
  if (file.size > MAX_UPLOAD_BYTES) return "File is too large. Maximum size is 8MB.";
  if (!allowedFile(file)) return "Upload a PDF or image up to 8MB.";
  return null;
}

export function safeUploadFileName(name: string) {
  return name.replace(/[/\\]/g, "").trim().slice(0, 180) || "receipt";
}
