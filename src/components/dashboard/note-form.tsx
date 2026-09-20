"use client";

import { useActionState } from "react";
import { archiveNoteForm, saveNoteForm } from "@/app/actions";
import { Button, inputClass, textareaClass } from "@/components/ui";
import type { ClientRecord, Lead, NoteRelatedType, OwnerNote, Project, TaskItem } from "@/lib/types";

type State = { error?: string; ok?: boolean };

async function saveAction(_prev: State, formData: FormData): Promise<State> {
  return (await saveNoteForm(formData)) ?? { ok: true };
}

async function archiveAction(_prev: State, formData: FormData): Promise<State> {
  return (await archiveNoteForm(formData)) ?? { ok: true };
}

export function NoteForm({
  note,
  clients,
  projects,
  leads,
  tasks,
}: {
  note?: OwnerNote;
  clients: Pick<ClientRecord, "id" | "businessName">[];
  projects: Pick<Project, "id" | "name">[];
  leads: Pick<Lead, "id" | "businessName">[];
  tasks: Pick<TaskItem, "id" | "title">[];
}) {
  const [state, formAction, pending] = useActionState(saveAction, {});
  const [archiveState, archiveFormAction, archivePending] = useActionState(archiveAction, {});
  return (
    <div className="grid gap-3">
      <form action={formAction} className="grid gap-3">
        {note ? <input type="hidden" name="id" value={note.id} /> : null}
        <input name="title" required maxLength={160} className={inputClass} placeholder="Title" defaultValue={note?.title} />
        <textarea name="body" required maxLength={8000} className={textareaClass} placeholder="Plain text or Markdown. HTML is not rendered." defaultValue={note?.body} />
        <RelatedFields
          clients={clients}
          projects={projects}
          leads={leads}
          tasks={tasks}
          relatedType={note?.relatedType}
          relatedId={note?.relatedId}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="pinned" defaultChecked={note?.pinned} />
          Pin
        </label>
        {state.error ? <p className="text-sm text-danger" role="alert">{state.error}</p> : null}
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : note ? "Update note" : "Save note"}</Button>
      </form>
      {note ? (
        <form action={archiveFormAction}>
          <input type="hidden" name="id" value={note.id} />
          {archiveState.error ? <p className="mb-2 text-sm text-danger" role="alert">{archiveState.error}</p> : null}
          <Button type="submit" size="sm" variant="secondary" disabled={archivePending}>
            {archivePending ? "Archiving…" : "Archive"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function RelatedFields({
  clients,
  projects,
  leads,
  tasks,
  relatedType = "none",
  relatedId = null,
}: {
  clients: { id: string; businessName: string }[];
  projects: { id: string; name: string }[];
  leads: { id: string; businessName: string }[];
  tasks: { id: string; title: string }[];
  relatedType?: NoteRelatedType;
  relatedId?: string | null;
}) {
  return (
    <>
      <label className="grid gap-1 text-sm">
        <span>Related to</span>
        <select name="relatedType" className={inputClass} defaultValue={relatedType} aria-label="Related record type">
          <option value="none">Unlinked</option>
          <option value="client">Client</option>
          <option value="project">Project</option>
          <option value="lead">Lead</option>
          <option value="task">Task</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span>Related record</span>
        <select name="relatedId" className={inputClass} defaultValue={relatedId ?? ""} aria-label="Related record">
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
          <optgroup label="Leads">
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>{lead.businessName}</option>
            ))}
          </optgroup>
          <optgroup label="Tasks">
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>{task.title}</option>
            ))}
          </optgroup>
        </select>
      </label>
    </>
  );
}
