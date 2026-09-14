export function passwordScore(value: string) {
  const checks = [
    value.length >= 12,
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ];
  const score = checks.filter(Boolean).length;
  const label = score <= 2 ? "Too weak" : score === 3 ? "Fair" : score === 4 ? "Strong" : "Very strong";
  return { score, label, ok: score >= 4 && value.length >= 12 };
}
