import { siteUrl } from "@/lib/config";

export function GET() {
  const body = [
    `Contact: mailto:hello@stsmedia.co`,
    `Expires: 2027-09-11T00:00:00.000Z`,
    `Preferred-Languages: en`,
    `Canonical: ${siteUrl()}/.well-known/security.txt`,
    `Policy: ${siteUrl()}/security`,
    `Hiring: ${siteUrl()}/contact`,
  ].join("\n");

  return new Response(`${body}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
