import { Button, Card, PageHeader, inputClass, textareaClass } from "@/components/ui";
import { saveNoteForm } from "@/app/actions";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Notes" };

export default function NotesPage() {
  const notes = getWorkspace().notes;
  return (
    <div>
      <PageHeader title="Notes" description="Owner-only notes for clients, projects, and daily operations." />
      <Card id="add" className="mb-6">
        <h2 className="mb-4 font-semibold">Add note</h2>
        <form action={saveNoteForm} className="grid gap-3">
          <input name="title" required className={inputClass} placeholder="Title" />
          <textarea name="body" required className={textareaClass} placeholder="Note" />
          <select name="relatedType" className={inputClass} defaultValue="none">
            <option value="none">Unlinked</option>
            <option value="client">Client</option>
            <option value="project">Project</option>
            <option value="lead">Lead</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="pinned" />
            Pin
          </label>
          <Button type="submit">Save note</Button>
        </form>
      </Card>
      <div className="grid gap-4">
        {notes.map((note) => (
          <Card key={note.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{note.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm">{note.body}</p>
                <p className="mt-2 text-xs text-muted">{note.relatedType} · updated {note.updatedAt.slice(0, 10)}</p>
              </div>
              {note.pinned ? <p className="text-xs uppercase text-muted">Pinned</p> : null}
            </div>
            <form action={saveNoteForm} className="mt-4 grid gap-3 border-t border-line pt-4">
              <input type="hidden" name="id" value={note.id} />
              <input name="title" className={inputClass} defaultValue={note.title} />
              <textarea name="body" className={textareaClass} defaultValue={note.body} />
              {note.pinned ? <input type="hidden" name="pinned" value="on" /> : null}
              <Button type="submit" size="sm">Update</Button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
