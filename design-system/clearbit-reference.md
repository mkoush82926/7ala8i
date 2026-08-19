# Halaqy Redesign — "Data Observatory on Cloud Paper" (Clearbit reference)

This is the ground-truth style spec for the Halaqy visual redesign. Every
file you touch must match this exactly — no improvisation on palette,
radius, or shadow usage.

## Core tokens (already live in `src/app/globals.css` and `:root`)

| Token | Value | Use |
|---|---|---|
| `--text-primary` | `#091135` (Midnight Ink) | Primary text, headings, nav, links — the dominant ink of the interface |
| `--text-secondary` / `--text-tertiary` | `#36394a` (Slate) | Secondary/muted text: metadata, timestamps, helper copy |
| `--bg-primary` / `--bg-surface` / `--bg-elevated` | `#ffffff` (Paper) | Page canvas, card surfaces |
| `--bg-secondary` | `#f5f3ff` (Lavender Wash) | Section background tint that signals a content zone — cards float white on top of it |
| `--border-primary` | `#e1e9f0` (Frost Border) | Hairline borders on cards, inputs, dividers — the structural line color of the whole system |
| `--border-hover` / `--accent-blue` | `#0f77ff` (Electric Blue) | Outline accent for focus states, dividers, check icons. **Never** the primary CTA fill. |
| `--accent-mint` / `--accent-cobalt` | `#127ee3` (Cobalt Surface) | THE single primary-CTA fill color (buttons only) |
| `--accent-rose` | `#ba1a1a` | Destructive/error semantic only (separate channel, not part of the 1-accent brand system) |
| `--text-muted` | `#b1bbcd` (Mist) | Soft secondary neutral — disabled states, deep dividers |
| `--radius-cards` | `12px` | Cards, product-showcase tiles |
| `--radius-buttons` / `--radius-inputs` | `8px` | Buttons, inputs, nav elements |
| `--radius-tags` | `9999px` | Badges, pills, tags |
| `--shadow-sm/md/lg` | `none` | Resting elevation is NEVER a shadow — always zeroed out |
| `--shadow-focus` | defined | The ONLY shadow in the system — a blue focus ring, applied on `:focus-visible`/`:focus` only |

Fonts are already wired globally (InterVar EN / Noto Sans Arabic AR via
`FONT_EN`/`FONT_AR` in `src/hooks/use-translation.ts` and CSS var
`--font-intervar`/`--font-noto-arabic`) — **do not** add font-family
overrides per-component unless a file still hardcodes an old font name
you find while editing (fix it to `var(--font-intervar)` if so).

## Old → new color mapping (apply exactly this way — do not invent new hexes)

| Old value(s) seen in this codebase | Maps to |
|---|---|
| `#000000`, `#111827`, `#191c1e`, `#121826`, `#0f172a`, `#151b29` (structural dark ink/text) | Midnight Ink `#091135` |
| `#45464c`, `#6b7280`, `#76777d`, `#9ca3af`, `#374151`, `#57657a`, `#515f74` (secondary/muted text) | Slate `#36394a` |
| `#ffffff`, `#f7f9fb`, `#f9fafb`, `#f8fafc`, `#f3f4f6`, `#eceef0`, `#f1f5f9`, `#fafafa`, `#f0f0f0`, `#e0e3e5` (page/card backgrounds) | Paper `#ffffff` for cards/canvas; use Lavender Wash `#f5f3ff` specifically for **section-level tint zones** (alternating page bands), not for cards themselves |
| `#e5e7eb`, `#d1d5db`, `#c6c6cc` (light gray borders) | Frost Border `#e1e9f0` |
| Any dark filled "primary" button/CTA background (`#111827`, `#121826`, `#10b981`, etc.) | **Cobalt Surface `#127ee3`** fill, white text — this is the ONE chromatic action color in the system |
| Repeated/structural active states (selected nav item, selected grid cell, filled pill used more than once per view) | Lavender Wash `#f5f3ff` background + Midnight Ink text — NOT cobalt blue. Blue is reserved for the singular primary action per view plus focus rings/checkmarks, never for repeated selection state. |
| `#10b981`, emerald, "open now"/positive/completed status | Electric Blue `#0f77ff` or Cobalt `#127ee3` (pick whichever reads better as a checkmark/badge vs. a filled chip) |
| `#f43f5e`, `#ba1a1a`, destructive/error/cancelled | Keep as `#ba1a1a` — separate semantic channel, untouched by the 1-accent discipline |
| `#f59e0b`, `#d4a853`, star ratings | Electric Blue `#0f77ff` (the system's one accent covers this too — do not invent a gold/amber) |
| `#3b82f6`, `#1d4ed8`, any pre-existing blue badges/accents | Electric Blue `#0f77ff` — these already align with the new accent, just normalize the exact hex |
| Any `box-shadow: ...` used for resting-state elevation (card hover lift, dropdown, modal) | Delete entirely. Elevation comes from Lavender Wash tint + 1px Frost Border only. |
| Any `box-shadow`/outline used for a **focus state** | Replace with `var(--shadow-focus)` — this is the one place shadows are correct |
| Any `backdrop-filter: blur(...)` / `filter: blur(...)` | Delete the blur; if the element needed opacity for legibility (e.g. sticky header), use solid `#ffffff` instead |
| Any `linear-gradient(...)` / `radial-gradient(...)` decorative background, `.orb`, gradient text | Remove. Flat white or flat Lavender Wash only — the spec's only "gradient" is the soft top/bottom transition between a white section and a lavender section, which is achieved by adjacent flat blocks, not a CSS gradient. |
| Border-radius values (4-24px) on cards/modals/tiles | `12px` |
| Border-radius on buttons, inputs, nav pills | `8px` |
| Border-radius on badges/pills/tags (already-rounded elements) | `9999px` |
| Perfectly circular elements (avatars, dots, step-circles) | Leave as `50%` — untouched, not part of the radius rescale |

## What NOT to change

- Component logic, state, props, data fetching, event handlers, imports — **style only**.
- JSX structure/hierarchy — do not add/remove elements, only edit `style={{...}}` objects and `className` strings that carry color/radius/shadow.
- Translation strings, `t.xxx.yyy` keys — untouched.
- Keep using inline `style={{}}` objects where the file already does (this codebase's dominant pattern) — don't refactor to Tailwind utility classes or CSS modules.
- Animations/transitions/keyframes — keep timing and easing as-is unless they animate a shadow or gradient that no longer exists, in which case simplify to the remaining properties.
- Letter-spacing on headings should be POSITIVE (opens with size — 0.008em body up to ~0.018em display), the opposite of most SaaS type systems. If a file has negative letter-spacing on headings (e.g. `-0.03em`, `-0.04em`), flip the sign and reduce the magnitude toward the 0.008–0.018em range rather than just negating it verbatim.

## Do's (from the reference spec)

- One primary Cobalt CTA per view — never fill large surfaces or multiple simultaneous buttons with it.
- Every card/tile/input gets a 1px Frost Border hairline at the correct radius bucket — never a shadow, except the defined focus ring.
- Headlines use InterVar/Noto Sans Arabic at weight 500–600 with **widened** (positive) letter-spacing at large sizes.
- Alternate page rhythm between white sections and Lavender Wash sections — never through drop shadows.
- Reserve Electric Blue for the single CTA, focus rings, and checkmark icons only.

## Don'ts

- No drop shadows on resting cards/panels, ever.
- No second accent color — the entire chromatic budget is one blue.
- No negative letter-spacing on headings.
- No pure black (`#000000`) for long-form text — Midnight Ink (`#091135`) is the ink; black is reserved only for icon fills where present.
- Don't break the radius scale (12px cards, 8px buttons/inputs, 9999px tags) with intermediate values.
- No gradients or decorative backgrounds beyond the flat white/lavender section alternation.

## Verification checklist (apply to every file before considering it done)

- [ ] No `box-shadow` remains except focus-state uses of `var(--shadow-focus)`
- [ ] No `backdrop-filter`, `filter: blur`, or `linear-gradient`/`radial-gradient` remains
- [ ] No leftover old hex values from the mapping table above
- [ ] Border radii match the bucket table (cards=12px, buttons/inputs=8px, tags=9999px, circles=50%)
- [ ] No negative letter-spacing left on headings
- [ ] File still typechecks and the component's exported props/behavior are unchanged
