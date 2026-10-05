"use client";

import { useActionState } from "react";
import { archiveCalendarForm, saveCalendarForm } from "@/app/actions";
import { Badge, Button, inputClass, textareaClass } from "@/components/ui";
import { EVENT_KINDS, EVENT_TIMEZONES } from "@/lib/org/workspace-model";
import { scheduleSourceLabel } from "@/lib/org/schedule-model";
import type { CalendarEvent, ClientRecord, Project } from "@/lib/types";

type State = { error?: string; ok?: boolean };

async function saveAction(_prev: State, formData: FormData): Promise<State> {
  return (await saveCalendarForm(formData)) ?? { ok: true };
}

async function archiveAction(_prev: State, formData: FormData): Promise<State> {
  return (await archiveCalendarForm(formData)) ?? { ok: true };
}

function datetimeLocalValue(value?: string, allDay = false) {
  if (!value) return "";
  if (allDay) return value.slice(0, 10);
  return value.slice(0, 16);
}

export function CalendarForm({
  event,
  clients,
  projects,
}: {
  event?: CalendarEvent;
  clients: Pick<ClientRecord, "id" | "businessName">[];
  projects: Pick<Project, "id" | "name">[];
}) {
  const [state, formAction, pending] = useActionState(saveAction, {});
  const [archiveState, archiveFormAction, archivePending] = useActionState(archiveAction, {});
  const allDay = Boolean(event?.allDay);
  const generated = Boolean(event?.generated);

  if (generated && event) {
    return (
      <div className="grid gap-2 text-sm">
        <div className="flex flex-wrap gap-1">
          <Badge>System generated</Badge>
          <Badge tone="info">{scheduleSourceLabel(event.sourceType)}</Badge>
        </div>
        <p className="font-medium">{event.title}</p>
        <p className="text-muted">
          This row is linked to a same-organization source and cannot be edited as a manual event. Change the source date, title, or status, or archive the source record.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <form action={formAction} className="grid gap-3 md:grid-cols-2">
        {event ? <input type="hidden" name="id" value={event.id} /> : null}
        <input name="title" required minLength={2} maxLength={160} className={`${inputClass} md:col-span-2`} placeholder="Event title" defaultValue={event?.title} />
        <select name="kind" className={inputClass} defaultValue={event?.kind || "team_meeting"}>
          {EVENT_KINDS.map((kind) => (
            <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>
          ))}
        </select>
        <select name="timezone" className={inputClass} defaultValue={event?.timezone || "America/New_York"}>
          {EVENT_TIMEZONES.map((zone) => (
            <option key={zone} value={zone}>{zone}</option>
          ))}
        </select>
        <input name="start" required className={inputClass} type={allDay ? "date" : "datetime-local"} defaultValue={datetimeLocalValue(event?.start, allDay)} />
        <input name="end" required className={inputClass} type={allDay ? "date" : "datetime-local"} defaultValue={datetimeLocalValue(event?.end, allDay)} />
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="allDay" defaultChecked={allDay} />
          All-day event
        </label>
        <select name="clientId" className={inputClass} defaultValue={event?.clientId ?? ""} aria-label="Related client">
          <option value="">No client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.businessName}</option>
          ))}
        </select>
        <select name="projectId" className={inputClass} defaultValue={event?.projectId ?? ""} aria-label="Related project">
          <option value="">No project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        <input name="location" maxLength={240} className={`${inputClass} md:col-span-2`} placeholder="Location or meeting details (plain text)" defaultValue={event?.location} />
        <textarea name="description" maxLength={4000} className={`${textareaClass} md:col-span-2`} placeholder="Description" defaultValue={event?.notes} />
        {state.error ? <p className="md:col-span-2 text-sm text-danger" role="alert">{state.error}</p> : null}
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : event ? "Update event" : "Create event"}</Button>
      </form>
      {event ? (
        <form action={archiveFormAction}>
          <input type="hidden" name="id" value={event.id} />
          {archiveState.error ? <p className="mb-2 text-sm text-danger" role="alert">{archiveState.error}</p> : null}
          <Button type="submit" size="sm" variant="secondary" disabled={archivePending}>
            {archivePending ? "Archiving…" : "Archive"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
