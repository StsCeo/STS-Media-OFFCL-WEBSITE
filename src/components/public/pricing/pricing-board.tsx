"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import { homeCare, homePricing } from "@/lib/content/home";
import { trackPublic } from "@/lib/analytics/public-events";
import "./pricing.css";

const icons = {
  Launch: RocketIcon,
  Growth: SproutIcon,
  Premium: StarIcon,
} as const;

export function PricingBoard({
  heading = "Clear starting points. Custom scope where it matters.",
  kicker = "Introductory website packages",
  showConversation = true,
  titleAs: Title = "h2",
}: {
  heading?: string;
  kicker?: string;
  showConversation?: boolean;
  titleAs?: "h1" | "h2";
}) {
  return (
    <div className="sts-pricing">
      <p className="sts-pricing-kicker">{kicker}</p>
      <Title className="sts-pricing-title">{heading}</Title>
      <p className="sts-pricing-lede">
        Final pricing depends on the agreed scope. Paid software, domains, advertising, ecommerce subscriptions, and
        third-party costs are separate.
      </p>

      <div className="sts-pricing-grid">
        {homePricing.map((item) => {
          const featured = item.name === "Growth";
          const Icon = icons[item.name];
          return (
            <article key={item.name} className={featured ? "sts-price-card is-featured" : "sts-price-card"}>
              {featured ? <p className="sts-price-badge">More room to grow</p> : null}
              <div className="sts-price-icon" aria-hidden>
                <Icon />
              </div>
              <h3>{item.name}</h3>
              <p className="sts-price-amount">{item.price}</p>
              <p className="sts-price-summary">{item.summary}</p>
              <ul>
                {item.items.map((line) => (
                  <li key={line}>
                    <CheckIcon />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <Button
                href="/contact"
                className="sts-price-cta"
                onClick={() => trackPublic("pricing_package", { package: item.name })}
              >
                Choose {item.name}
              </Button>
            </article>
          );
        })}
      </div>

      <p className="sts-pricing-note">Client supplies copy, photos, and logo. Landing page counts toward page limit when included.</p>

      <article className="sts-pricing-care">
        <div>
          <p className="sts-pricing-kicker">Keep it working</p>
          <h3>One simple care plan.</h3>
          <p className="sts-price-amount">{homeCare.price}</p>
          <p>{homeCare.name}. Recurring maintenance begins at launch.</p>
        </div>
        <ul>
          {homeCare.items.map((line) => (
            <li key={line}>
              <CheckIcon />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <Button href="/contact?service=website-maintenance" className="sts-price-cta" variant="secondary">
          Ask about Care
        </Button>
      </article>

      {showConversation ? (
        <div className="sts-pricing-footer">
          <Button href="/packages" variant="secondary">
            Compare Packages
          </Button>
          <Link href="/contact" className="sts-pricing-link">
            Start a Conversation
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 10.2 l2.4 2.4 5.4-5.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5 c-1.5 1.26-2 5-2 5 s3.74-.5 5-2 c.71-.84.7-2.13-.09-2.91 a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15 l-3-3 a22 22 0 0 1 2-3.95 A12.88 12.88 0 0 1 22 2 c0 2.72-.78 7.5-6 11 a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12 H4 s.55-3.03 2-4 c1.62-1.08 5 0 5 0" />
      <path d="M12 15 v5 s3.03-.55 4-2 c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function SproutIcon() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M16 28 V16" />
      <path d="M16 18 C10 18 8 12 8 8 14 8 16 12 16 18z" />
      <path d="M16 20 C20 16 26 16 26 10 20 12 18 16 16 20z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" fill="currentColor">
      <path d="M16 5 l3 8 8.5 0.6-6.6 5.4 2.2 8.2L16 22.4 8.9 27.2 11.1 19 4.5 13.6 13 12.8z" />
    </svg>
  );
}
