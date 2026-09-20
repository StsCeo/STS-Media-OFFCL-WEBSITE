import { Card, PageHeader } from "@/components/ui";
import { NoteForm } from "@/components/dashboard/note-form";
import { loadVisibleWorkspaceRecords } from "@/lib/org/workspace-context";

export const metadata = { title: "Notes" };

export default async function NotesPage() {
  const { notes, clients, projects, leads, tasks, source, unavailable, recordNote } = await loadVisibleWorkspaceRecords();
  return (
    <div>
      <PageHeader title="Notes" description="Organization notes for clients, leads, projects, and tasks. HTML is stripped and never rendered." />
      {unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">Notes could not be loaded from the database. Nothing was written to a local fallback.</p>
        </Card>
      ) : null}
      {source === "postgres" ? <p className="mb-4 text-xs text-muted">{recordNote}</p> : null}
      <Card id="add" className="mb-6">
        <h2 className="mb-4 font-semibold">Add note</h2>
        <NoteForm clients={clients} projects={projects} leads={leads} tasks={tasks} />
      </Card>
      <div className="grid gap-4">
        {notes.map((note) => (
          <Card key={note.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{note.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm">{note.body}</p>
                <p className="mt-2 text-xs text-muted">
                  {note.relatedType}{note.relatedId ? ` · ${note.relatedId}` : ""} · updated {note.updatedAt.slice(0, 10)}
                </p>
              </div>
              {note.pinned ? <p className="text-xs uppercase text-muted">Pinned</p> : null}
            </div>
            <div className="mt-4 border-t border-line pt-4">
              <NoteForm note={note} clients={clients} projects={projects} leads={leads} tasks={tasks} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
