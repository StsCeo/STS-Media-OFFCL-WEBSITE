const paths: Record<string, string> = {
  auto: "M8 40 h16 l8-12 h28 l10 12 h14 v18 h-10 a8 8 0 0 1-16 0 H42 a8 8 0 0 1-16 0 H16 V40z M28 28 h22",
  beauty: "M40 12 c-12 10-12 28 0 38 c12-10 12-28 0-38z M40 18 v28 M28 32 h24",
  food: "M18 52 h44 M22 52 V24 a8 8 0 0 1 16 0 v28 M48 52 V22 c8 0 12 6 12 14",
  contractors: "M16 52 V28 L40 12 64 28 v24 H16z M32 52 V36 h16 v16",
  retail: "M14 28 h52 l-4 24 H18z M20 28 V18 h12 v10 M40 52 V40 h12 v12",
  creators: "M24 20 h32 v28 H24z M32 28 h16 M32 36 h10 M40 54 v8",
};

export function IndustryArt({ id }: { id: string }) {
  const d = paths[id] ?? paths.auto;
  return (
    <svg viewBox="0 0 80 64" className="sts-industry-art" aria-hidden="true" fill="none">
      <rect x="4" y="4" width="72" height="56" rx="10" stroke="currentColor" strokeOpacity="0.35" />
      <path d={d} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
