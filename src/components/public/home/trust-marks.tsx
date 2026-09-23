const marks = [
  { label: "Mobile-first builds", icon: "M18 10 h12 v28 H18z M22 36 h4" },
  { label: "Clear project scope", icon: "M16 16 h24 v20 H16z M20 22 h16 M20 28 h10" },
  { label: "Direct collaboration", icon: "M20 34 a8 8 0 1 1 16 0 M18 42 h20" },
  { label: "Ongoing website care", icon: "M28 14 l10 18 H18z" },
  { label: "Built for small businesses", icon: "M16 36 V24 L28 16 40 24 v12z" },
] as const;

export function TrustMarks({ items }: { items: readonly string[] }) {
  const rows = items.map((label, index) => ({
    label,
    icon: marks[index]?.icon ?? marks[0].icon,
  }));

  return (
    <ul className="sts-trust sts-trust-visual m-0 p-0">
      {rows.map((item) => (
        <li key={item.label}>
          <svg viewBox="0 0 56 56" aria-hidden="true" className="sts-trust-icon">
            <rect x="6" y="6" width="44" height="44" rx="12" fill="none" stroke="currentColor" />
            <path d={item.icon} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
