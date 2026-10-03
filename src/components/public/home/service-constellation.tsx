"use client";

const NODES = [
  { x: 28, y: 52, label: "Strategy", index: 0 },
  { x: 86, y: 22, label: "Design", index: 0 },
  { x: 148, y: 58, label: "Build", index: 1 },
  { x: 206, y: 18, label: "Mobile", index: 2 },
  { x: 258, y: 54, label: "Local", index: 3 },
  { x: 312, y: 24, label: "Leads", index: 4 },
  { x: 352, y: 62, label: "Care", index: 6 },
] as const;

export function ServiceConstellation({
  active,
  onPick,
}: {
  active: number;
  onPick: (index: number) => void;
}) {
  return (
    <div className="sts-service-map-wrap">
      <svg className="sts-service-map" viewBox="0 0 380 84" aria-hidden="true">
        <path
          className="sts-path-draw"
          d="M28 52 C56 52 62 22 86 22 C114 22 122 58 148 58 C176 58 182 18 206 18 C232 18 236 54 258 54 C286 54 292 24 312 24 C334 24 338 62 352 62"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        {NODES.map((node) => (
          <circle key={node.label} cx={node.x} cy={node.y} r={active === node.index ? 6 : 4} fill="currentColor" />
        ))}
      </svg>
      <div className="sts-service-picks" role="group" aria-label="Jump to a service">
        {NODES.map((node) => (
          <button
            key={node.label}
            type="button"
            className={active === node.index ? "is-active" : undefined}
            onClick={() => onPick(node.index)}
          >
            {node.label}
          </button>
        ))}
      </div>
    </div>
  );
}
