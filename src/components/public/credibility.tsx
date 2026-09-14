import { credibilityItems } from "@/lib/content/homepage";

export function CredibilityStrip() {
  return (
    <ul className="grid gap-px overflow-hidden bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
      {credibilityItems.map((item) => (
        <li key={item} className="bg-[#0B0D0C] px-5 py-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C7FF3D]">{item}</p>
        </li>
      ))}
    </ul>
  );
}
