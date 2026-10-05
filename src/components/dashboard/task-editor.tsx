import { Button, inputClass, textareaClass } from "@/components/ui";
import { archiveTaskForm, saveTaskForm } from "@/app/actions";
import type { ClientRecord, Project, TaskItem } from "@/lib/types";

export function TaskEditor({
  task,
  clients,
  projects,
}: {
  task?: TaskItem;
  clients: ClientRecord[];
  projects: Project[];
}) {
  return (
    <div className="grid gap-3">
      <form action={saveTaskForm} className="grid gap-3 md:grid-cols-2">
        {task ? <input type="hidden" name="id" value={task.id} /> : null}
        <input name="title" required className={`${inputClass} md:col-span-2`} defaultValue={task?.title} placeholder="Task title" />
        <select name="status" className={inputClass} defaultValue={task?.status || "todo"}>
          <option value="todo">To do</option>
          <option value="in_progress">In progress</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
        </select>
        <select name="priority" className={inputClass} defaultValue={task?.priority || "medium"}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select name="projectId" className={inputClass} defaultValue={task?.projectId || ""}>
          <option value="">No project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        <select name="clientId" className={inputClass} defaultValue={task?.clientId || ""}>
          <option value="">No client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.businessName}</option>
          ))}
        </select>
        <input name="dueDate" type="date" className={inputClass} defaultValue={task?.dueDate || ""} />
        <input name="assignee" className={inputClass} defaultValue={task?.assignee || "Owner"} placeholder="Assignee" />
        <textarea name="notes" className={`${textareaClass} md:col-span-2`} defaultValue={task?.notes} placeholder="Notes" />
        <Button type="submit">{task ? "Save task" : "Add task"}</Button>
      </form>
      {task ? (
        <form action={archiveTaskForm}>
          <input type="hidden" name="id" value={task.id} />
          <Button type="submit" variant="secondary">Archive task</Button>
        </form>
      ) : null}
    </div>
  );
}
