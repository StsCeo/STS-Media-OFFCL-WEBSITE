"use client";

import { useActionState } from "react";
import { saveDocumentForm } from "@/app/actions";
import { Button, inputClass, textareaClass } from "@/components/ui";

type State = { error?: string; ok?: boolean };

async function action(_prev: State, formData: FormData): Promise<State> {
  return (await saveDocumentForm(formData)) ?? { ok: true };
}

export function DocumentForm() {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <input name="name" required className={inputClass} placeholder="Document name" />
      <select name="category" className={inputClass} defaultValue="other">
        <option value="contract">Contract</option>
        <option value="formation">Formation</option>
        <option value="tax">Tax</option>
        <option value="insurance">Insurance</option>
        <option value="other">Other</option>
      </select>
      <textarea name="notes" className={`${textareaClass} md:col-span-2`} placeholder="Notes" />
      <input name="file" type="file" accept="application/pdf,image/*" className="text-sm md:col-span-2" />
      {state.error ? <p className="md:col-span-2 text-sm text-danger" role="alert">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save document"}</Button>
    </form>
  );
}
