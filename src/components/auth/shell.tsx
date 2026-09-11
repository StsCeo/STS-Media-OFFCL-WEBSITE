import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-obsidian text-ivory">
      <div className="px-6 py-6">
        <Logo invert href="/" />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16">
        <h1 className="font-display text-3xl">{title}</h1>
        {description ? <p className="mt-2 text-sm text-soft-gray">{description}</p> : null}
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">{children}</div>
        <p className="mt-6 text-center text-xs text-soft-gray">
          Invite-only access. Public registration is disabled. <Link href="/" className="text-gold">Back to stsmedia.co</Link>
        </p>
      </div>
    </div>
  );
}
