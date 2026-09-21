import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ClientPortalShell } from "@/components/client/shell";
import {
  canAccessAccountantCenter,
  canAccessClientPortal,
  canAccessDashboard,
  getSession,
} from "@/lib/auth/session";
import { THEME_COOKIE } from "@/lib/config";
import { loadClientPortalHome } from "@/lib/org/client-portal";
import { parseTheme } from "@/lib/theme/palettes";

export const dynamic = "force-dynamic";

function ClientPortalFallback() {
  return <p className="text-sm text-muted">Loading published records…</p>;
}

export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.status === "needs_mfa") redirect("/mfa/verify?next=/client");
  if (!session.user) redirect("/login?next=/client");
  if (canAccessDashboard(session.user) || (canAccessAccountantCenter(session.user) && !canAccessClientPortal(session.user))) {
    redirect(canAccessDashboard(session.user) ? "/dashboard" : "/accountant");
  }
  if (!canAccessClientPortal(session.user)) redirect("/unauthorized");
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const data = await loadClientPortalHome();
  return (
    <ClientPortalShell
      theme={theme}
      email={session.user.email || ""}
      businessName={data.profile?.clientBusinessName || "Client portal"}
    >
      <Suspense fallback={<ClientPortalFallback />}>{children}</Suspense>
    </ClientPortalShell>
  );
}
