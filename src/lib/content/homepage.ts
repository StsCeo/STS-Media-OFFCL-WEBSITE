export const homepageHero = {
  eyebrow: "Scars to Stars Media",
  headline: "From overlooked to unmissable.",
  lede: "Websites, content, and digital systems built to make growing businesses impossible to overlook.",
  primaryCta: { href: "/contact", label: "Start a Project" },
  secondaryCta: { href: "/work", label: "Explore Our Work" },
};

export const capabilityStrip = [
  "Web Design",
  "Content Systems",
  "Brand Direction",
  "Digital Growth",
  "Automation",
] as const;

export const homepageServices = [
  {
    slug: "website-design",
    title: "Website Design",
    sentence: "Custom sites built around the offer, not a template costume.",
    href: "/services#website-design-and-development",
    visual: "grid",
  },
  {
    slug: "website-redesign",
    title: "Website Redesign",
    sentence: "Replace an outdated presence with a focused, current one.",
    href: "/services#website-redesign",
    visual: "split",
  },
  {
    slug: "content-systems",
    title: "Content Systems",
    sentence: "Pages, captions, and assets you can actually publish.",
    href: "/services#social-media-content-support",
    visual: "stack",
  },
  {
    slug: "brand-direction",
    title: "Brand Direction",
    sentence: "Visual systems that feel premium without costume jewelry.",
    href: "/lookbook",
    visual: "marks",
  },
  {
    slug: "google-business",
    title: "Google Business Optimization",
    sentence: "Make the real business findable on Search and Maps.",
    href: "/services#google-business-profile",
    visual: "pin",
  },
  {
    slug: "maintenance",
    title: "Maintenance and Growth",
    sentence: "Keep the site current after launch, with a clear care path.",
    href: "/services#website-maintenance",
    visual: "orbit",
  },
] as const;

export const audiencePanels = [
  {
    href: "/for/owners",
    kicker: "01",
    title: "Business owners",
    statement: "A public presence that matches the work you already do.",
    cta: "Start a Project",
    ctaHref: "/contact?for=owners",
    visual: "owners",
  },
  {
    href: "/for/creators",
    kicker: "02",
    title: "Creators",
    statement: "Collaboration pages that hold up under a second look.",
    cta: "Start a collaboration",
    ctaHref: "/contact?for=creators",
    visual: "creators",
  },
] as const;

export const processStages = [
  {
    number: "01",
    title: "Discover",
    sentence: "Understand the offer, the audience, and what credibility has to look like.",
  },
  {
    number: "02",
    title: "Build",
    sentence: "Design and develop in a real environment you can review before launch.",
  },
  {
    number: "03",
    title: "Launch",
    sentence: "Go live with DNS, SSL, analytics, and a documented handoff.",
  },
  {
    number: "04",
    title: "Grow",
    sentence: "Keep the site current as the business earns new proof.",
  },
] as const;

export const credibilityItems = [
  "Custom-built",
  "Mobile-first",
  "Secure deployment",
  "Ongoing support",
] as const;

export const finalCta = {
  headline: "Your business already has a story.\nLet’s make people see it.",
  primaryCta: { href: "/contact", label: "Start a Project" },
  secondaryCta: { href: "/packages", label: "View Packages" },
};

export function twoLineDescription(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 160) return compact;
  const slice = compact.slice(0, 157);
  const cut = slice.lastIndexOf(" ");
  return `${slice.slice(0, cut > 80 ? cut : 157).trim()}…`;
}

export function verifiedResults(results: string[]) {
  return results.filter((line) => {
    const value = line.trim();
    if (!value) return false;
    return !/^add verified result/i.test(value);
  });
}
