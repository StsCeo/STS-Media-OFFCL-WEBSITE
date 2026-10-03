"use client";

import { useActionState } from "react";
import { saveDocumentForm } from "@/app/actions";
import { Button, inputClass, textareaClass } from "@/components/ui";
import type { ClientRecord, OsDocument, Project } from "@/lib/types";

type State = { error?: string; ok?: boolean };

async function action(_prev: State, formData: FormData): Promise<State> {
  return (await saveDocumentForm(formData)) ?? { ok: true };
}

export function DocumentForm({
  document,
  clients,
  projects,
}: {
  document?: OsDocument;
  clients: Pick<ClientRecord, "id" | "businessName">[];
  projects: Pick<Project, "id" | "name">[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      {document ? <input type="hidden" name="id" value={document.id} /> : null}
      <input name="name" required maxLength={180} className={inputClass} placeholder="Display name" defaultValue={document?.name} />
      <select name="category" className={inputClass} defaultValue={document?.category || "other"}>
        <option value="contract">Contract</option>
        <option value="formation">Formation</option>
        <option value="tax">Tax</option>
        <option value="insurance">Insurance</option>
        <option value="other">Other</option>
      </select>
      <select name="relatedType" className={inputClass} defaultValue={document?.relatedType || "none"} aria-label="Related record type">
        <option value="none">Unlinked</option>
        <option value="client">Client</option>
        <option value="project">Project</option>
      </select>
      <select name="relatedId" className={inputClass} defaultValue={document?.relatedId ?? ""} aria-label="Related record">
        <option value="">No linked record</option>
        <optgroup label="Clients">
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.businessName}</option>
          ))}
        </optgroup>
        <optgroup label="Projects">
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </optgroup>
      </select>
      <textarea name="notes" maxLength={2000} className={`${textareaClass} md:col-span-2`} placeholder="Description" defaultValue={document?.notes} />
      <input
        name="file"
        type="file"
        accept="application/pdf,image/png,image/jpeg,text/plain,.pdf,.png,.jpg,.jpeg,.txt"
        className="text-sm md:col-span-2"
        required={!document}
      />
      {state.error ? <p className="md:col-span-2 text-sm text-danger" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="md:col-span-2 text-sm text-success">Saved.</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : document ? "Update document" : "Upload document"}</Button>
    </form>
  );
}
