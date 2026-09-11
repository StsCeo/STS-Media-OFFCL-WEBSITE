import { siteUrl } from "@/lib/config";
import type { BrandSettings } from "@/lib/types";

export function OrganizationJsonLd({ brand }: { brand: BrandSettings }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: brand.legalName,
    alternateName: brand.shortName,
    url: siteUrl(),
    email: brand.email,
    description: brand.mission,
    slogan: brand.brandStatement,
    sameAs: [brand.instagram, brand.linkedin, brand.facebook, brand.tiktok].filter(Boolean),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
