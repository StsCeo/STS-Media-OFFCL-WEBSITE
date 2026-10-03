import { NextResponse } from "next/server";
import {
  canAccessAccountantCenter,
  createSupabaseServer,
  getSession,
  hasAccountantReadRole,
  requireAccountantRead,
} from "@/lib/auth/session";
import {
  listAccountantExpenses,
  listAccountantInvoices,
  listAccountantRevenue,
  loadAccountantCenter,
  recordAccountantExport,
} from "@/lib/org/accountant";
import {
  accountantExportFilename,
  buildAccountantExportCsv,
  isAccountantExportType,
} from "@/lib/org/accountant-model";

export const dynamic = "force-dynamic";

function csvResponse(type: "invoices" | "revenue" | "expenses", csv: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${accountantExportFilename(type)}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ type: string }> },
) {
  const session = await getSession();
  if (!session.user) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", "/accountant");
    return NextResponse.redirect(url);
  }
  if (session.status === "needs_mfa") {
    const url = new URL("/mfa/verify", request.url);
    url.searchParams.set("next", "/accountant");
    return NextResponse.redirect(url);
  }

  try {
    const authorized = await requireAccountantRead();
    if (!hasAccountantReadRole(authorized.user) || !canAccessAccountantCenter(authorized.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await context.params;
  if (!isAccountantExportType(type)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (session.user?.source === "demo") {
    const demo = await loadAccountantCenter();
    const exported = buildAccountantExportCsv(type, demo);
    return csvResponse(type, exported.csv);
  }

  const factory = createSupabaseServer();
  if (!factory) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const supabase = await factory();
  const [invoices, expenses, revenue] = await Promise.all([
    listAccountantInvoices(supabase),
    listAccountantExpenses(supabase),
    listAccountantRevenue(supabase),
  ]);
  if ("error" in invoices || "error" in expenses || "error" in revenue) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const exported = buildAccountantExportCsv(type, { invoices, expenses, revenue });
  const recorded = await recordAccountantExport(supabase, type, exported.rowCount);
  if (!recorded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  return csvResponse(type, exported.csv);
}
