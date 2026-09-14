import { NextResponse } from "next/server";
import { canAccessDashboard, getSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data/store";
import { backupFilename, buildWorkspaceBackup } from "@/lib/export-backup";
import { stampAudit } from "@/lib/data/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!canAccessDashboard(session.user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = buildWorkspaceBackup(getWorkspace());
  stampAudit("workspace_export", "backup", "Owner downloaded a JSON workspace backup.");
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${backupFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
