export function BannerAtmosphere() {
  return (
    <div className="sts-banner-sky" aria-hidden="true">
      <svg className="sts-banner-trail" viewBox="0 0 1200 420" fill="none" preserveAspectRatio="xMidYMid slice">
        <path
          className="sts-banner-ribbon"
          d="M-20 280 C120 240 160 90 320 140 C470 190 520 310 680 250 C820 196 860 80 1020 70 C1100 64 1160 90 1220 40"
          stroke="url(#sts-ribbon-fade)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          className="sts-banner-signature"
          d="M40 300 C180 290 210 120 360 160 C490 196 500 340 640 300 C760 266 790 140 930 150 C1040 158 1120 230 1180 120"
          stroke="url(#sts-sign-fade)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          className="sts-banner-shoot"
          d="M1180 36 C980 90 860 120 740 150"
          stroke="url(#sts-shoot-fade)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="sts-ribbon-fade" x1="0" y1="0" x2="1200" y2="0">
            <stop offset="0%" stopColor="#FAF8F2" stopOpacity="0.22" />
            <stop offset="42%" stopColor="#12372A" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#9CF0D1" stopOpacity="0.28" />
          </linearGradient>
          <linearGradient id="sts-sign-fade" x1="0" y1="0" x2="1200" y2="0">
            <stop offset="0%" stopColor="#12372A" stopOpacity="0.28" />
            <stop offset="70%" stopColor="#FFF8E8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#1F6F5C" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="sts-shoot-fade" x1="1180" y1="36" x2="740" y2="150">
            <stop offset="0%" stopColor="#FFF8E8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#1F6F5C" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <span className="sts-star sts-star-a" />
      <span className="sts-star sts-star-b" />
      <span className="sts-star sts-star-c" />
      <span className="sts-star sts-star-d" />
      <span className="sts-star sts-star-e" />
      <span className="sts-star sts-star-f" />
      <span className="sts-star sts-star-g" />
      <span className="sts-star sts-star-h" />
    </div>
  );
}
