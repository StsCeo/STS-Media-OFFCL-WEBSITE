import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountantShell } from "@/components/accountant/shell";
import { canAccessAccountantCenter, canAccessDashboard, getSession } from "@/lib/auth/session";
import { THEME_COOKIE } from "@/lib/config";
import { parseTheme } from "@/lib/theme/palettes";

export const dynamic = "force-dynamic";

export default async function AccountantLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.status === "needs_mfa") redirect("/mfa/verify?next=/accountant");
  if (!session.user) redirect("/login?next=/accountant");
  if (!canAccessAccountantCenter(session.user)) redirect("/unauthorized");
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <AccountantShell
      theme={theme}
      demo={session.user.source === "demo"}
      email={session.user.email || ""}
      canOpenDashboard={canAccessDashboard(session.user)}
    >
      {children}
    </AccountantShell>
  );
}
