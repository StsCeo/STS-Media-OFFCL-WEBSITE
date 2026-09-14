import type { NoteRelatedType, OwnerNote } from "./types";

const RELATED_TYPES: NoteRelatedType[] = ["client", "project", "lead", "none"];

export function parseRelatedType(value: unknown, fallback: NoteRelatedType = "none"): NoteRelatedType {
  return RELATED_TYPES.includes(value as NoteRelatedType) ? (value as NoteRelatedType) : fallback;
}

export function resolveNoteRelationship(
  formData: FormData,
  existing?: Pick<OwnerNote, "relatedType" | "relatedId"> | null,
): { relatedType: NoteRelatedType; relatedId: string | null } {
  const hasType = formData.has("relatedType");
  const hasId = formData.has("relatedId");

  if (!hasType) {
    if (!existing) {
      return { relatedType: "none", relatedId: null };
    }
    const relatedType = existing.relatedType;
    const relatedId = hasId ? String(formData.get("relatedId") || "") || null : existing.relatedId;
    return {
      relatedType,
      relatedId: relatedType === "none" ? null : relatedId,
    };
  }

  const relatedType = parseRelatedType(formData.get("relatedType"), existing?.relatedType ?? "none");
  if (relatedType === "none") {
    return { relatedType: "none", relatedId: null };
  }
  if (hasId) {
    return { relatedType, relatedId: String(formData.get("relatedId") || "") || null };
  }
  return { relatedType, relatedId: existing?.relatedId ?? null };
}
