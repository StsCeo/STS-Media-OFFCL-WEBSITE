import { Button, inputClass, textareaClass } from "@/components/ui";
import { saveIcpForm } from "@/app/actions";
import type { IcpRecord } from "@/lib/types";

export function IcpEditor({ icp }: { icp?: IcpRecord }) {
  return (
    <form action={saveIcpForm} className="grid gap-3 md:grid-cols-2">
      {icp ? <input type="hidden" name="id" value={icp.id} /> : null}
      <input name="name" required className={inputClass} defaultValue={icp?.name} placeholder="ICP name" />
      <input name="industry" className={inputClass} defaultValue={icp?.industry} placeholder="Industry" />
      <input name="companySize" className={inputClass} defaultValue={icp?.companySize} placeholder="Company size" />
      <input name="market" className={inputClass} defaultValue={icp?.market} placeholder="Market" />
      <input name="estimatedBudgetMin" type="number" min="0" step="1" className={inputClass} defaultValue={icp?.estimatedBudgetMin ?? 0} placeholder="Budget min" />
      <input name="estimatedBudgetMax" type="number" min="0" step="1" className={inputClass} defaultValue={icp?.estimatedBudgetMax ?? 0} placeholder="Budget max" />
      <input name="decisionMaker" className={inputClass} defaultValue={icp?.decisionMaker} placeholder="Decision maker" />
      <select name="status" className={inputClass} defaultValue={icp?.status || "active"}>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </select>
      <textarea name="commonProblems" className={textareaClass} defaultValue={icp?.commonProblems} placeholder="Common problems" />
      <textarea name="servicesNeeded" className={textareaClass} defaultValue={icp?.servicesNeeded} placeholder="Services needed" />
      <textarea name="acquisitionChannels" className={textareaClass} defaultValue={icp?.acquisitionChannels} placeholder="Acquisition channels" />
      <textarea name="commonObjections" className={textareaClass} defaultValue={icp?.commonObjections} placeholder="Common objections" />
      <textarea name="buyingTriggers" className={`${textareaClass} md:col-span-2`} defaultValue={icp?.buyingTriggers} placeholder="Buying triggers" />
      <textarea name="notes" className={`${textareaClass} md:col-span-2`} defaultValue={icp?.notes} placeholder="Notes" />
      <Button type="submit">{icp ? "Save ICP" : "Create ICP"}</Button>
    </form>
  );
}
