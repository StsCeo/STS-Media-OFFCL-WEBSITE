import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <AuthShell title="Page not found" description="That route is not in the STS Media site or command center.">
      <Button href="/" className="w-full">Public website</Button>
      <Button href="/dashboard" variant="secondary" className="mt-3 w-full">Command Center</Button>
    </AuthShell>
  );
}
