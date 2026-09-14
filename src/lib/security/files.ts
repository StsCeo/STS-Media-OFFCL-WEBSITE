export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export function allowedFile(file: { name: string; type: string; size: number }) {
  const okType = (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type);
  const okName = /\.(pdf|jpe?g|png|webp|gif)$/i.test(file.name);
  return okType && okName && file.size > 0 && file.size <= MAX_UPLOAD_BYTES;
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
