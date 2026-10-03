export function DesktopSchematic({
  title,
  caption,
}: {
  title: string;
  caption?: string;
}) {
  return (
    <figure className="sts-device sts-device-desktop" aria-label={caption ?? `${title} desktop schematic`}>
      <div className="sts-chrome" aria-hidden>
        <span />
        <span />
        <span />
        <p>{title}</p>
      </div>
      <div className="sts-screen" aria-hidden>
        <div className="sts-skel sts-skel-nav" />
        <div className="sts-skel sts-skel-hero" />
        <div className="sts-skel-row">
          <div className="sts-skel" />
          <div className="sts-skel" />
          <div className="sts-skel" />
        </div>
        <div className="sts-skel sts-skel-cta" />
      </div>
      {caption ? <figcaption className="sts-device-cap">{caption}</figcaption> : null}
    </figure>
  );
}

export function PhoneSchematic({
  title,
  caption,
  placement = "overlay",
}: {
  title: string;
  caption?: string;
  placement?: "overlay" | "inline";
}) {
  return (
    <figure
      className={`sts-device sts-device-phone${placement === "inline" ? " sts-device-inline" : ""}`}
      aria-label={caption ?? `${title} mobile schematic`}
    >
      <div className="sts-phone-notch" aria-hidden />
      <div className="sts-screen sts-screen-phone" aria-hidden>
        <div className="sts-skel sts-skel-nav" />
        <div className="sts-skel sts-skel-hero" />
        <div className="sts-skel sts-skel-cta" />
      </div>
      {caption ? <figcaption className="sts-device-cap">{caption}</figcaption> : null}
    </figure>
  );
}
