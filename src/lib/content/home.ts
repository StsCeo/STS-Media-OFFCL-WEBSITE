export const homeIndustries = [
  {
    id: "auto",
    label: "Auto and collision",
    problem: "Customers cannot quickly tell what you repair, how to send photos, or how to reach the shop.",
    solution: "A clear service story, estimate path, call and map links, and a site that works on a phone in the parking lot.",
    outcome: "Visitors understand the shop and know the next step without guessing.",
    service: "Website design, development, and ongoing care",
  },
  {
    id: "beauty",
    label: "Barbers and beauty",
    problem: "The work is strong, but the site or profile does not show it cleanly or make booking obvious.",
    solution: "A focused page for services, photos you actually own, and one booking or inquiry action.",
    outcome: "People see the craft and can request a chair or appointment without hunting.",
    service: "Landing pages, content updates, and local presence",
  },
  {
    id: "food",
    label: "Food and hospitality",
    problem: "Hours, menus, and location are scattered or out of date, so guests call the wrong number or skip you.",
    solution: "A mobile-first site that keeps hours, menu, and contact in one honest place.",
    outcome: "Guests can decide and reach you from a phone in seconds.",
    service: "Website redesign, local presence, and content updates",
  },
  {
    id: "contractors",
    label: "Contractors",
    problem: "The business looks smaller online than it is on the job site, and quotes arrive as unstructured messages.",
    solution: "Service pages, project photos you can show, and a simple inquiry path.",
    outcome: "Serious inquiries arrive with enough context to reply well.",
    service: "Website strategy, lead capture, and maintenance",
  },
  {
    id: "retail",
    label: "Local retail",
    problem: "The shop is easy to love in person and hard to find or trust online.",
    solution: "A credible public presence: hours, location, what you sell, and how to visit or contact you.",
    outcome: "The website matches the storefront instead of undercutting it.",
    service: "Local presence, website design, and ongoing updates",
  },
  {
    id: "creators",
    label: "Creators and personal brands",
    problem: "Collaboration pages over-claim, or the offer is spread across too many links.",
    solution: "One page with one job, assets you have the right to use, and a reply path.",
    outcome: "Partners and fans can check the story and take the next step.",
    service: "Creator collaboration pages and content systems",
  },
] as const;

export const homeProcess = [
  {
    n: "01",
    title: "Discover",
    body: "Understand the business, audience, goals, and current digital problems.",
  },
  {
    n: "02",
    title: "Define",
    body: "Set the message, structure, scope, and visual direction.",
  },
  {
    n: "03",
    title: "Design",
    body: "Create a polished, mobile-first customer experience.",
  },
  {
    n: "04",
    title: "Build",
    body: "Develop, connect, test, and optimize the system.",
  },
  {
    n: "05",
    title: "Launch and support",
    body: "Launch with a documented handoff and keep the site healthy through ongoing care.",
  },
] as const;

export const homeServices = [
  {
    title: "Website strategy and design",
    problem: "Visitors cannot tell what you do or why they should contact you.",
    body: "Positioning, sitemap, and a visual system that matches the real business.",
    deliverables: "Offer, page map, and design direction before build.",
    href: "/services",
  },
  {
    title: "Website development",
    problem: "The design never becomes a site you can maintain.",
    body: "A real, mobile-first site in a documented environment.",
    deliverables: "Build, staging review, and launch-ready pages.",
    href: "/services",
  },
  {
    title: "Mobile optimization",
    problem: "Most customers visit from a phone and bounce when the layout fights them.",
    body: "Readable type, tappable actions, and pages that hold up on small screens.",
    deliverables: "Mobile layout, tap targets, and contact paths that work in one hand.",
    href: "/services",
  },
  {
    title: "Local business presence",
    problem: "Search and maps do not match the shop people already know.",
    body: "Profiles, categories, and details that match the real location and hours.",
    deliverables: "Google Business Profile structure and on-site NAP consistency.",
    href: "/services",
  },
  {
    title: "Lead capture and automation",
    problem: "Inquiries arrive incomplete, or they never arrive at all.",
    body: "One obvious action and a form that asks only what you need to reply.",
    deliverables: "Contact path, form fields, and owner notification when the stack is connected.",
    href: "/contact",
  },
  {
    title: "Analytics and reporting",
    problem: "Dashboards look busy but do not tell you if people inquired.",
    body: "Measurement you can trust. No inflated traffic theater.",
    deliverables: "Property setup, conversion events, and a simple view.",
    href: "/services",
  },
  {
    title: "Hosting, SSL, and maintenance",
    problem: "The site stalls after launch because nobody owns updates.",
    body: "Secure hosting, certificates, monitoring, and a care plan.",
    deliverables: "Uptime, SSL, backups, and a monthly summary when Care is active.",
    href: "/packages",
  },
  {
    title: "Content and ongoing updates",
    problem: "Services and photos change, but the site stays frozen.",
    body: "A practical way to keep copy and images honest.",
    deliverables: "In-scope edits and a path for larger changes.",
    href: "/packages",
  },
] as const;

export const homePricing = [
  {
    name: "Launch",
    price: "Starting at $599.99",
    summary: "A focused small-business website.",
    items: [
      "Up to 3 pages",
      "One revision round",
      "Mobile-friendly design",
      "Contact, call, map, and social links",
      "Basic search and analytics setup",
    ],
  },
  {
    name: "Growth",
    price: "Starting at $799.99",
    summary: "More room for proof and tools you already use.",
    items: [
      "Up to 5 pages",
      "Two revision rounds",
      "Gallery",
      "Approved testimonials",
      "One existing booking-tool integration",
      "Inquiry tracking",
    ],
  },
  {
    name: "Premium",
    price: "Starting at $999.99",
    summary: "More detailed service layouts for a fuller offer.",
    items: [
      "Up to 7 pages",
      "Two revision rounds",
      "More detailed service layouts",
      "One simple conditional inquiry form or campaign landing page",
    ],
  },
] as const;

export const homeCare = {
  name: "Ongoing maintenance",
  price: "$170/month",
  items: [
    "Standard hosting and SSL management",
    "Availability monitoring",
    "Monthly form checks",
    "Routine maintenance",
    "Backup/recovery process",
    "30 minutes of minor text or photo updates",
    "Monthly analytics and maintenance report",
    "One practical recommendation",
  ],
};

export const homeFaqs = [
  {
    q: "What types of businesses do you work with?",
    a: "Local service businesses and creators: collision and auto shops, barbers and beauty, food and hospitality, contractors, retailers, and personal brands that need a public story that can be checked.",
  },
  {
    q: "How much does a website cost?",
    a: "Homepage starting points are listed as Launch, Growth, and Premium. Final pricing depends on the agreed scope. Paid software, domains, advertising, ecommerce subscriptions, and third-party costs are separate.",
  },
  {
    q: "What is included in monthly maintenance?",
    a: "The Care plan covers hosting and SSL, monitoring, form checks, routine maintenance, backups, a small monthly edit window, a report, and one practical recommendation. Larger work is scoped separately.",
  },
  {
    q: "How long does a website project take?",
    a: "Presence-style sites are typically three to six weeks after content is collected. Landing systems are often one to three weeks. Timelines move with how quickly photos, copy, and approvals arrive.",
  },
  {
    q: "Do I own my website and domain?",
    a: "You should own the domain in your name. The site is built for you to keep. Exact ownership language belongs in the project agreement. [Confirm in the signed scope if a clause still needs legal review.]",
  },
  {
    q: "Can you redesign an existing website?",
    a: "Yes. Website redesign is an active service: audit, rewrite, and rebuild so visitors can understand who you are and how to work with you.",
  },
  {
    q: "Do you offer payment plans?",
    a: "[Policy not published yet. Ask during discovery; do not assume a plan until it is written into the quote.]",
  },
  {
    q: "Can you help with Spanish-language pages?",
    a: "[Capability not published as a packaged offer yet. If you need Spanish copy, say so in the inquiry so we can scope translation and review honestly.]",
  },
  {
    q: "Do you guarantee Google rankings?",
    a: "No. We do foundational search setup. We do not sell guaranteed rankings, invented traffic, or paid-placement theater.",
  },
  {
    q: "What happens after launch?",
    a: "You get a documented handoff. Care is available so the site does not freeze. The public site stays honest: quotes and results publish only when they are verified.",
  },
] as const;

export const trustPoints = [
  "Mobile-first builds",
  "Clear project scope",
  "Direct collaboration",
  "Ongoing website care",
  "Built for small businesses",
] as const;

export const auditDeliverables = [
  "Homepage clarity review",
  "Mobile usability check",
  "Contact-path review",
  "Trust and credibility check",
  "Local visibility observations",
  "Three recommended priorities",
] as const;

export const whySts = [
  ["Direct communication", "You work with STS Media, not a maze of account layers."],
  ["Clear expectations", "Scope is agreed before work begins."],
  ["Tailored to the business", "Design follows the real offer, not a template costume."],
  ["Care after launch", "Maintenance is available so the site stays current."],
  ["Practical recommendations", "Reports should tell you what to do next, not just look busy."],
] as const;
