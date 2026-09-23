import { homeFaqs } from "@/lib/content/home";

export function HomeFaq() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: homeFaqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a.replace(/\[|\]/g, "") },
    })),
  };
  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <dl>
        {homeFaqs.map((item) => (
          <div key={item.q} className="border-t border-line pt-5">
            <dt className="font-medium">{item.q}</dt>
            <dd className="mt-2 text-sm leading-6 text-muted">{item.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
