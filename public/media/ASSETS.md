# Public media assets

This folder holds approved marketing media for the public site. Do not hotlink remote images.

Place production files at the paths below. Until a file exists, the site uses a clearly labeled SVG placeholder with the same aspect ratio. `next/image` renders both; screenshots should use `object-fit: contain` so UI is not stretched or cropped.

## Needed

| Use | Recommended file | Size | Notes |
| --- | --- | --- | --- |
| Homepage hero still | `public/media/hero/studio-still.webp` | 1600×1800 | Original editorial still. No logos, no fake metrics. |
| State Collision Pro desktop | `public/media/work/state-collision-pro/desktop.webp` | 1600×1000 | Production website screenshot. |
| State Collision Pro mobile | `public/media/work/state-collision-pro/mobile.webp` | 750×1624 | Production mobile screenshot. Keep controls visible. |
| Optional before screenshot | `public/media/work/state-collision-pro/before.webp` | 1600×1000 | Only if a verified previous site capture exists. Enables the before/after slider. |
| Optional after screenshot | `public/media/work/state-collision-pro/after.webp` | 1600×1000 | Verified launched site. Pair with `before.webp`. |
| Optional project video | set `videoUrl` on the portfolio item | 1920×1080 source | Muted poster only until user plays. No autoplay audio. |
| Owners panel | `public/media/audience/business-owners.webp` | 1400×1600 | Original photo of real work. No stock people. |
| Creators panel | `public/media/audience/creators.webp` | 1400×1600 | Original process/studio photo. No fake social proof. |

Additional case studies can follow `public/media/work/[slug]/desktop.webp` and `mobile.webp` without changing the page layout.

## Placeholders currently in use

- `placeholders/hero-composition.svg`
- `placeholders/scp-desktop.svg`
- `placeholders/scp-mobile.svg`
- `placeholders/audience-owners.svg`
- `placeholders/audience-creators.svg`

No approved State Collision Pro screenshots were in the repository at redesign time. Seed copy still marks desktop/mobile/before/after captures as outstanding.
