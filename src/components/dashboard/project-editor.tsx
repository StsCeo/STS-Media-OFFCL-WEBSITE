import { Button, inputClass, textareaClass } from "@/components/ui";
import { saveProjectForm } from "@/app/actions";
import { PROJECT_STAGES, type ClientRecord, type Project } from "@/lib/types";

export function ProjectEditor({
  project,
  clients,
}: {
  project?: Project;
  clients: ClientRecord[];
}) {
  return (
    <form action={saveProjectForm} className="grid gap-3 md:grid-cols-2">
      {project ? <input type="hidden" name="id" value={project.id} /> : null}
      <input name="name" required className={`${inputClass} md:col-span-2`} defaultValue={project?.name} placeholder="Project name" />
      <select name="clientId" className={inputClass} defaultValue={project?.clientId || clients[0]?.id || ""}>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>{client.businessName}</option>
        ))}
      </select>
      <select name="stage" className={inputClass} defaultValue={project?.stage || "lead"}>
        {PROJECT_STAGES.map((stage) => (
          <option key={stage} value={stage}>{stage.replaceAll("_", " ")}</option>
        ))}
      </select>
      <input name="startDate" type="date" className={inputClass} defaultValue={project?.startDate} />
      <input name="deadline" type="date" className={inputClass} defaultValue={project?.deadline} />
      <input name="budget" type="number" step="0.01" className={inputClass} defaultValue={project?.budget ?? 0} placeholder="Budget (USD)" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="atRisk" defaultChecked={project?.atRisk} />
        Mark at risk
      </label>
      <textarea name="notes" className={`${textareaClass} md:col-span-2`} defaultValue={project?.notes} placeholder="Notes" />
      <Button type="submit">{project ? "Save project" : "Add project"}</Button>
    </form>
  );
}
