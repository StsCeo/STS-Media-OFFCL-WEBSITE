import { Button, inputClass, textareaClass } from "@/components/ui";
import { saveClientForm } from "@/app/actions";
import type { ClientRecord } from "@/lib/types";

export function ClientEditor({ client }: { client?: ClientRecord }) {
  return (
    <form action={saveClientForm} className="grid gap-3 md:grid-cols-2">
      {client ? <input type="hidden" name="id" value={client.id} /> : null}
      <input name="businessName" required className={inputClass} defaultValue={client?.businessName} placeholder="Business name" />
      <input name="contactName" className={inputClass} defaultValue={client?.contactName} placeholder="Contact name" />
      <input name="email" type="email" className={inputClass} defaultValue={client?.email} placeholder="Email" />
      <input name="phone" className={inputClass} defaultValue={client?.phone} placeholder="Phone" />
      <input name="industry" className={inputClass} defaultValue={client?.industry} placeholder="Industry" />
      <select name="status" className={inputClass} defaultValue={client?.status || "active"}>
        <option value="active">Active</option>
        <option value="paused">Paused</option>
        <option value="archived">Archived</option>
      </select>
      <textarea name="notes" className={`${textareaClass} md:col-span-2`} defaultValue={client?.notes} placeholder="Notes" />
      <p className="md:col-span-2 text-xs text-muted">Clients do not receive a login. There is no client portal.</p>
      <Button type="submit">{client ? "Save client" : "Add client"}</Button>
    </form>
  );
}
