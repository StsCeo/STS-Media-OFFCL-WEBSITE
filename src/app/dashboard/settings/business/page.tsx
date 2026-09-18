import { Button, Card, Field, PageHeader, inputClass, textareaClass } from "@/components/ui";
import { BusinessOsSettingsForm } from "@/components/dashboard/business-settings-form";
import { saveBusinessProfile } from "@/app/actions";
import { getWorkspace } from "@/lib/data/store";
import { centsToDollars } from "@/lib/money";
import { DEMO_ORGANIZATION_ID } from "@/lib/org/defaults";
import { getOrganization, getOrganizationSettings } from "@/lib/org/store";

export const metadata = { title: "Business Settings" };

export default function BusinessSettingsPage() {
  const profile = getWorkspace().businessProfile;
  const organization = getOrganization(DEMO_ORGANIZATION_ID);
  const settings = getOrganizationSettings(DEMO_ORGANIZATION_ID);

  return (
    <div>
      <PageHeader
        eyebrow="STS Media Business OS"
        title="Business Settings"
        description="Organization identity and document defaults. An EIN, Social Security number, and banking credentials are not collected."
      />

      {organization && settings ? (
        <div className="mb-6">
          <BusinessOsSettingsForm
            organizationName={organization.displayName}
            values={{
              legalName: organization.legalName,
              displayName: organization.displayName,
              timezone: organization.timezone,
              baseCurrency: organization.baseCurrency,
              fiscalYearStart: organization.fiscalYearStart,
              invoicePrefix: settings.invoicePrefix,
              estimatePrefix: settings.estimatePrefix,
              defaultPaymentTerms: settings.defaultPaymentTerms,
            }}
          />
        </div>
      ) : (
        <Card className="mb-6">
          <h2 className="font-semibold">Organization not provisioned</h2>
          <p className="mt-2 text-sm text-muted">
            Apply the Day 1 organization migration and create the first owner membership before using production persistence. The demo workspace includes a local organization foundation.
          </p>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold">Phase 1 operating profile</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Additional owner-only defaults from the existing Command Center. These fields stay available and do not store an EIN.
        </p>
        <form action={saveBusinessProfile} className="grid gap-3 md:grid-cols-2">
          <Field label="Legal name" name="legalName">
            <input id="phase1-legalName" name="legalName" className={inputClass} defaultValue={profile.legalName} />
          </Field>
          <Field label="DBA" name="dba">
            <input id="dba" name="dba" className={inputClass} defaultValue={profile.dba} />
          </Field>
          <Field label="Entity type" name="entityType">
            <select id="entityType" name="entityType" className={inputClass} defaultValue={profile.entityType}>
              <option value="llc">LLC</option>
              <option value="sole_prop">Sole proprietorship</option>
              <option value="c_corp">C corporation</option>
              <option value="s_corp">S corporation</option>
              <option value="nonprofit">Nonprofit</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Federal classification" name="federalClassification" hint="Recorded only. A professional must confirm the classification.">
            <select id="federalClassification" name="federalClassification" className={inputClass} defaultValue={profile.federalClassification}>
              <option value="tbd">TBD</option>
              <option value="disregarded_entity">Disregarded entity</option>
              <option value="partnership">Partnership</option>
              <option value="c_corp">C corporation</option>
              <option value="s_corp">S corporation</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Formation state" name="formationState">
            <input id="formationState" name="formationState" className={inputClass} defaultValue={profile.formationState} />
          </Field>
          <Field label="Accounting method" name="accountingMethod">
            <select id="accountingMethod" name="accountingMethod" className={inputClass} defaultValue={profile.accountingMethod}>
              <option value="cash">Cash</option>
              <option value="accrual">Accrual</option>
            </select>
          </Field>
          <Field label="Fiscal year" name="fiscalYearType">
            <select id="fiscalYearType" name="fiscalYearType" className={inputClass} defaultValue={profile.fiscalYearType}>
              <option value="calendar">Calendar year</option>
              <option value="fiscal">Fiscal year</option>
            </select>
          </Field>
          <Field label="Fiscal year start month" name="fiscalYearStartMonth">
            <input id="fiscalYearStartMonth" name="fiscalYearStartMonth" type="number" min={1} max={12} className={inputClass} defaultValue={profile.fiscalYearStartMonth} />
          </Field>
          <Field label="Timezone" name="timezone">
            <input id="phase1-timezone" name="timezone" className={inputClass} defaultValue={profile.timezone} />
          </Field>
          <Field label="Currency" name="currency">
            <input id="currency" name="currency" className={inputClass} defaultValue={profile.currency} />
          </Field>
          <Field label="Website" name="website">
            <input id="website" name="website" className={inputClass} defaultValue={profile.website} />
          </Field>
          <Field label="Public email" name="publicEmail">
            <input id="publicEmail" name="publicEmail" className={inputClass} defaultValue={profile.publicEmail} />
          </Field>
          <p className="md:col-span-2 text-sm">
            Owner login is configured with the <span className="font-mono">OWNER_EMAIL</span> allowlist, not this form.
          </p>
          <Field label="Tax reserve percent" name="taxReservePercent" hint="Owner-entered. Not calculated tax due.">
            <input id="taxReservePercent" name="taxReservePercent" type="number" step="0.1" className={inputClass} defaultValue={profile.taxReservePercent} />
          </Field>
          <Field label="Reserved tax amount (USD)" name="reservedTaxAmount">
            <input id="reservedTaxAmount" name="reservedTaxAmount" type="number" step="0.01" className={inputClass} defaultValue={centsToDollars(profile.reservedTaxAmountCents)} />
          </Field>
          <Field label="Invoice number format" name="invoiceNumberFormat">
            <input id="invoiceNumberFormat" name="invoiceNumberFormat" className={inputClass} defaultValue={profile.invoiceNumberFormat} />
          </Field>
          <Field label="Default payment terms" name="defaultPaymentTerms">
            <input id="phase1-defaultPaymentTerms" name="defaultPaymentTerms" className={inputClass} defaultValue={profile.defaultPaymentTerms} />
          </Field>
          <Field label="Default deposit percent" name="defaultDepositPercent">
            <input id="defaultDepositPercent" name="defaultDepositPercent" type="number" className={inputClass} defaultValue={profile.defaultDepositPercent} />
          </Field>
          <Field label="S-corp status" name="sCorpStatus" hint={profile.sCorpNotes}>
            <select id="sCorpStatus" name="sCorpStatus" className={inputClass} defaultValue={profile.sCorpStatus}>
              <option value="not_elected">Not elected</option>
              <option value="elected">Elected</option>
              <option value="undecided">Undecided</option>
            </select>
          </Field>
          <Field label="Notes" name="notes">
            <textarea id="notes" name="notes" className={textareaClass} defaultValue={profile.notes} />
          </Field>
          <p className="md:col-span-2 text-xs text-muted">EIN is never stored in this system.</p>
          <Button type="submit">Save operating profile</Button>
        </form>
      </Card>
    </div>
  );
}
