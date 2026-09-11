import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Settings" };

const links = [
  ["/dashboard/settings/brand", "Brand", "Mission, statements, accent color, social links"],
  ["/dashboard/settings/security", "Security", "Sessions, MFA, password, audit log"],
  ["/dashboard/settings/legal", "Legal pages", "Editable placeholders pending professional review"],
  ["/dashboard/integrations", "Integrations", "OAuth and quick links"],
];

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Owner-controlled brand, security, and legal copy." />
      <div className="grid gap-4 md:grid-cols-2">
        {links.map(([href, title, body]) => (
          <Link key={href} href={href}>
            <Card>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
