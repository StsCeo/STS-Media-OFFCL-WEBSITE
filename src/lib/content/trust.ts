export const REVIEW_DISCLAIMER =
  "This page describes how STS Media intends to operate. It is not legal advice, not a certified audit, and not an official policy until a qualified professional reviews it.";

export const accessibility = {
  title: "Accessibility",
  lede: "stsmedia.co is built to work with keyboard, screen readers, captions where media exists, and browser zoom. We aim to conform to WCAG 2.2 Level AA, which is the practical standard used to support ADA Title III digital access.",
  commitment: [
    {
      title: "What we aim for",
      body: "Web Content Accessibility Guidelines (WCAG) 2.2 Level AA: perceivable, operable, understandable, and robust. That includes skip links, visible focus, labeled form controls, sufficient color contrast, reduced-motion support, and text alternatives for non-text content.",
    },
    {
      title: "What we do not claim",
      body: "We do not sell an “ADA certified” badge. Accessibility is ongoing. Palettes, third-party embeds (for example Calendly, when connected), and future media can introduce new barriers. When that happens we document it and fix it.",
    },
    {
      title: "How to request an accommodation",
      body: "Email hello@stsmedia.co with the page URL, the barrier, and the assistive technology or browser you use. We will reply with a workaround or a timeline. If you need the same information in another format (large print, plain-text export), say so.",
    },
  ],
  keyboard: [
    "Tab and Shift+Tab move through interactive controls.",
    "Enter or Space activates buttons and links.",
    "Escape closes menus, the cookie notice actions, the command palette, and timeout warnings.",
    "In the Command Center, Control+K or Command+K opens jump-to search.",
    "Skip to content jumps past the header on public pages and the dashboard.",
  ],
  knownLimits: [
    "Charts in the Command Center have an accessible name; they are not yet a fully keyboard-operable data table.",
    "Calendly, when connected, is a third-party frame. Its accessibility is governed by Calendly.",
    "Demo workspace data is labeled draft and is not a production login.",
    "Color lookbook previews change brand hues; status colors (error, warning, info) stay fixed so meaning is not carried by hue alone.",
  ],
};

export const userRights = {
  title: "Your rights",
  lede: "If we hold information about you, you can ask what we have, ask us to correct it, ask us to delete it, or ask us to stop using it for outreach. We do not sell personal information.",
  collected: [
    "Contact inquiries: name, business name, email, phone if provided, service requested, message, optional file, and whether you identified as an owner, creator, or both.",
    "Essential cookies: sign-in or demo session, appearance, palette preview, and cookie-consent acknowledgment. No advertising or analytics cookies are enabled on this site today.",
    "Security logs: coarse request metadata used for rate limiting and abuse prevention. Secrets are not written to ordinary logs or localStorage.",
    "Command Center records (when Auth is live): the business data the owner enters — leads, projects, invoices, expenses — which is not the public website.",
  ],
  rights: [
    {
      title: "Know and access",
      body: "Ask whether we hold personal information about you and for a copy of what we can locate from contact forms, files, and account records.",
    },
    {
      title: "Correct",
      body: "Ask us to fix inaccurate contact details or account information.",
    },
    {
      title: "Delete",
      body: "Ask us to delete an inquiry, file, or account record we control, unless we must keep it for a legal, security, or accounting obligation. We will say if we cannot delete a specific item and why.",
    },
    {
      title: "Opt out of sale or sharing",
      body: "STS Media does not sell personal information and does not share it for cross-context behavioral advertising. If that ever changes, this page will change first.",
    },
    {
      title: "Limit use of sensitive information",
      body: "Do not send government IDs, health data, or payment card numbers through the public contact form. If sensitive data is sent by mistake, email us so we can delete it.",
    },
    {
      title: "Non-discrimination",
      body: "Exercising these rights will not change posted prices or access to public pages.",
    },
    {
      title: "Portability",
      body: "Where we hold a contact record or, later, a client-portal file list, we can export what we have in a common format such as CSV or PDF.",
    },
    {
      title: "Appeal or complain",
      body: "If you disagree with how we handled a request, say so in the same thread. You may also contact your state attorney general or, if you are in the EEA/UK, your data protection authority. This is not legal advice.",
    },
  ],
  howTo: "Email hello@stsmedia.co with the subject “Privacy request”. Include the email you used, what you want (access, correction, deletion, or opt-out), and enough detail to find the record. We will not require you to create an account to make a request. We may need to verify that we are talking to the right person.",
};

export const vulnerabilityPolicy = {
  title: "Vulnerability disclosure",
  lede: "If you find a security issue in stsmedia.co or the Command Center, tell us privately so we can fix it before it is used against clients or visitors.",
  inScope: [
    "stsmedia.co public pages and forms",
    "Command Center authentication, session handling, and server actions once Auth is connected",
    "Misconfigured headers, cookie flags, or access control that exposes another person’s data",
  ],
  outOfScope: [
    "Social engineering of staff or clients",
    "Physical attacks, DDoS, or spam against mailboxes",
    "Findings that require a compromised device, jailbreak, or malware on the victim",
    "Issues in third-party products (Calendly, Stripe, Google, Supabase platform bugs) — report those to the vendor, and you may copy us if our configuration is involved",
    "Missing best-practice headers that do not create a practical exploit, unless they weaken an existing control",
  ],
  rules: [
    "Act in good faith. Do not access, modify, or delete another person’s data.",
    "Do not run exploits against production that degrade service. A proof that a control is missing is enough.",
    "Do not include live credentials, client files, or exploit payloads that could be reused against others. Describe the issue and the affected URL or control.",
    "Give us a reasonable window to fix before public disclosure. We will acknowledge reports we can reproduce.",
    "There is no bug bounty and no paid retainer for reports at this time. We will thank researchers we can verify, and we will list a first name or handle on the acknowledgments page if you want that.",
  ],
  include: [
    "The URL or Command Center screen",
    "What you expected versus what happened",
    "Browser or tool, and whether you were signed in",
    "Impact: could someone read, change, or delete data they should not?",
    "A contact email if you want a reply",
  ],
};

export const legalBodies = {
  privacy: `${userRights.lede}

What we collect
${userRights.collected.map((line) => `• ${line}`).join("\n")}

Your rights
${userRights.rights.map((item) => `• ${item.title}: ${item.body}`).join("\n")}

How to make a request
${userRights.howTo}

${REVIEW_DISCLAIMER}`,
  terms: `These terms will govern use of stsmedia.co, quoted projects, and — when it is live — the Command Center and client portal.

Until they are reviewed: the public site is informational; project work is scoped in a written agreement after discovery; demo access is not a production credential; we do not publish invented results or prices.

${REVIEW_DISCLAIMER}`,
  cookies: `Essential cookies
• sts_demo_session or a Supabase auth cookie: keep you signed in
• sts_theme: light or dark appearance
• sts_sidebar: Command Center layout
• sts_palette_preview: temporary color-scheme preview (one hour)
• sts_cookie_consent: remembers that you acknowledged essential cookies

Analytics and marketing cookies are not enabled. There is no “accept all” because there is nothing extra to accept today.

You can delete cookies in your browser. Sign-in will stop working until you sign in again.

${REVIEW_DISCLAIMER}`,
  accessibility: `${accessibility.lede}

${accessibility.commitment.map((item) => `${item.title}\n${item.body}`).join("\n\n")}

Keyboard
${accessibility.keyboard.map((line) => `• ${line}`).join("\n")}

Known limits
${accessibility.knownLimits.map((line) => `• ${line}`).join("\n")}

Request an accommodation: hello@stsmedia.co. The operational statement also lives at /accessibility.

${REVIEW_DISCLAIMER}`,
  "client-portal": `The client portal is a design preview. Client logins, files, and invoices are not live until authentication and storage are connected.

When it is live, clients should see only their own projects, files they are allowed to download, and invoice amounts that distinguish unpaid from collected.

${REVIEW_DISCLAIMER}`,
};
