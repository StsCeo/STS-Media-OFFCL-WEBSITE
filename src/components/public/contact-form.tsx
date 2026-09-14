"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitContact } from "@/app/actions";
import { Button, Field, inputClass, textareaClass } from "@/components/ui";

type State = { error?: string; ok?: boolean };

async function action(_prev: State, formData: FormData): Promise<State> {
  return submitContact(formData);
}

export function ContactForm({
  services,
  calendlyUrl,
  defaultAudience = "both",
  defaultService,
}: {
  services: { slug: string; name: string }[];
  calendlyUrl: string;
  defaultAudience?: "owner" | "creator" | "both";
  defaultService?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.ok) {
    return (
      <div className="rounded-xl border border-success/30 bg-white p-8 text-ink" role="status">
        <h2 className="font-display text-2xl">Message received</h2>
        <p className="mt-3 text-sm text-muted">
          Thank you. We will review this and respond using the contact method you selected. Nothing is auto-sent until the owner reviews it.
        </p>
      </div>
    );
  }
  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-line bg-white p-6 text-ink">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" name="name">
          <input id="name" name="name" required autoComplete="name" className={inputClass} aria-invalid={state.error ? true : undefined} />
        </Field>
        <Field label="Business name" name="businessName">
          <input id="businessName" name="businessName" autoComplete="organization" className={inputClass} />
        </Field>
        <Field label="Business email" name="email">
          <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
        </Field>
        <Field label="Phone" name="phone">
          <input id="phone" name="phone" autoComplete="tel" className={inputClass} />
        </Field>
        <Field label="I am" name="audience">
          <select id="audience" name="audience" className={inputClass} defaultValue={defaultAudience}>
            <option value="owner">A business owner</option>
            <option value="creator">A creator</option>
            <option value="both">Both / not sure</option>
          </select>
        </Field>
        <Field label="Service" name="service">
          <select
            id="service"
            name="service"
            required
            className={inputClass}
            defaultValue={services.find((item) => item.slug === defaultService)?.name || ""}
          >
            <option value="" disabled>
              Select a service
            </option>
            {services.map((service) => (
              <option key={service.slug} value={service.name}>
                {service.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estimated budget" name="budget">
          <select id="budget" name="budget" className={inputClass} defaultValue="">
            <option value="">Not sure yet</option>
            <option value="discovery">Need a discovery quote</option>
            <option value="maintenance">Maintenance / care</option>
            <option value="project">One-time project</option>
          </select>
        </Field>
      </div>
      <Field label="Preferred contact method" name="preferredContact">
        <select id="preferredContact" name="preferredContact" className={inputClass} defaultValue="email">
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="either">Either</option>
        </select>
      </Field>
      <Field label="How can we help?" name="message">
        <textarea id="message" name="message" required minLength={10} className={textareaClass} />
      </Field>
      <Field label="Optional file" name="file" hint="PDF or image, 8MB max. Stored privately when storage is connected.">
        <input id="file" name="file" type="file" accept="application/pdf,image/*" className="mt-1 block w-full text-sm" />
      </Field>
      <div className="hidden" aria-hidden>
        <input name="companyWebsite" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input id="consent" name="consent" type="checkbox" required className="mt-1 h-4 w-4" />
        <span>
          I agree to be contacted about this inquiry. I have read the{" "}
          <Link className="underline" href="/legal/privacy">
            privacy policy
          </Link>{" "}
          and{" "}
          <Link className="underline" href="/rights">
            my rights
          </Link>
          . Those pages are placeholders pending legal review.
        </span>
      </label>
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
      {calendlyUrl ? (
        <p className="text-sm">
          Or <a className="text-forest underline" href={calendlyUrl}>book a call on Calendly</a>.
        </p>
      ) : (
        <p className="text-sm text-muted">Calendly booking will appear here after the integration is connected. Use this form until then.</p>
      )}
    </form>
  );
}
