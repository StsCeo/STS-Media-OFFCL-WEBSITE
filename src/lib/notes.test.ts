import { describe, expect, it } from "vitest";
import { resolveNoteRelationship } from "./notes";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("note relationships", () => {
  const existing = { relatedType: "project" as const, relatedId: "proj-scp" };

  it("preserves relatedType and relatedId when an update omits relationship fields", () => {
    const result = resolveNoteRelationship(form({ id: "note-1", title: "Updated title", body: "Updated body" }), existing);
    expect(result).toEqual({ relatedType: "project", relatedId: "proj-scp" });
  });

  it("replaces the relationship only when the user explicitly submits new related fields", () => {
    const result = resolveNoteRelationship(
      form({ id: "note-1", title: "Updated", body: "Body", relatedType: "client", relatedId: "client-scp" }),
      existing,
    );
    expect(result).toEqual({ relatedType: "client", relatedId: "client-scp" });
  });

  it("removes the relationship when the user explicitly selects Unlinked", () => {
    const result = resolveNoteRelationship(
      form({ id: "note-1", title: "Updated", body: "Body", relatedType: "none", relatedId: "proj-scp" }),
      existing,
    );
    expect(result).toEqual({ relatedType: "none", relatedId: null });
  });
});
