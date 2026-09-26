export function BannerAtmosphere() {
  return (
    <div className="sts-banner-sky" aria-hidden="true">
      <div className="sts-banner-journey">
        <div className="sts-banner-day">
          <div className="sts-day-mist" />
          <svg className="sts-banner-trail" viewBox="0 0 600 420" fill="none" preserveAspectRatio="xMidYMid slice">
            <path
              className="sts-banner-ribbon"
              d="M-30 250 C70 210 110 70 230 120 C330 162 350 280 450 230 C520 196 560 120 640 90"
              stroke="url(#sts-day-ribbon)"
              strokeWidth="22"
              strokeLinecap="round"
            />
            <path
              className="sts-banner-signature"
              d="M-10 300 C90 280 130 140 230 170 C320 198 340 320 430 290 C500 268 540 180 620 160"
              stroke="url(#sts-day-sign)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="sts-day-ribbon" x1="0" y1="0" x2="600" y2="0">
                <stop offset="0%" stopColor="#FAF8F2" stopOpacity="0.55" />
                <stop offset="48%" stopColor="#A8BFAE" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#12372A" stopOpacity="0.28" />
              </linearGradient>
              <linearGradient id="sts-day-sign" x1="0" y1="0" x2="600" y2="0">
                <stop offset="0%" stopColor="#12372A" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#1F6F5C" stopOpacity="0.45" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="sts-banner-blend">
          <svg className="sts-banner-trail" viewBox="0 0 700 420" fill="none" preserveAspectRatio="xMidYMid slice">
            <path
              d="M20 250 C140 220 180 80 320 130 C430 168 470 40 660 56"
              stroke="url(#sts-blend-arc)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="662" cy="55" r="2.2" fill="#FFF8E8" />
            <defs>
              <linearGradient id="sts-blend-arc" x1="20" y1="250" x2="660" y2="56">
                <stop offset="0%" stopColor="#12372A" stopOpacity="0.15" />
                <stop offset="62%" stopColor="#9CF0D1" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#FFF8E8" stopOpacity="0.9" />
              </linearGradient>
            </defs>
          </svg>
          <span className="sts-meteor sts-meteor-blend" />
        </div>
        <div className="sts-banner-night">
          <svg className="sts-banner-trail" viewBox="0 0 600 420" fill="none" preserveAspectRatio="xMidYMid slice">
            <path
              className="sts-night-arc"
              d="M-20 280 C80 250 120 90 240 130 C350 168 390 60 520 48"
              stroke="url(#sts-night-arc)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              className="sts-banner-shoot"
              d="M520 48 C430 78 360 110 280 150"
              stroke="url(#sts-night-shoot)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <circle cx="522" cy="47" r="2.1" fill="#FFF8E8" />
            <defs>
              <linearGradient id="sts-night-arc" x1="0" y1="280" x2="520" y2="48">
                <stop offset="0%" stopColor="#1F6F5C" stopOpacity="0" />
                <stop offset="55%" stopColor="#9CF0D1" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#FFF8E8" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="sts-night-shoot" x1="520" y1="48" x2="280" y2="150">
                <stop offset="0%" stopColor="#FFF8E8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#1F6F5C" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <span className="sts-night-star sts-night-star-a" />
          <span className="sts-night-star sts-night-star-b" />
          <span className="sts-night-star sts-night-star-c" />
          <span className="sts-night-star sts-night-star-d" />
          <span className="sts-night-star sts-night-star-e" />
          <span className="sts-night-star sts-night-star-f" />
          <span className="sts-night-star sts-night-star-g" />
          <span className="sts-night-star sts-night-star-h" />
          <span className="sts-meteor sts-meteor-a" />
          <span className="sts-meteor sts-meteor-b" />
          <span className="sts-meteor sts-meteor-c" />
        </div>
      </div>
    </div>
  );
}
