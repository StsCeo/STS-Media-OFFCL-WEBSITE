import { Button } from "@/components/ui";
import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";

export const metadata = { title: "No client login" };

export default function PortalPage() {
  return (
    <IvoryShell>
      <PageKicker>How we work</PageKicker>
      <PageTitle>Clients do not sign in.</PageTitle>
      <PageLede>
        STS Media keeps one private login: the owner Command Center. There is no client portal, no client password, and no invite for customers. If you are a client or a prospect, use the contact form or email. If you are the owner, sign in below.
      </PageLede>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button href="/contact">Start a Project</Button>
        <Button href="/login" variant="secondary">
          Owner sign-in
        </Button>
      </div>
    </IvoryShell>
  );
}
