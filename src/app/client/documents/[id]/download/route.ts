import { NextResponse } from "next/server";
import { requireClientPortal, createSupabaseServer } from "@/lib/auth/session";
import { authorizeClientPortalDocument, CLIENT_PORTAL_DOCUMENT_OBJECT_RPC } from "@/lib/org/client-portal";
import { isPersistedWorkspaceId, ORG_DOCUMENTS_BUCKET } from "@/lib/org/workspace";
import { safeObjectFileName } from "@/lib/security/files";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requireClientPortal();
  const { id } = await context.params;
  if (!isPersistedWorkspaceId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const factory = createSupabaseServer();
  if (!factory) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const supabase = await factory();
  const authorized = await authorizeClientPortalDocument(supabase, id);
  if ("error" in authorized || !authorized.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const { data: objectName, error: nameError } = await service.rpc(CLIENT_PORTAL_DOCUMENT_OBJECT_RPC, { p_id: id });
  if (nameError || typeof objectName !== "string" || !objectName) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { data: file, error: downloadError } = await service.storage.from(ORG_DOCUMENTS_BUCKET).download(objectName);
  if (downloadError || !file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const filename = safeObjectFileName(authorized.title);
  const bytes = await file.arrayBuffer();
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": authorized.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
