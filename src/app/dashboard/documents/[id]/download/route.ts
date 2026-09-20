import { NextResponse } from "next/server";
import { createSupabaseServer, requireOwnerWrite, sessionOrganizationId } from "@/lib/auth/session";
import { createSignedDocumentUrl, loadWorkspaceDocument, shouldUseWorkspaceDatabase } from "@/lib/org/workspace";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireOwnerWrite();
  const { id } = await context.params;
  const organizationId = sessionOrganizationId(session.user);
  if (!organizationId || !shouldUseWorkspaceDatabase(session.user)) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const factory = createSupabaseServer();
  if (!factory) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const supabase = await factory();
  const document = await loadWorkspaceDocument(supabase, organizationId, id);
  if (!document || "error" in document || document.archived || !document.storagePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!document.storagePath.startsWith(`${organizationId}/`)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const signed = await createSignedDocumentUrl(supabase, document.storagePath, 60);
  if ("error" in signed) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  return NextResponse.redirect(signed.url, 302);
}
