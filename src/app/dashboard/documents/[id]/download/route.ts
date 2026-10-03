import { NextResponse } from "next/server";
import { createSupabaseServer, requireOwnerWrite, sessionOrganizationId } from "@/lib/auth/session";
import { isPersistedWorkspaceId, loadWorkspaceDocument, ORG_DOCUMENTS_BUCKET, shouldUseWorkspaceDatabase } from "@/lib/org/workspace";
import { safeObjectFileName } from "@/lib/security/files";

export const dynamic = "force-dynamic";

function unavailable() {
  return NextResponse.json(
    { error: "Not found" },
    { status: 404, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireOwnerWrite();
  const { id } = await context.params;
  const organizationId = sessionOrganizationId(session.user);
  if (!organizationId || !shouldUseWorkspaceDatabase(session.user) || !isPersistedWorkspaceId(id)) {
    return unavailable();
  }
  const factory = createSupabaseServer();
  if (!factory) return unavailable();
  const supabase = await factory();
  const document = await loadWorkspaceDocument(supabase, organizationId, id);
  if (!document || "error" in document || document.archived || !document.storagePath) {
    return unavailable();
  }
  if (!document.storagePath.startsWith(`${organizationId}/`)) {
    return unavailable();
  }
  const { data: file, error } = await supabase.storage.from(ORG_DOCUMENTS_BUCKET).download(document.storagePath);
  if (error || !file) {
    return unavailable();
  }
  const bytes = await file.arrayBuffer();
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": document.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeObjectFileName(document.name)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
