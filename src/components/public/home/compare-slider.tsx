"use client";

import { useId, useState } from "react";

export function CompareSlider() {
  const id = useId();
  const [value, setValue] = useState(62);

  return (
    <div className="sts-compare">
      <p className="public-kicker">Interactive schematic</p>
      <h3 className="mt-2 font-display text-2xl tracking-tight">Scattered presence, then a clear path</h3>
      <p className="mt-2 text-sm leading-6 text-muted">
        Drag to compare a typical cluttered homepage layout with a focused system. This is an original diagram, not a
        photographed client site.
      </p>
      <div className="sts-compare-frame mt-5">
        <div className="sts-compare-pane sts-compare-after" aria-hidden>
          <LayoutClear />
        </div>
        <div className="sts-compare-pane sts-compare-before" style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }} aria-hidden>
          <LayoutScattered />
        </div>
        <div className="sts-compare-handle" style={{ left: `${value}%` }} aria-hidden />
      </div>
      <label className="sts-compare-label" htmlFor={id}>
        Compare layouts
        <input
          id={id}
          type="range"
          min={8}
          max={92}
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
        />
      </label>
      <p className="mt-2 flex justify-between text-xs text-muted">
        <span>Overlooked</span>
        <span>Clear</span>
      </p>
    </div>
  );
}

function LayoutScattered() {
  return (
    <div className="sts-layout sts-layout-messy">
      <p className="sts-layout-tag">Hours?</p>
      <p className="sts-layout-tag sts-layout-tag-2">Call us maybe</p>
      <div className="sts-skel" />
      <div className="sts-skel sts-skel-hero" />
      <div className="sts-skel-row">
        <div className="sts-skel" />
        <div className="sts-skel" />
      </div>
    </div>
  );
}

function LayoutClear() {
  return (
    <div className="sts-layout">
      <div className="sts-skel sts-skel-nav" />
      <div className="sts-skel sts-skel-hero" />
      <div className="sts-skel-row">
        <div className="sts-skel" />
        <div className="sts-skel" />
        <div className="sts-skel" />
      </div>
      <div className="sts-skel sts-skel-cta" />
    </div>
  );
}
