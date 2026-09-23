export type PublicEventName =
  | "hero_start_project"
  | "free_audit_click"
  | "audit_form_start"
  | "pricing_package"
  | "case_study_open"
  | "contact_click"
  | "email_click"
  | "theme_toggle"
  | "industry_selector"
  | "website_check_complete";

/** Lightweight public tracking. No third-party script and no secrets. */
export function trackPublic(name: PublicEventName, extra?: Record<string, string>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sts:public", { detail: { name, ...extra } }));
}
