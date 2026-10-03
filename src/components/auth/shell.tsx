import Link from "next/link";
import { cookies } from "next/headers";
import { SkipLink } from "@/components/a11y/skip-link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { THEME_COOKIE } from "@/lib/config";
import { parseTheme } from "@/lib/theme/palettes";

export async function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SkipLink href="#auth-main" />
      <div className="flex items-center justify-between px-6 py-6">
        <Logo invert={theme === "dark"} href="/" />
        <ThemeToggle theme={theme} />
      </div>
      <div id="auth-main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16">
        <h1 className="font-display text-3xl">{title}</h1>
        {description ? <p className="mt-2 text-sm text-soft-gray">{description}</p> : null}
        <div className="mt-8 rounded-xl border border-line bg-card p-6">{children}</div>
        <p className="mt-6 text-center text-xs text-soft-gray">
          <Link href="/" className="text-gold">
            Back to stsmedia.co
          </Link>
        </p>
      </div>
    </div>
  );
}
