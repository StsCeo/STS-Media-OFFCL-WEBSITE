import type { TaxChecklistItem } from "./types";

export const TAX_DISCLAIMER =
  "This system is for business administration, bookkeeping organization, and recordkeeping. It does not provide legal, accounting, or tax advice. A qualified professional must determine final classifications, deductions, filing requirements, and tax liability.";

export const POTENTIAL_EXPENSE_LABEL =
  "Potential business expense—professional review may be required.";

export function defaultTaxChecklist(year = 2026): TaxChecklistItem[] {
  const items: Array<Pick<TaxChecklistItem, "id" | "title" | "notes" | "dueDate">> = [
    {
      id: `tax-${year}-receipts`,
      title: "Collect and attach receipts",
      notes: "Match receipts to expenses before a professional reviews the year.",
      dueDate: `${year}-12-31`,
    },
    {
      id: `tax-${year}-registration`,
      title: "Confirm Georgia annual registration",
      notes: "Owner-entered reminder. Confirm the current filing window with the Secretary of State.",
      dueDate: `${year + 1}-04-01`,
    },
    {
      id: `tax-${year}-books`,
      title: "Close books for professional review",
      notes: "Export records and give them to a qualified professional. This checklist is not a filing.",
      dueDate: `${year + 1}-03-15`,
    },
    {
      id: `tax-${year}-1099`,
      title: "List contractors who may need 1099 review",
      notes: "A professional must determine who must receive a form. Do not treat this list as advice.",
      dueDate: `${year + 1}-01-31`,
    },
    {
      id: `tax-${year}-reserve`,
      title: "Review owner-entered tax reserve",
      notes: "The reserve percent and amount are owner-entered. This system does not calculate tax due.",
      dueDate: `${year}-12-31`,
    },
    {
      id: `tax-${year}-estimates`,
      title: "Ask a professional about estimated taxes",
      notes: "If estimates apply, a qualified professional sets the amounts and dates.",
      dueDate: null,
    },
  ];
  return items.map((item) => ({
    ...item,
    taxYear: year,
    status: "todo",
    ownerEntered: false,
  }));
}
