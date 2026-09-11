import { savePortfolio, saveTestimonial } from "@/app/actions";
import { Badge, Button, Card, PageHeader, inputClass, textareaClass } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Portfolio Manager" };

export default function PortfolioManagerPage() {
  const { portfolio, testimonials } = getWorkspace();
  return (
    <div>
      <PageHeader title="Portfolio Manager" description="Edit case studies and approve testimonials. Never publish invented quotes or results." />
      {portfolio.map((item) => (
        <Card key={item.id} className="mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{item.companyName}</h2>
            <Badge>{item.status}</Badge>
            {item.featured ? <Badge tone="gold">Featured</Badge> : null}
          </div>
          <form action={savePortfolio} className="mt-4 grid gap-3">
            <input type="hidden" name="id" value={item.id} />
            <input name="companyName" className={inputClass} defaultValue={item.companyName} />
            <input name="industry" className={inputClass} defaultValue={item.industry} />
            <input name="projectTitle" className={inputClass} defaultValue={item.projectTitle} />
            <textarea name="challenge" className={textareaClass} defaultValue={item.challenge} />
            <textarea name="solution" className={textareaClass} defaultValue={item.solution} />
            <input name="websiteUrl" className={inputClass} placeholder="Website URL" defaultValue={item.websiteUrl} />
            <textarea name="results" className={textareaClass} defaultValue={item.results.join("\n")} />
            <Button type="submit">Save case study</Button>
          </form>
        </Card>
      ))}
      <Card>
        <h2 className="font-semibold">Add a real testimonial</h2>
        <p className="mt-1 text-sm text-muted">Leave unpublished until the client approved the wording.</p>
        <form action={saveTestimonial} className="mt-4 grid gap-3">
          <input name="authorName" className={inputClass} placeholder="Author name" required />
          <input name="authorRole" className={inputClass} placeholder="Role" />
          <input name="company" className={inputClass} placeholder="Company" />
          <textarea name="quote" className={textareaClass} placeholder="Exact client wording" required />
          <label className="text-sm"><input type="checkbox" name="approved" /> Approved</label>
          <label className="text-sm"><input type="checkbox" name="published" /> Published</label>
          <Button type="submit">Save testimonial</Button>
        </form>
        <ul className="mt-4 text-sm">
          {testimonials.length === 0 ? <li className="text-muted">None on file.</li> : testimonials.map((t) => (
            <li key={t.id}>{t.authorName} · {t.published ? "published" : "hidden"} · {t.approved ? "approved" : "pending"}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
