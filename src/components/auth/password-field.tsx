"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { passwordScore } from "@/lib/security/password";

export function PasswordField({
  name = "password",
  label = "New password",
}: {
  name?: string;
  label?: string;
}) {
  const [value, setValue] = useState("");
  const result = passwordScore(value);
  const width = `${(result.score / 5) * 100}%`;
  return (
    <Field label={label} name={name} hint="At least 12 characters with mixed case, a number, and a symbol.">
      <input
        id={name}
        name={name}
        type="password"
        required
        minLength={12}
        autoComplete="new-password"
        className={inputClass}
        value={value}
        aria-describedby="password-hint"
        aria-invalid={value.length > 0 && !result.ok ? true : undefined}
        onChange={(event) => setValue(event.target.value)}
      />
      {value ? (
        <span className="mt-2 block">
          <span className="mb-1 flex justify-between text-xs text-muted">
            <span>{result.label}</span>
            <span>{result.ok ? "Meets policy" : "Keep going"}</span>
          </span>
          <span className="block h-1.5 overflow-hidden rounded-full bg-line">
            <span
              className={`block h-full ${result.ok ? "bg-success" : result.score >= 3 ? "bg-warning" : "bg-danger"}`}
              style={{ width }}
            />
          </span>
        </span>
      ) : null}
    </Field>
  );
}
