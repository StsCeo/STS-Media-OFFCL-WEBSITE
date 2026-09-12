export const ownerPath = {
  eyebrow: "For business owners",
  title: "A public presence that matches the work you already do.",
  lede: "If the shop, practice, or service is already real, the website should be too — clear offer, honest proof, and a way for the right people to reach you.",
  points: [
    {
      title: "A website that explains the business",
      body: "Positioning, pages, and a next step visitors can actually take. No template costume and no invented metrics.",
    },
    {
      title: "Systems that stay after launch",
      body: "Domains, hosting, maintenance, and a private command center so the digital side does not become a second job you never asked for.",
    },
    {
      title: "Proof only when it is verified",
      body: "Case studies and quotes publish after they are real and approved. Empty states stay empty until then.",
    },
  ],
  prepare: [
    "What you sell, who it is for, and the one action you want a visitor to take",
    "Photos or a plan to get them — we will not stock-photo your storefront",
    "Any existing domain, hosting, Google Business Profile, or analytics logins",
    "Work you are allowed to show, and work that must stay private",
  ],
};

export const creatorPath = {
  eyebrow: "For creators",
  title: "Collaboration pages and content systems that stay credible.",
  lede: "Partnerships, launches, and personal brands need a public story that can be checked. We build the page and the process — not a highlight reel of results that never happened.",
  points: [
    {
      title: "A page with one job",
      body: "Launch, collab, waitlist, or media kit. Visitors should know who you are, what the offer is, and how to reply.",
    },
    {
      title: "Assets that are easy to hand off",
      body: "Hooks, captions, and visual direction you can actually publish. We do not promise reach we cannot measure.",
    },
    {
      title: "A collaboration that looks like a business",
      body: "Brand-safe landing pages, file collection, and a clean public record of the work once it exists.",
    },
  ],
  prepare: [
    "The offer or collaboration in one sentence",
    "What you can show now versus what is still in progress",
    "Brand files, handle list, and any existing landing page to replace",
    "Who approves copy before it goes live",
  ],
};

export const faqs = [
  {
    q: "Who is STS Media for?",
    a: "Business owners who already serve people and need the public side to catch up, and creators who need collaboration pages and content systems that do not over-claim.",
  },
  {
    q: "Do you publish results and testimonials?",
    a: "Only when they are verified and approved. Until then the site says so. We do not invent quotes, traffic numbers, or revenue claims.",
  },
  {
    q: "What do packages cost?",
    a: "Packages are starting points, quoted after discovery. Pilot-client amounts are not the public rate card and are not listed as standard pricing.",
  },
  {
    q: "What is the Command Center?",
    a: "A private workspace for the owner: leads, projects, finance, content, and brand settings. It is not the public website, and it is not live until authentication is connected.",
  },
  {
    q: "Can I preview different color schemes?",
    a: "Yes. The lookbook shows original palettes, including Charcoal Blue Light. Brand Settings can save one. Preview cookies last an hour and do not change the saved brand until you save.",
  },
  {
    q: "Is there a client portal?",
    a: "The portal is designed and shown as a preview. Client logins, files, and invoices are not live until Auth and storage are connected.",
  },
  {
    q: "How do you handle my data?",
    a: "Contact forms create an inquiry for the owner to review. Uploads are limited to PDF and images. Secrets are not stored in ordinary browser storage. Legal pages are placeholders pending professional review.",
  },
  {
    q: "Can I try the dashboard?",
    a: "A labeled demo workspace exists for local exploration. Demo data is draft, not production books, and is not a production credential.",
  },
  {
    q: "Is the site accessible?",
    a: "We aim to meet WCAG 2.2 Level AA. Keyboard, skip links, labeled fields, contrast, and reduced-motion are built in. Report a barrier at /accessibility or hello@stsmedia.co. We do not claim an ADA certification badge.",
  },
  {
    q: "What rights do I have over my information?",
    a: "You can ask us to access, correct, or delete contact records we hold, and we do not sell personal information. How to request that is at /rights. Legal pages still need professional review.",
  },
  {
    q: "How do I report a security issue?",
    a: "Use /security/vulnerabilities or email hello@stsmedia.co. Describe the URL and impact. Do not send passwords, client files, or reusable exploits. There is no bug bounty at this time.",
  },
];

export const resources = [
  {
    slug: "what-to-send-before-a-website",
    audience: "Owners",
    title: "What to send before a website project",
    summary: "A practical brief so discovery is about the business, not a scavenger hunt for logins and photos.",
    body: [
      "Write the offer in one sentence: who it is for, what they get, and what happens after they inquire.",
      "List pages you actually need. A home, work, about, and contact path is enough for many businesses. Extra pages should earn their place.",
      "Gather photographs of the real place, people, and work. If you do not have them yet, say so — we will plan for it instead of filling gaps with stock.",
      "Collect domain, hosting, Google Business Profile, and analytics access, or note that they still need to be set up.",
      "Mark which projects may be shown publicly. Anything without permission stays out of the portfolio.",
    ],
  },
  {
    slug: "a-collaboration-page-that-holds-up",
    audience: "Creators",
    title: "A collaboration page that holds up",
    summary: "How to brief a launch or partnership page without borrowing someone else’s results.",
    body: [
      "Name the collaboration plainly. Visitors should know whether they are looking at a drop, a waitlist, a booking path, or a media kit.",
      "Show only assets you have the right to use. If a brand partner has not approved a lockup, it does not go on the page.",
      "Keep claims tied to what you can point to: the offer, the date, the deliverable. Reach and revenue stay off the page until they are verified.",
      "Decide the one next step: email, form, calendar, or a private link. Multiple competing buttons usually mean the offer is not finished.",
      "Plan the handoff. Who updates copy after launch, and where files live so the page does not freeze on day one.",
    ],
  },
  {
    slug: "how-we-treat-proof-and-price",
    audience: "Owners & creators",
    title: "How we treat proof, prices, and results",
    summary: "The rules this site is built on, so you know what will never be invented to look busy.",
    body: [
      "Unpaid invoices are not cash. One-time project fees are not monthly recurring revenue. The command center follows those definitions.",
      "Testimonials require a real quote and an approval before they publish. An empty testimonials page is an honest page.",
      "Case study results stay on “Add verified result” until a number is confirmed. State Collision Pro is the first public case study; it does not stand in for every future client.",
      "Pilot prices are private context, not a public rate card. Discovery comes first.",
      "Color and layout can change. The facts of the business should not have to.",
    ],
  },
];

export function resourceBySlug(slug: string) {
  return resources.find((item) => item.slug === slug);
}
