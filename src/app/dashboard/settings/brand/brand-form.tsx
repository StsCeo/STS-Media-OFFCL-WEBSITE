"use client";

import { useState } from "react";
import { saveBrand } from "@/app/actions";
import { Button, Card, Field, inputClass, textareaClass } from "@/components/ui";
import type { BrandSettings } from "@/lib/types";

export function BrandForm({ brand }: { brand: BrandSettings }) {
  const [accent, setAccent] = useState(brand.accentColor);
  const [mission, setMission] = useState(brand.mission);
  const [statement, setStatement] = useState(brand.brandStatement);
  return (
    <form action={saveBrand} className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="font-semibold">Brand copy</h2>
        <div className="mt-4 space-y-3">
          <Field label="Legal name" name="legalName"><input id="legalName" name="legalName" className={inputClass} defaultValue={brand.legalName} /></Field>
          <Field label="Short name" name="shortName"><input id="shortName" name="shortName" className={inputClass} defaultValue={brand.shortName} /></Field>
          <Field label="Mission statement" name="mission"><textarea id="mission" name="mission" className={textareaClass} value={mission} onChange={(e) => setMission(e.target.value)} /></Field>
          <Field label="Brand statement" name="brandStatement"><textarea id="brandStatement" name="brandStatement" className={textareaClass} value={statement} onChange={(e) => setStatement(e.target.value)} /></Field>
          <Field label="Founder name" name="founderName"><input id="founderName" name="founderName" className={inputClass} defaultValue={brand.founderName} /></Field>
          <Field label="Founder role" name="founderRole"><input id="founderRole" name="founderRole" className={inputClass} defaultValue={brand.founderRole} /></Field>
          <Field label="Founder bio" name="founderBio"><textarea id="founderBio" name="founderBio" className={textareaClass} defaultValue={brand.founderBio} /></Field>
        </div>
      </Card>
      <div className="space-y-4">
        <Card>
          <h2 className="font-semibold">Contact and accent</h2>
          <div className="mt-4 space-y-3">
            <Field label="Email" name="email"><input id="email" name="email" className={inputClass} defaultValue={brand.email} /></Field>
            <Field label="Phone" name="phone"><input id="phone" name="phone" className={inputClass} defaultValue={brand.phone} /></Field>
            <Field label="Calendly URL" name="calendlyUrl"><input id="calendlyUrl" name="calendlyUrl" className={inputClass} defaultValue={brand.calendlyUrl} /></Field>
            <Field label="Instagram" name="instagram"><input id="instagram" name="instagram" className={inputClass} defaultValue={brand.instagram} /></Field>
            <Field label="LinkedIn" name="linkedin"><input id="linkedin" name="linkedin" className={inputClass} defaultValue={brand.linkedin} /></Field>
            <Field label="Facebook" name="facebook"><input id="facebook" name="facebook" className={inputClass} defaultValue={brand.facebook} /></Field>
            <Field label="TikTok" name="tiktok"><input id="tiktok" name="tiktok" className={inputClass} defaultValue={brand.tiktok} /></Field>
            <Field label="Brand accent color" name="accentColor">
              <input id="accentColor" name="accentColor" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" className="mt-4">Save brand settings</Button>
        </Card>
        <Card style={{ ["--brand-accent" as string]: accent }}>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Live preview</p>
          <h3 className="mt-2 font-display text-2xl">{statement}</h3>
          <p className="mt-3 text-sm">{mission}</p>
          <span className="mt-4 inline-flex h-10 items-center rounded-md px-4 text-sm text-white" style={{ background: accent }}>Start a Project</span>
        </Card>
      </div>
    </form>
  );
}
