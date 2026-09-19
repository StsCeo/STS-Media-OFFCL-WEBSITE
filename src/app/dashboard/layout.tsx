import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/shell";
import { getSession, canAccessDashboard } from "@/lib/auth/session";
import { SIDEBAR_COOKIE, THEME_COOKIE } from "@/lib/config";
import { parseTheme } from "@/lib/theme/palettes";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.status === "needs_mfa") redirect("/mfa/verify");
  if (!canAccessDashboard(session.user)) redirect("/login?next=/dashboard");
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <div data-surface="dashboard">
      <DashboardShell
        collapsedDefault={collapsed}
        theme={theme}
        demo={session.user?.source === "demo"}
        email={session.user?.email || ""}
      >
        {children}
      </DashboardShell>
    </div>
  );
}
