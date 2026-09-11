import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";
import { Button } from "@/components/ui";

export const metadata = { title: "Security acknowledgments" };

export default function AcknowledgmentsPage() {
  return (
    <IvoryShell>
      <PageKicker>Security</PageKicker>
      <PageTitle>Acknowledgments</PageTitle>
      <PageLede>
        Researchers we can verify, and who ask to be named, will be listed here. There are no public acknowledgments yet.
      </PageLede>
      <p className="mt-6 text-sm text-muted">
        We do not invent names to make this page look busy. A first name or handle appears only after a report is reproduced and the researcher agrees.
      </p>
      <Button href="/security/vulnerabilities" className="mt-8">
        Report a vulnerability
      </Button>
    </IvoryShell>
  );
}
