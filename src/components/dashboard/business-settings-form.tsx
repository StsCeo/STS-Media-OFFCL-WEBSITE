"use client";

import { useActionState } from "react";
import { saveBusinessOsSettings, type BusinessSettingsActionState } from "@/app/actions";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { COMMON_TIMEZONES, FISCAL_YEAR_MONTHS, ISO_CURRENCIES } from "@/lib/org/settings";
import type { BusinessSettingsInput } from "@/lib/org/types";

const initialState: BusinessSettingsActionState = {};

export function BusinessOsSettingsForm({
  values,
  organizationName,
}: {
  values: BusinessSettingsInput;
  organizationName: string;
}) {
  const [state, action, pending] = useActionState(saveBusinessOsSettings, initialState);

  return (
    <Card>
      <div className="mb-4">
        <h2 className="font-semibold">Organization defaults</h2>
        <p className="mt-1 text-sm text-muted">
          These values apply to {organizationName}. Changing a prefix does not rewrite historical estimates or invoices.
        </p>
      </div>
      {state.ok ? (
        <p className="mb-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success" role="status">
          Business settings saved. An audit event was recorded.
        </p>
      ) : null}
      {state.error ? (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <form action={action} className="grid gap-3 md:grid-cols-2">
        <Field label="Legal business name" name="legalName" hint="Used on future legal documents. Not an EIN.">
          <input id="legalName" name="legalName" required className={inputClass} defaultValue={values.legalName} autoComplete="organization" />
        </Field>
        <Field label="Display name" name="displayName">
          <input id="displayName" name="displayName" required className={inputClass} defaultValue={values.displayName} />
        </Field>
        <Field label="Time zone" name="timezone">
          <select id="timezone" name="timezone" className={inputClass} defaultValue={values.timezone}>
            {COMMON_TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
            {(COMMON_TIMEZONES as readonly string[]).includes(values.timezone) ? null : (
              <option value={values.timezone}>{values.timezone}</option>
            )}
          </select>
        </Field>
        <Field label="Base currency" name="baseCurrency" hint="Book currency only. No conversion engine is active.">
          <select id="baseCurrency" name="baseCurrency" className={inputClass} defaultValue={values.baseCurrency}>
            {ISO_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fiscal-year starting month" name="fiscalYearStart">
          <select id="fiscalYearStart" name="fiscalYearStart" className={inputClass} defaultValue={String(values.fiscalYearStart)}>
            {FISCAL_YEAR_MONTHS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Default payment terms" name="defaultPaymentTerms">
          <input id="defaultPaymentTerms" name="defaultPaymentTerms" required className={inputClass} defaultValue={values.defaultPaymentTerms} />
        </Field>
        <Field label="Invoice prefix" name="invoicePrefix" hint="Applies to new invoices only.">
          <input id="invoicePrefix" name="invoicePrefix" required className={inputClass} defaultValue={values.invoicePrefix} />
        </Field>
        <Field label="Estimate prefix" name="estimatePrefix" hint="Applies to new estimates only.">
          <input id="estimatePrefix" name="estimatePrefix" required className={inputClass} defaultValue={values.estimatePrefix} />
        </Field>
        <div className="md:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save business settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
