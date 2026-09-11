import Link from "next/link";
import { Button } from "@/components/ui";
import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";

export const metadata = { title: "Security practices" };

const practices = [
  {
    title: "Sessions and cookies",
    body: "Sign-in and demo cookies are httpOnly, SameSite=Lax, and Secure in production. Appearance and consent cookies do not store credentials. Ordinary localStorage is not used for secrets.",
  },
  {
    title: "Same-origin writes",
    body: "Sensitive server actions check Origin or Referer against this host before they run. Cross-site form posts are rejected.",
  },
  {
    title: "Headers",
    body: "The site sends a content security policy, clickjacking denial, nosniff, a strict referrer policy, and HSTS in production. Framing Calendly is allowed only from known Calendly hosts.",
  },
  {
    title: "Uploads",
    body: "Contact uploads accept PDF and images up to 8MB. Executable types are rejected. Files are not published to the public site.",
  },
  {
    title: "Authentication (when connected)",
    body: "Supabase Auth is the production path: password, magic link, one-time code, MFA for owner and admin roles, and recovery that does not confirm whether an email exists.",
  },
  {
    title: "What is not live yet",
    body: "The labeled demo workspace is not a production credential. Client portal logins, object storage, and inbox sync wait on Auth and Phase 2 integrations.",
  },
];

export default function PublicSecurityPage() {
  return (
    <IvoryShell>
      <PageKicker>Trust</PageKicker>
      <PageTitle>How this site is built to behave.</PageTitle>
      <PageLede>
        These are engineering practices, not legal advice. Privacy, cookies, and terms in /legal are placeholders pending professional review.
      </PageLede>
      <div className="mt-10 space-y-4">
        {practices.map((item) => (
          <article key={item.title} className="rounded-xl border border-line bg-white p-5">
            <h2 className="font-medium">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
          </article>
        ))}
      </div>
      <section className="mt-8 rounded-xl border border-line bg-white p-5">
        <h2 className="font-medium">Report a vulnerability</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          If you found a security issue, use the disclosure form. Do not send exploits, credentials, or other people’s data. Coordinated disclosure is documented at /security/vulnerabilities and in{" "}
          <a className="underline" href="/.well-known/security.txt">
            /.well-known/security.txt
          </a>
          .
        </p>
        <Button href="/security/vulnerabilities" className="mt-4">
          Open the disclosure form
        </Button>
      </section>
      <p className="mt-8 text-sm text-muted">
        Security contact: hello@stsmedia.co ·{" "}
        <Link className="underline" href="/security/acknowledgments">
          Acknowledgments
        </Link>
        .
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button href="/rights" variant="secondary">
          Your rights
        </Button>
        <Button href="/accessibility" variant="secondary">
          Accessibility
        </Button>
      </div>
    </IvoryShell>
  );
}
