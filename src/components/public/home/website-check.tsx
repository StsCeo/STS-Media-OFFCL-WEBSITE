"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { trackPublic } from "@/lib/analytics/public-events";

const questions = [
  "Does your website work well on mobile?",
  "Can customers understand your offer within five seconds?",
  "Is there one obvious action to take?",
  "Are your contact details easy to find?",
  "Do you track inquiries?",
] as const;

export function WebsiteCheck() {
  const name = useId();
  const [answers, setAnswers] = useState<boolean[]>(questions.map(() => false));
  const score = answers.filter(Boolean).length;
  const result = score <= 2 ? "Needs attention" : score <= 4 ? "Solid foundation" : "Ready to optimize";

  return (
    <div>
      <fieldset>
        <legend className="sr-only">Digital presence check</legend>
        <div className="sts-check">
          {questions.map((question, index) => (
            <label key={question}>
              <input
                type="checkbox"
                name={`${name}-${index}`}
                className="mt-1 h-4 w-4"
                checked={answers[index]}
                onChange={(event) => {
                  const next = [...answers];
                  next[index] = event.target.checked;
                  setAnswers(next);
                  trackPublic("website_check_complete", { score: String(next.filter(Boolean).length) });
                }}
              />
              <span className="text-sm leading-6">{question}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-4 text-sm" aria-live="polite">
        Result: <strong>{result}</strong> ({score} of {questions.length} checked). This is a self-check, not a professional diagnosis. No answers are stored.
      </p>
      <Link
        href="/contact?intent=audit"
        className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
        onClick={() => trackPublic("free_audit_click", { from: "website-check" })}
      >
        Request a free audit
      </Link>
    </div>
  );
}
