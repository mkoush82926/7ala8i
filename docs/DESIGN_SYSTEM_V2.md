# Halaqy Design System v2 — "Deep Teal & Sand"

Status: spec, ready to implement · Owner: design direction · Supersedes the "Ink & Brass" palette in `src/app/globals.css` and roadmap §2 rule 1 ("brass CTA"). All other roadmap §2 rules (one primary action, MetaLine, permissive search defaults, progressive disclosure, empty states with a next step, policy before charge, Pill, RTL by construction, `formatJOD`, Arabic-first copy) stay in force and are restated here in v2 terms.

> Scope rule for every implementer: this is a **visual/UX-layer refresh**. Do not change behaviour, data flow, RPC calls, URL params, routes or component props that tests rely on. Restyle, re-layout, re-order sections, swap imagery treatment, tighten microcopy tone. When in doubt, keep the DOM roles/labels and change the classes.

---

## 1. Brand direction

Halaqy is the premium way to find and book a barber in Amman: a calm, image-led marketplace on the customer side and a fast, dense, trustworthy back office on the shop side. v2 moves away from the dark-brown/brass "Ink & Brass" atelier look — which read as vintage and low-energy on photo-heavy screens and gave us a muddy, low-contrast brass CTA — to **Deep Teal & Sand**: a warm sand page (`#F8F7F4`) with crisp white cards, slate-navy ink text, one confident deep-teal action colour (`#0F766E`) and a sparing amber highlight (`#F59E0B`) reserved for ratings and "Top rated"-type emphasis. Teal is cool, clean and clinical-in-a-good-way (barbering = precision, hygiene) while sand keeps the warmth of a neighbourhood shop; it photographs well next to skin tones and wood/leather interiors, and it is unmistakably not Fresha's black/purple. What changes vs today: (1) photos and placeholders lead every card, (2) the flat "no shadow ever" rule is replaced by a soft three-step elevation so cards, the search bar and sticky booking surfaces lift off the sand, (3) buttons become fully-rounded pills, cards get 16px radii, (4) typography gets a real display size for heroes and tighter, bolder headings, (5) every hard-coded brass/brown hex and brass-tinted shadow is removed. The level of polish, density and booking ergonomics we match is Fresha's; the identity (name, colours, motif, copy, imagery) is Halaqy's own. Our recurring motif is the **sand stripe** — a faint diagonal barber-pole hatch used only in image placeholders and empty-state art, never as decoration on content.

Non-negotiables: no Fresha logo, wordmark style, purple/black palette, illustrations, copy or photography. No gradient text, no glows, no glassmorphism blur on content, no emoji in UI labels, no uppercase tracked labels in Arabic.

---

## 2. Tokens

### 2.1 Architecture (how to land this without touching 300 files)

Three layers, all in `src/app/globals.css`:

1. **Primitive palette** (`--teal-700`, `--sand-50`, `--slate-900` …) — raw hexes, never referenced from components.
2. **Semantic tokens in `@theme`** (Tailwind 4 generates utilities from them): `bg-page`, `bg-card`, `text-ink`, `text-ink-muted`, `bg-brand`, `border-line` … Redefined under `:root[data-theme="dark"]` / `:root.dark` exactly as today's `--color-*` overrides.
3. **Legacy aliases** — every existing variable (`--bg-primary`, `--text-primary`, `--accent-brass`, `--accent-mint`, `--cta-bg`, `--accent-blue-muted`, `--color-primary` …) is **kept** and re-pointed at the new semantic values (mapping table in §2.6). This recolours the whole app on day one; page owners then migrate class strings to the new utilities as they redesign.

New code uses the new utilities (`bg-brand`, `text-ink-muted`) — not `bg-[var(--accent-mint)]`.

### 2.2 Colour — light (default)

| Token (`@theme --color-*` → utility) | Hex | Use | Contrast |
|---|---|---|---|
| `page` → `bg-page` | `#F8F7F4` | Warm sand page background (marketplace + dashboard canvas) | ink 16.7:1 |
| `card` → `bg-card` | `#FFFFFF` | Cards, inputs, sheets, nav bars, table bodies | ink 17.9:1 |
| `sunken` → `bg-sunken` | `#F1EFEA` | Wells, segmented-control track, hovered rows, skeleton base | ink-muted 4.74:1 |
| `sunken-2` → `bg-sunken-2` | `#E7E4DD` | Pressed rows, placeholder fill, chart grid fills | **no brand small text** (4.31) |
| `ink` → `text-ink` | `#0F172A` | Primary text, headings, ink buttons | 17.85 on white |
| `ink-soft` → `text-ink-soft` | `#334155` | Secondary text, body copy in dense UI | 10.35 on white |
| `ink-muted` → `text-ink-muted` | `#5B6B7F` | Meta lines, captions, placeholders, helper text | 5.45 white · 5.09 sand · 4.74 sunken |
| `ink-disabled` → `text-ink-disabled` | `#94A3B8` | Disabled labels, decorative strokes only | 2.56 — never meaningful text |
| `line` → `border-line` | `#E5E2DA` | Hairline card borders, dividers (decorative) | 1.29 |
| `line-strong` → `border-line-strong` | `#848EA0` | Input / checkbox / select borders (meaningful boundaries) | 3.30 white · 3.08 sand |
| `brand` → `bg-brand` / `text-brand` | `#0F766E` | Primary buttons, links, active tab, selected state, focus ring | white on it 5.47 · on white 5.47 · on sand 5.11 |
| `brand-hover` | `#115E59` | Hover of brand fills, link hover | 7.58 |
| `brand-pressed` | `#134E4A` | Active/pressed brand fills, brand text on `brand-soft` | 9.48 / 8.27 |
| `brand-soft` | `#E6F2F0` | Selected row/chip bg, info pills, calendar "confirmed" chip | `brand-pressed` on it 8.27 |
| `brand-soft-line` | `#B7DAD5` | Border of selected soft chips | decorative |
| `on-brand` | `#FFFFFF` | Text/icons on brand fill | 5.47 |
| `accent` | `#F59E0B` | Star fills, "Top rated" dot, highlight underline, chart series 3. **Fills/icons only** | 2.15 on white — always paired with text |
| `accent-text` | `#B45309` | Amber text when needed ("Popular", "Only 2 slots left") | 5.02 white · 4.69 sand |
| `accent-soft` | `#FEF3C7` | Amber pill bg | `#92400E` on it 6.37 |
| `success` / `success-text` / `success-soft` | `#15803D` / `#166534` / `#DCFCE7` | Completed, paid, open now | 5.02 / 6.49 on soft |
| `warning` / `warning-text` / `warning-soft` | `#B45309` / `#92400E` / `#FEF3C7` | Pending, no-show risk, closing soon | 5.02 / 6.37 on soft |
| `danger` / `danger-text` / `danger-soft` | `#B91C1C` / `#991B1B` / `#FEE2E2` | Destructive, cancelled, errors | white on danger 6.47 / 6.80 on soft |
| `overlay` | `rgba(15,23,42,0.48)` | Dialog/sheet scrim | — |
| `focus` | `#0F766E` | 2px outline, offset 2px | ≥3:1 vs white and sand |
| `inverse` / `on-inverse` | `#0F172A` / `#F8F7F4` | Toasts, ink buttons, tooltips, map active pin | 16.66 |

> Owner's muted `#64748B` passes on white (4.76) but **fails on the sand page (4.44)** and on `sunken` (4.14). v2 nudges the muted token to `#5B6B7F` (visually indistinguishable, passes everywhere it is used). `#64748B` remains a primitive (`--slate-500`) for icons ≥ 24px and chart series 5.

**Chart palette (light)**, all ≥3:1 on white for graphical objects: `chart-1 #0F766E` (teal, always the "this shop / this period" series), `chart-2 #3B6FB6` (slate blue, 5.08), `chart-3 #D97706` (amber, 3.19 — bars/areas only, never thin lines under 2px), `chart-4 #BE185D` (raspberry, 6.04), `chart-5 #64748B` (slate, 4.76, "previous period"/"other"). Grid lines `#E5E2DA`, axis labels `ink-muted`. Area fills = series colour at 12% opacity.

### 2.3 Colour — dark (`:root[data-theme="dark"]`, `:root.dark`)

Dark is driven by `theme-provider.tsx` as today. Background is the owner's `#0B1514` (teal-black); surfaces step up in lightness, never with shadows alone.

| Token | Hex | Contrast notes |
|---|---|---|
| `page` | `#0B1514` | ink 16.49 |
| `card` | `#111E1C` | ink 15.21 |
| `sunken` | `#172725` | ink-muted 5.85 |
| `sunken-2` | `#1F3330` | ink-muted 5.03 |
| `ink` | `#ECF3F1` | |
| `ink-soft` | `#B8C7C4` | 9.79 on card |
| `ink-muted` | `#8FA3A0` | 6.45 card · 5.85 sunken · 5.03 sunken-2 |
| `ink-disabled` | `#4B6360` | decorative only |
| `line` | `#22312F` | decorative |
| `line-strong` | `#567370` | 3.33 on card |
| `brand` (fill) | `#2DD4BF` | text on it = `on-brand #042F2E` 7.77 |
| `brand-hover` | `#5EEAD4` | `#042F2E` on it 9.78 |
| `brand-pressed` | `#99F6E4` | |
| `brand-text` (links, active tab text) | `#5EEAD4` | 11.58 on card, 12.54 on page |
| `brand-soft` | `#0F2E2B` | `#99F6E4` on it 11.52 |
| `brand-soft-line` | `#1D4B46` | |
| `on-brand` | `#042F2E` | |
| `accent` | `#FBBF24` | 10.26 on card |
| `accent-text` | `#FCD34D` | 11.88 |
| `accent-soft` | `#2A2210` | |
| `success-text` / `success-soft` | `#86EFAC` / `#0F2A1A` | 10.95 |
| `warning-text` / `warning-soft` | `#FCD34D` / `#2A2210` | 10.91 |
| `danger` / `danger-text` / `danger-soft` | `#F87171` / `#FCA5A5` / `#2E1414` | 6.19 / 9.02 |
| `overlay` | `rgba(0,0,0,0.6)` | |
| `focus` | `#5EEAD4` | |
| `inverse` / `on-inverse` | `#ECF3F1` / `#0B1514` | |

In light mode `brand-text` = `brand` (`#0F766E`). Always use `text-brand-text` for teal **text** so dark mode picks the lighter teal; use `bg-brand` for fills.

**Chart palette (dark)** on `#111E1C`: `#2DD4BF` (9.2), `#5B8DEF` (5.3), `#FBBF24` (10.26), `#F472B6` (6.47), `#94A3B8` (6.68). Grid `#22312F`.

### 2.4 `@theme` block to add (copy-ready)

```css
@theme {
  --color-page: #F8F7F4;        --color-card: #FFFFFF;
  --color-sunken: #F1EFEA;      --color-sunken-2: #E7E4DD;
  --color-ink: #0F172A;         --color-ink-soft: #334155;
  --color-ink-muted: #5B6B7F;   --color-ink-disabled: #94A3B8;
  --color-line: #E5E2DA;        --color-line-strong: #848EA0;
  --color-brand: #0F766E;       --color-brand-hover: #115E59;  --color-brand-pressed: #134E4A;
  --color-brand-text: #0F766E;  --color-brand-soft: #E6F2F0;   --color-brand-soft-line: #B7DAD5;
  --color-on-brand: #FFFFFF;
  --color-accent: #F59E0B;      --color-accent-text: #B45309;  --color-accent-soft: #FEF3C7;
  --color-success: #15803D;     --color-success-text: #166534; --color-success-soft: #DCFCE7;
  --color-warning: #B45309;     --color-warning-text: #92400E; --color-warning-soft: #FEF3C7;
  --color-danger: #B91C1C;      --color-danger-text: #991B1B;  --color-danger-soft: #FEE2E2;
  --color-inverse: #0F172A;     --color-on-inverse: #F8F7F4;
  --color-focus: #0F766E;
  --color-chart-1: #0F766E; --color-chart-2: #3B6FB6; --color-chart-3: #D97706;
  --color-chart-4: #BE185D; --color-chart-5: #64748B;

  --radius-xs: 6px;  --radius-sm: 8px;  --radius-md: 10px; --radius-lg: 12px;
  --radius-xl: 16px; --radius-2xl: 20px; --radius-3xl: 28px;

  --shadow-xs:     0 1px 2px rgb(15 23 42 / 0.06);
  --shadow-card:   0 1px 2px rgb(15 23 42 / 0.04), 0 4px 12px -4px rgb(15 23 42 / 0.08);
  --shadow-raised: 0 2px 4px rgb(15 23 42 / 0.04), 0 12px 28px -10px rgb(15 23 42 / 0.18);
  --shadow-float:  0 4px 8px rgb(15 23 42 / 0.06), 0 24px 48px -16px rgb(15 23 42 / 0.28);
  --shadow-search: 0 2px 4px rgb(15 23 42 / 0.04), 0 12px 32px -8px rgb(15 23 42 / 0.14);
  --shadow-bar:    0 -1px 0 rgb(15 23 42 / 0.06), 0 -8px 24px -12px rgb(15 23 42 / 0.16);

  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-enter:    cubic-bezier(0.05, 0.7, 0.1, 1);
  --ease-exit:     cubic-bezier(0.3, 0, 0.8, 0.15);
}
```

Dark overrides go in the existing `:root.dark, :root[data-theme="dark"]` block (values in §2.3). Dark shadows: replace `rgb(15 23 42 / x)` with `rgb(0 0 0 / x*2.5)` (cap 0.6) **and** rely on surface steps + `border-line`; every elevated dark surface keeps a 1px `border-line`.

Two extra tokens for content on `inverse` surfaces (toasts, tooltips, ink bands), because `inverse` flips to light in dark mode: `--color-on-inverse-brand` light `#5EEAD4` (12.07 on `#0F172A`) / dark `#0F766E` (4.86 on `#ECF3F1`); `--color-on-inverse-danger` light `#FCA5A5` (9.41) / dark `#991B1B` (7.38).

Important clean-ups in the same change:
- **Add `@custom-variant dark (&:where(.dark, .dark *, [data-theme="dark"], [data-theme="dark"] *));`** right after the imports. Without it Tailwind 4's `dark:` follows `prefers-color-scheme`, not the app's theme store, so every `dark:` recipe in this spec would misfire. (No source file uses `dark:` today, so this is safe.)
- `:root` currently sets `--shadow-sm/md/lg: none`, which silently disables Tailwind's `shadow-sm/md/lg`. Remove those three lines (or set them to `--shadow-xs/card/raised`).
- `@theme --radius-2xl: 12px` etc. are replaced by the scale above, so `rounded-xl` = 16px and `rounded-2xl` = 20px app-wide. Named radii (`--radius-cards` 16, `--radius-images` 12, `--radius-inputs` 12, `--radius-buttons` 9999px, `--radius-tags` 9999px) are re-pointed.
- `::selection` → `background: var(--color-brand-soft); color: var(--color-ink)`.
- Scrollbar thumb → `var(--color-line-strong)`.
- `.eyebrow` → `color: var(--color-brand-text)`, keep `[dir=rtl]` no-tracking/no-uppercase rule.

### 2.5 Radius, elevation, spacing, layout

**Radius** — `rounded-xs` 6 calendar event chips · `rounded-sm` 8 table cells, small badges in dense UI, tooltips · `rounded-md` 10 sidebar items, menu items · `rounded-lg` 12 inputs, selects, images inside cards, map popover · `rounded-xl` 16 cards, stat cards, shop cards · `rounded-2xl` 20 dialogs, hero media, desktop booking card · `rounded-3xl` 28 mobile bottom-sheet top corners (`rounded-t-3xl`) · `rounded-full` buttons, pills, search bar, avatars, segmented control.

**Elevation** (light) — level 0: `bg-page` (no shadow). Level 1 resting card: `bg-card border border-line shadow-card` (marketplace) or `bg-card border border-line` (dashboard — dense UI stays flat). Level 2 hover/selected card, sticky booking card, search bar: `shadow-raised` / `shadow-search`. Level 3 dialog, popover, dropdown, map popover: `shadow-float`. Sticky bottom bar: `shadow-bar`. Never stack two shadows on nested elements.

**Spacing** (4px base; use Tailwind numeric scale only): 1=4 · 2=8 · 3=12 · 4=16 · 5=20 · 6=24 · 8=32 · 10=40 · 12=48 · 16=64 · 20=80 · 24=96. Rules: inline gap between icon and label `gap-2`; card padding `p-4` mobile / `p-5` desktop (marketplace), `p-4` everywhere in dashboard; stack inside a card `space-y-3`; between sections on marketplace pages `py-10 md:py-16`; between dashboard blocks `gap-4 lg:gap-6`. Touch targets ≥ 44×44 (buttons `h-11` minimum on touch layouts; `h-9` allowed only for inline row actions with `min-w-11` hit area).

**Breakpoints** (Tailwind defaults): base 0–639 (design at **375**), `sm` 640, `md` 768, `lg` 1024 (desktop layouts, sidebar appears, sticky right booking card), `xl` 1280 (design at **1280**), `2xl` 1536.

**Containers** — marketplace: `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8` (1280 max). Reading/booking/forms: `max-w-3xl`. Auth: `max-w-md`. Dashboard content: `px-4 py-4 lg:px-8 lg:py-6`, fluid, `max-w-[1440px]`. Grids: shop results `grid gap-4 sm:grid-cols-2 xl:grid-cols-3`; rails are horizontal scrollers (`flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-4 -mx-4 px-4 no-scrollbar`, card `w-[78%] sm:w-[46%] lg:w-[calc(25%-12px)] shrink-0 snap-start`).

### 2.6 Legacy alias mapping (globals.css owner applies exactly this)

| Legacy var | Light → | Dark → |
|---|---|---|
| `--bg-primary`, `--bg-surface`, `--bg-elevated`, `--glass-bg*`, `--color-surface*`, `--color-surface-container-lowest/low`, `--color-background`* | `card #FFFFFF` (*`--color-background` → `page #F8F7F4`) | `card` / `page` |
| `--bg-secondary`, `--bg-surface-hover`, `--color-surface-container`, `--skeleton-base`, `--color-*-container` (non-error) | `sunken #F1EFEA` | `sunken` |
| `--color-surface-container-high`, `--color-primary-fixed-dim` | `sunken-2 #E7E4DD` | `sunken-2` |
| `--text-primary`, `--color-on-surface`, `--color-primary`, `--brand-primary`, `--color-outline`, `--color-inverse-surface` | `ink #0F172A` | `ink` |
| `--text-secondary`, `--text-tertiary`, `--color-on-surface-variant`, `--color-secondary`, `--accent-lavender` | `ink-soft #334155` | `ink-soft` |
| `--text-muted`, `--color-surface-container-highest` (as text) | `ink-muted #5B6B7F` | `ink-muted` |
| `--text-disabled` | `#94A3B8` | `#4B6360` |
| `--border-subtle`, `--color-outline-variant` | `line #E5E2DA` | `line` |
| `--border-primary` | `line-strong #848EA0` | `line-strong` |
| `--border-hover`, `--accent-brass`, `--accent-blue`, `--accent-electric`, `--focus-ring`, `--color-tertiary*` | `brand #0F766E` | `brand-text #5EEAD4` |
| `--accent-text` | `brand-text #0F766E` | `#5EEAD4` |
| `--cta-bg` / `--cta-fg`, `--accent-mint` / `--on-accent`, `--accent-cobalt` | `#0F766E` / `#FFFFFF` | `#2DD4BF` / `#042F2E` (**`--on-accent` becomes `#042F2E` in dark**) |
| `--accent-blue-muted`, `--accent-mint-muted`, `--emerald-light`, `--sky-light` | `brand-soft #E6F2F0` | `brand-soft #0F2E2B` |
| `--accent-amber`, `--accent-amber-muted`, `--amber-light` | `accent #F59E0B` / `accent-soft` | `#FBBF24` / `#2A2210` |
| `--accent-rose`, `--accent-rose-muted`, `--rose-light`, `--color-error*` | `danger #B91C1C` / `danger-soft` | `#F87171` / `#2E1414` |
| `--overlay` | `rgba(15,23,42,0.48)` | `rgba(0,0,0,0.6)` |
| `--shadow-focus` | `0 0 0 3px rgb(15 118 110 / 0.28)` | `0 0 0 3px rgb(94 234 212 / 0.32)` |
| `--brand-on-primary`, `--color-on-primary` | `#FFFFFF` | `#0B1514` |

`token-contrast.test.ts` keeps passing with these values (brand-on-primary/brand-primary 17.85 light, ~16 dark; cta-fg/cta-bg 5.47 / 7.77; dark `text-primary` vs `on-accent` 1.1 < 3). Add assertions for `ink-muted` on `page`/`sunken` ≥ 4.5 and `brand-text` on `card` ≥ 4.5 in both modes.

**Hard-coded colours to purge** (each owner of the file): any `#7c5a26 #a67c3d #c9a063 #d6b07a #1c1611 #14110e #f7f1e4 #ede3cd #5a5147 #7c4a1e`, any `rgba(166,124,61,…)`, `rgba(201,160,99,…)`, `rgba(124,90,38,…)`, `rgba(28,22,17,…)`. Current offenders: `for-business/landing-client.tsx`, `for-business/page.tsx`, `shop/[shop_id]/shop-profile-client.tsx`, `start/_components/location-map.tsx`, `start/_components/share-screen.tsx`, `global-error.tsx`, `manifest.ts` (theme/background colour → `#0F766E` / `#F8F7F4`), `components/booking/booking-css.ts`, `components/calendar/{calendar-model.ts,slot-popover.tsx,time-grid.tsx}`, `components/layout/sidebar.tsx`, `components/links/{link-utils.ts,link-utils.test.ts,links-settings.tsx,poster-layout.ts,qr-poster.tsx}`, `components/search/{filter-bar,results-map,search-bar,search-results,shop-card}.tsx`, `components/settings/settings-page.tsx`, `components/ui/{booking-cta,toast}.tsx`. Canvas/PNG/QR/map code that cannot read CSS vars uses the hex table above (light values; posters are always light).

---

## 3. Typography

**Families — keep both.** EN: **BDO Grotesk** (local, 300–900) — a neutral neo-grotesk that already gives the clean marketplace tone. AR: **Cairo** (`next/font/google`, 400–900) — geometric, pairs with BDO's apertures, and has the 800/900 weights we need for Arabic display. Evaluated and not adopted now: *IBM Plex Sans Arabic* (more "corporate", tops out at 700, and the QR poster renderer reads `--font-cairo`) and *Readex Pro* (wide, less legible at 12–13px). No font-loading changes are required for v2.

Numerals: `font-variant-numeric: tabular-nums` (`tabular-nums`) on prices, times, durations, stats, table numbers, calendar. Digits follow the user's digit preference via existing `formatLocalizedNumber`.

Tracking: EN headings `tracking-tight` (−0.02em) at ≥24px, `tracking-[-0.01em]` 18–22px, body 0. **AR: always `tracking-normal`** (existing `[dir=rtl]` rule zeroes `--ls-*`; never apply `tracking-*` or `uppercase` utilities without an `rtl:tracking-normal rtl:normal-case` pair — prefer not using them at all). Arabic gets ~+12% line-height and one weight step lighter at display sizes (Cairo is heavy).

| Role | EN (size/line-height · weight) | AR (size/line-height · weight) | Tailwind recipe (EN default; add AR via `rtl:`) |
|---|---|---|---|
| Display (hero) | 36/40 · 700 → `md:` 56/60 | 32/48 · 800 → `md:` 48/68 · 800 | `text-[36px] leading-[40px] md:text-[56px] md:leading-[60px] font-bold tracking-tight rtl:text-[32px] rtl:leading-[48px] rtl:md:text-[48px] rtl:md:leading-[68px] rtl:font-extrabold rtl:tracking-normal` |
| H1 (page title) | 28/34 · 700 → `md:` 36/44 | 26/40 · 700 → `md:` 32/48 | `text-[28px] leading-[34px] md:text-4xl md:leading-[44px] font-bold tracking-tight rtl:leading-[40px] rtl:md:leading-[48px] rtl:tracking-normal` |
| H2 (section) | 22/28 · 700 → `md:` 28/36 | 20/32 · 700 → `md:` 26/40 | `text-[22px] leading-7 md:text-[28px] md:leading-9 font-bold tracking-tight rtl:leading-8 rtl:md:leading-10 rtl:tracking-normal` |
| H3 (card / panel title) | 18/24 · 600 | 18/28 · 700 | `text-lg leading-6 font-semibold rtl:leading-7 rtl:font-bold` |
| Title (list item, shop name in card) | 16/22 · 600 | 16/26 · 700 | `text-base leading-[22px] font-semibold rtl:leading-[26px] rtl:font-bold` |
| Body L (marketing lead) | 18/28 · 400 | 18/30 · 400 | `text-lg leading-7 text-ink-soft rtl:leading-[30px]` |
| Body (default) | 15/24 · 400 | 15/26 · 400 | `text-[15px] leading-6 rtl:leading-[26px]` |
| Body S / UI | 14/20 · 500 | 14/22 · 500 | `text-sm leading-5 font-medium rtl:leading-[22px]` |
| Meta / caption | 13/18 · 400 | 13/20 · 400 | `text-[13px] leading-[18px] text-ink-muted rtl:leading-5` |
| Micro (pill, table header) | 12/16 · 600 | 12/18 · 600 | `text-xs leading-4 font-semibold rtl:leading-[18px]` |
| Stat number | 28/32 · 700 tabular → `lg:` 32/36 | same (digits) | `text-[28px] leading-8 lg:text-[32px] lg:leading-9 font-bold tabular-nums` |
| Price | 15/20 · 600 tabular | same | `text-[15px] font-semibold tabular-nums` |

Recommended: register these as `@utility` helpers in globals.css (`text-display`, `text-h1`, `text-h2`, `text-h3`, `text-title`, `text-body`, `text-meta`, `text-micro`) with the `[dir=rtl] &` variants inside, so pages write `className="text-h2"` instead of the long strings above. The recipes in §5 assume those helpers exist.

Body `letter-spacing: var(--ls-body)` stays (0.0091em EN, 0 AR). Max line length for prose `max-w-[65ch]`.

---

## 4. Imagery

**Ratios** (always `next/image` with `fill` inside an aspect box, `object-cover`, `sizes` set, bilingual alt):

| Slot | Ratio | Radius | Notes |
|---|---|---|---|
| Shop card media (search, rails, home) | **4:3** (`aspect-[4/3]`) | `rounded-lg` inside card padding-less top, or card `rounded-xl` with `overflow-hidden` | `sizes="(min-width:1280px) 400px,(min-width:640px) 50vw,100vw"` |
| Shop hero — desktop mosaic | grid `grid-cols-[2fr_1fr] grid-rows-2 h-[440px] gap-2`, main cell spans 2 rows | `rounded-2xl overflow-hidden` on the grid | "Show all photos (N)" button bottom-end |
| Shop hero — mobile | full-bleed **4:3** swipe carousel, `snap-x` | none (edge to edge) | 1/N counter pill bottom-end, back/share/save round buttons top |
| Portfolio | **1:1** grid `grid-cols-3 gap-1 sm:gap-2` | `rounded-sm` | Lightbox on tap |
| Barber card photo | **4:5** portrait | `rounded-xl` | name + role under, rating chip |
| Barber page header | avatar 96 → `md:` 128 circle | `rounded-full ring-4 ring-card` | overlapping a 3:1 sand/teal banner |
| Avatars (team rail, reviews, topbar) | 1:1 | `rounded-full` | sizes 32/40/56/72 |
| Category tile | 1:1 icon tile or 3:2 photo | `rounded-xl` | icon on `bg-brand-soft`, photo with bottom scrim |
| OG/poster | existing sizes | — | colours from §2.2 hex |

**Placeholders (no photo)** — never a grey box. Use `ShopCover`-style deterministic pick (same shop → same cover), from four branded fills; render initials (max 2 graphemes) centred, `font-extrabold text-[34px] md:text-[40px]`, plus the sand-stripe hatch at low opacity:

| # | Background | Initials colour | Contrast |
|---|---|---|---|
| 1 Teal | `linear-gradient(135deg,#0F766E 0%,#134E4A 100%)` | `#FFFFFF` | ≥5.47 |
| 2 Sand | `linear-gradient(135deg,#F1EFEA 0%,#E7E4DD 100%)` | `#115E59` | 5.97 |
| 3 Ink | `linear-gradient(135deg,#1E293B 0%,#0F172A 100%)` | `#F8F7F4` | 13.65 |
| 4 Amber | `linear-gradient(135deg,#FEF3C7 0%,#FDE68A 100%)` | `#92400E` | 5.69 |

Hatch overlay (the sand stripe): `background-image: repeating-linear-gradient(135deg, rgb(255 255 255 / 0.06) 0 2px, transparent 2px 12px)` (on Sand/Amber use `rgb(15 23 42 / 0.04)`). In dark mode keep the same fills (they are brand art, not surfaces). `COVER_PALETTE` in `shop-utils.ts` moves from var-based pairs to these four `{ bg, fg }` entries. Barber placeholder = same system with the barber's initials on a circle.

**Loading** — `bg-sunken` box at the final ratio + `placeholder="blur"` where a blurDataURL exists; fade image in `opacity-0 → 100` over 200ms on load (no fade under reduced motion).

**Overlays** — only when text sits on a photo: bottom scrim `bg-gradient-to-t from-[rgb(11_21_20/0.72)] via-[rgb(11_21_20/0.24)] to-transparent` covering the lower 60%; text on it `text-white` (≥7:1 at scrim base). Chips on photos: `bg-white/92 text-ink shadow-xs backdrop-blur-sm rounded-full h-7 px-2.5 text-xs font-semibold` (dark mode identical — photos don't theme). Round icon buttons on photos: `size-10 rounded-full bg-white/92 text-ink shadow-xs grid place-items-center`.

**Framing guidance for shops uploading photos** (surface in settings/profile media help text): cover = interior wide shot with chairs and light, landscape; avoid text-heavy logos as covers; barber photo = chest-up, face visible, plain/blurred background; portfolio = finished cut, back/side profile, good light. Recommend ≥1600px long edge.

---

## 5. Components (exact recipes)

Shared base strings (export from `src/components/ui/recipes.ts` or keep inline):

```ts
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const press = "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[var(--ease-standard)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100";
const disabled = "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45";
```

### 5.1 Button

Base: `inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none ${focus} ${press} ${disabled}`

| Variant | Classes |
|---|---|
| primary | `bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-pressed shadow-xs` |
| secondary (outline) | `bg-card text-ink border border-line-strong hover:border-ink hover:bg-sunken` |
| ink (marketplace alt-primary, e.g. "Search", "Continue" on photo) | `bg-inverse text-on-inverse hover:bg-ink-soft` |
| soft | `bg-brand-soft text-brand-pressed hover:bg-brand-soft-line/60 dark:text-brand-text` |
| ghost | `bg-transparent text-ink-soft hover:bg-sunken hover:text-ink` |
| link | `h-auto px-0 rounded-sm text-brand-text underline-offset-4 hover:underline font-semibold` |
| destructive | `bg-danger text-white hover:brightness-95 dark:text-[#2E1414]` (6.47 light / 6.19 dark) |
| destructive-soft | `bg-danger-soft text-danger-text border border-transparent hover:border-danger/30` |

| Size | Classes |
|---|---|
| sm | `h-9 px-3.5 text-sm [&_svg]:size-4` |
| md (default) | `h-11 px-5 text-[15px] [&_svg]:size-[18px]` |
| lg (booking CTA, hero) | `h-12 px-6 text-base [&_svg]:size-5` |
| xl (sticky bar CTA mobile) | `h-[52px] px-7 text-base` |
| icon | `size-11 p-0` (`size-9` for sm) + required `aria-label` |

Loading: keep width, swap label for `<span class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />` + `aria-busy`. Rules: exactly one primary per surface; destructive actions are always confirmed via `ConfirmDialog`. `GlassButton` keeps its API and maps `primary→primary`, `secondary→secondary`, `ghost→ghost`, `danger→destructive-soft`; drop its framer `scale 1.02` hover (use `press` instead). `BookingCta` PRIMARY → `bg-brand text-on-brand hover:bg-brand-hover`, SECONDARY (inline "Book") → `soft` variant `h-9 px-4 text-sm`.

### 5.2 Input / Select / Textarea

- Label: `text-sm font-semibold text-ink mb-1.5 block`; helper `text-[13px] text-ink-muted mt-1.5`; error `text-[13px] font-medium text-danger-text mt-1.5 flex gap-1.5` with icon + `aria-describedby`.
- Input: `h-12 w-full rounded-lg border border-line-strong bg-card px-4 text-[15px] text-ink placeholder:text-ink-muted hover:border-ink-soft focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15 disabled:bg-sunken disabled:text-ink-disabled transition-[border-color,box-shadow] duration-150`. With leading icon: `ps-11` and icon `absolute inset-y-0 start-4 grid place-items-center text-ink-muted [&_svg]:size-5`.
- Select: same as input + `appearance-none pe-10` + chevron `absolute end-4`.
- Textarea: same, `min-h-28 py-3 leading-6`.
- Phone input: country prefix as non-editable segment `border-e border-line pe-3 me-3 text-ink-soft tabular-nums`; always `dir="ltr"` on the number field.
- OTP: 6 boxes `size-12 rounded-lg border border-line-strong text-center text-xl font-bold tabular-nums focus:border-brand focus:ring-4 focus:ring-brand/15`, `gap-2`, `dir="ltr"`.
- Checkbox/radio (`@tailwindcss/forms`): `size-5 rounded-[6px] border-line-strong text-brand focus:ring-brand/30`; radio `rounded-full`. Switch: track `h-6 w-11 rounded-full bg-line-strong data-[state=on]:bg-brand`, thumb `size-5 bg-white shadow-xs translate-x` using logical `data-[state=on]:translate-x-5 rtl:data-[state=on]:-translate-x-5`.
- The legacy `.field-input` / `.auth-input` / `.minimal-input` classes in globals.css adopt exactly these values so untouched forms update automatically.

### 5.3 Marketplace search bar (the hero object)

Desktop (`md:`) — one big pill with three segments + button:
```
<form role="search" class="mx-auto flex w-full max-w-4xl items-stretch rounded-full bg-card border border-line shadow-search p-1.5">
  segment: "flex-1 min-w-0 flex items-center gap-3 rounded-full px-5 py-2.5 text-start hover:bg-sunken focus-within:bg-sunken"
    icon: "[&_svg]:size-5 text-ink-muted"
    label: "block text-xs font-semibold text-ink"          (What / Where / When)
    value: "block truncate text-sm text-ink-muted"          (All services / Amman / Any time)
  divider between segments: "w-px self-center h-8 bg-line"
  submit: Button primary size lg "h-14 px-7 rounded-full" with search icon + label (icon-only below lg: "size-14")
</form>
```
Mobile (base): a single tappable pill `h-14 w-full rounded-full bg-card border border-line shadow-search flex items-center gap-3 px-5` showing "All services · Amman · Any time" (MetaLine) that opens a **full-screen search sheet** with the three fields stacked (big inputs, recent searches, popular areas as pills) and a sticky "Search" primary `xl` button. Behaviour and URL params unchanged (`q, area, when, sort, f[]`) — only presentation. On results pages the bar collapses into the sticky top nav (`h-11` compact pill, `shadow-xs`).

Popovers for each segment (desktop): `absolute mt-3 w-[min(420px,90vw)] rounded-2xl bg-card border border-line shadow-float p-2` with option rows `flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-sunken aria-selected:bg-brand-soft`.

### 5.4 Cards

**Shop card** (search grid, rails, home):
```
article: "group relative flex flex-col overflow-hidden rounded-xl bg-card border border-line shadow-card transition-shadow duration-200 hover:shadow-raised focus-within:shadow-raised data-[active=true]:ring-2 data-[active=true]:ring-brand"
media:   "relative aspect-[4/3] overflow-hidden bg-sunken"  image: "object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transform-none"
  top-start: badges (Pill on-photo variant), top-end: distance chip / save heart (icon button on photo)
body:    "flex flex-1 flex-col gap-1.5 p-4"
  name:  "text-title text-ink line-clamp-1"  (whole card clickable via stretched link: name <a> has "after:absolute after:inset-0")
  meta:  MetaLine "text-meta"  →  ★ 4.9 (312) · Khalda · Open until 11:00 pm   (star: size-3.5 fill-accent text-accent)
  services (search only, ≤3): ServiceRow compact
  footer: "mt-auto flex items-center justify-between pt-3 border-t border-line"  → "Next: Today 5:30 pm" (text-sm font-medium text-success-text) + "See all N" link
```
Inline Book buttons stay above the stretched link (`relative z-10`). Active-from-map state uses `data-active` (no brass shadows).

**Service row** (shop page, booking step 1, search card compact):
```
"flex items-start gap-4 py-4 border-b border-line last:border-b-0"
  text: "min-w-0 flex-1"  name "text-title text-ink"; meta "text-meta mt-0.5" (30–45 min · with any barber); description "text-sm text-ink-muted line-clamp-2 mt-1"
  end:  "flex flex-col items-end gap-2 shrink-0"  price "text-[15px] font-semibold tabular-nums text-ink" (from/was: "text-ink-muted line-through text-xs") + BookingCta inline (soft sm)
```
Selectable variant (booking): wrapper `rounded-xl border border-line bg-card px-4 hover:border-ink-soft has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40 has-[:checked]:ring-1 has-[:checked]:ring-brand` with a trailing 24px check circle (`rounded-full border-2 border-line-strong` → checked `bg-brand border-brand text-on-brand`).

**Barber card**: `flex flex-col gap-3 text-center` → photo `aspect-[4/5] rounded-xl overflow-hidden bg-sunken` (or 72px avatar circle in compact rail: `size-[72px] rounded-full mx-auto`), name `text-title`, role `text-meta`, rating `inline-flex items-center gap-1 text-sm font-semibold` with amber star. Selectable in booking: `rounded-2xl border border-line p-3 hover:border-ink-soft aria-pressed:border-brand aria-pressed:ring-1 aria-pressed:ring-brand`. "Any barber" option = first card with a 3-avatar stack and "Maximum availability" meta.

**Review card**: `rounded-xl bg-card border border-line p-5 flex flex-col gap-3` → header `flex items-center gap-3` (avatar 40, name `text-sm font-semibold`, date `text-meta`), stars row (`size-4`), body `text-[15px] leading-6 text-ink-soft line-clamp-4`, footer meta "Skin fade · with Ahmad". Shop reply nested `ms-4 border-s-2 border-line ps-4 text-sm text-ink-muted`. Rating summary block (shop page): big number `text-[48px] leading-none font-bold tabular-nums` + stars + "312 reviews", then 5→1 distribution bars `h-2 rounded-full bg-sunken` with fill `bg-accent`.

**Stat card** (dashboard, analytics): `rounded-xl bg-card border border-line p-4 lg:p-5 flex flex-col gap-2` → label `text-sm font-medium text-ink-muted flex items-center gap-2` (16px icon in `size-8 rounded-lg bg-brand-soft text-brand-text grid place-items-center`), value `text-stat text-ink`, delta row `text-xs font-semibold` (`text-success-text` ▲ / `text-danger-text` ▼ + "vs last week" `text-ink-muted font-normal`), optional sparkline 32px high in `chart-1`. Never colour the value itself.

**Generic panel** (dashboard sections, settings groups): `rounded-xl bg-card border border-line` → header `flex items-center justify-between gap-3 px-4 py-3.5 lg:px-5 border-b border-line` (title `text-h3`, action ghost sm) → body `p-4 lg:p-5`. `GlassCard` / `.atelier-card` / `.glass-card-premium` map to this.

### 5.5 Pill / Badge

Base: `inline-flex max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-semibold leading-none [&_svg]:size-3.5` · sizes `sm: h-5 px-2 text-[11px]` · `md: h-6 px-2.5 text-xs` · `lg (filter chip): h-9 px-3.5 text-sm font-medium`.

| Tone (existing `PillTone` + new) | Classes |
|---|---|
| neutral | `bg-sunken text-ink-soft` |
| ink | `bg-inverse text-on-inverse` |
| brand (was `brass`; keep `brass` as alias) | `bg-brand-soft text-brand-pressed dark:text-brand-pressed` (dark value of brand-pressed is `#99F6E4`) |
| accent (Top rated, Popular) | `bg-accent-soft text-warning-text` + star/flame icon |
| success | `bg-success-soft text-success-text` |
| warning | `bg-warning-soft text-warning-text` |
| danger | `bg-danger-soft text-danger-text` |
| on-photo | `bg-white/92 text-ink shadow-xs backdrop-blur-sm` |

Pills lose their 1px border (v2 is fill-only) except **filter chips**: `border border-line-strong bg-card text-ink hover:border-ink aria-pressed:bg-inverse aria-pressed:text-on-inverse aria-pressed:border-inverse` (selected = ink, not teal, so the brand colour stays for the single CTA). Status always icon + label (calendar `StatusPill` keeps its icon map; tones: confirmed→brand, completed→success, pending→warning, no-show→danger, cancelled→neutral with strike icon).

### 5.6 Tabs / segmented control

- **Underline tabs** (shop page sections, settings sub-nav, analytics periods on desktop): list `flex gap-6 border-b border-line overflow-x-auto no-scrollbar`; tab `relative h-12 text-[15px] font-medium text-ink-muted hover:text-ink aria-selected:text-ink aria-selected:font-semibold` + indicator `after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-ink aria-selected:after:block after:hidden`. Sticky variant on shop page: wrapper `sticky top-[var(--nav-h)] z-20 bg-page/95 backdrop-blur supports-[backdrop-filter]:bg-page/80`.
- **Pill tabs** (service categories, explore Shops/Barbers): `flex gap-2 overflow-x-auto no-scrollbar`; tab `h-10 px-4 rounded-full text-sm font-semibold border border-line bg-card text-ink-soft hover:border-ink-soft aria-selected:bg-inverse aria-selected:text-on-inverse aria-selected:border-inverse`.
- **Segmented control** (Day/Week/Month, List/Map, period pickers): track `inline-flex rounded-full bg-sunken p-1`; segment `h-9 px-4 rounded-full text-sm font-semibold text-ink-muted aria-selected:bg-card aria-selected:text-ink aria-selected:shadow-xs transition-colors`.
Keyboard: arrow keys move, Home/End, `role="tablist"`; existing `scroll-spy-tabs.tsx` keeps its behaviour.

### 5.7 Sheet / Dialog

- Scrim: `fixed inset-0 z-50 bg-[var(--overlay)] data-[state=open]:animate-in fade-in`.
- **Dialog (≥ md)**: `fixed z-50 inset-x-4 top-1/2 -translate-y-1/2 mx-auto w-auto max-w-lg rounded-2xl bg-card border border-line shadow-float` → header `flex items-start justify-between gap-4 px-6 pt-6` (title `text-h3`, close icon button ghost `size-10 -me-2 -mt-2`) → body `px-6 py-4 max-h-[70vh] overflow-y-auto` → footer `flex flex-col-reverse gap-3 px-6 pb-6 sm:flex-row sm:justify-end` (secondary then primary; destructive primary for ConfirmDialog). Sizes: `max-w-md` confirm, `max-w-lg` default, `max-w-2xl` forms, `max-w-4xl` checkout.
- **Bottom sheet (base, < md)** — same dialog component switches presentation: `fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] rounded-t-3xl bg-card shadow-float pb-[max(16px,env(safe-area-inset-bottom))]` with grab handle `mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong/60` and sticky footer buttons full width.
- **Side sheet** (lead drawer, appointment details on desktop): `fixed inset-y-0 end-0 z-50 w-full max-w-md bg-card border-s border-line shadow-float` sliding from the inline-end (mirror in RTL automatically via `end-0` + translate `ltr:translate-x-full rtl:-translate-x-full` when closed).
- Focus trap, Esc, return focus, `aria-modal`, `aria-labelledby` — keep `dialog.tsx` behaviour/tests.

### 5.8 Sticky bottom bar (mobile booking/summary/actions)

`fixed inset-x-0 bottom-0 z-40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 border-t border-line shadow-bar px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden` → inner `mx-auto flex max-w-3xl items-center gap-4` → summary `min-w-0 flex-1` (line 1 `text-sm font-semibold text-ink tabular-nums` "45.000 JD", line 2 `text-meta truncate` "2 services · 60 min") → CTA Button primary `xl` `flex-1 max-w-[220px]`. Page content gets `pb-28 lg:pb-0`. Only one sticky bar per screen; it hides while the on-screen keyboard is open (existing behaviour, if any, unchanged).

### 5.9 Top nav (marketplace) and footer

**Top nav**: `sticky top-0 z-40 h-16 bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75 border-b border-line` (on home hero at scroll 0: `bg-transparent border-transparent`, gains bg after 8px scroll — CSS-only via `data-scrolled`). Inner container `max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-full`:
start → wordmark "Halaqy / حلاقي" (`text-xl font-extrabold tracking-tight text-ink`, teal dot/mark from the existing icon) · center (results pages, `md:`) → compact search pill · end → "For business" ghost link (`hidden md:inline-flex`), language toggle (ghost icon+label "عربي"/"English"), account: signed-out "Log in" secondary sm, signed-in avatar 36 button opening a menu (`rounded-2xl shadow-float w-64 p-2`). Mobile: wordmark + search icon + avatar/menu; a slide-in menu sheet from inline-end.

**Footer**: `bg-card border-t border-line mt-16` → `max-w-7xl py-12 grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]` → brand column (wordmark, one-line promise `text-sm text-ink-muted max-w-xs`, language + digits preference) · columns "Customers", "For business", "Halaqy" (`text-sm font-semibold text-ink mb-3` + links `text-sm text-ink-muted hover:text-ink leading-8`) → bottom row `border-t border-line py-6 flex flex-col gap-3 md:flex-row md:justify-between text-[13px] text-ink-muted` (© Halaqy · Amman, Jordan · Terms · Privacy · Policy).

### 5.10 Dashboard sidebar + topbar

**Sidebar (lg+)**: widen from the 88px icon rail to a **240px labelled sidebar** with collapse-to-72px toggle (`--sidebar-width: 240px`, collapsed `72px`, persisted in the existing store if present, else localStorage). `fixed inset-y-0 start-0 z-30 w-[var(--sidebar-width)] bg-card border-e border-line flex flex-col` → header `h-16 px-4 flex items-center gap-3 border-b border-line` (shop avatar 32 `rounded-lg` + shop name `text-sm font-semibold truncate` + chevron for location switcher if any) → nav `flex-1 overflow-y-auto px-3 py-3 space-y-0.5` with group labels `px-3 pt-4 pb-1.5 text-xs font-semibold text-ink-muted` → item `.sidebar-item` = `flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-ink-soft hover:bg-sunken hover:text-ink [&_svg]:size-5` · active `bg-brand-soft text-brand-pressed font-semibold [&_svg]:text-brand-text` (dark: `text-brand-text`) with `aria-current="page"` · footer `p-3 border-t border-line` (help, theme toggle, profile). Collapsed: labels `sr-only`, tooltips on hover/focus. **Mobile (< lg)**: bottom tab bar (5 items: Today, Calendar, Queue, Clients, More) `fixed bottom-0 inset-x-0 h-16 bg-card border-t border-line grid grid-cols-5 pb-[env(safe-area-inset-bottom)]`, tab `flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-ink-muted aria-[current=page]:text-brand-text`; "More" opens a sheet with the rest of `nav-config`. Nav items/routes come from `nav-config.ts` unchanged.

**Topbar**: `sticky top-0 z-20 h-16 bg-page/90 backdrop-blur border-b border-line px-4 lg:px-8 flex items-center gap-3` → page title `text-h3 truncate` (mobile shows shop switcher) · spacer · global search pill (`hidden md:flex h-10 w-72 rounded-full bg-card border border-line px-4 text-sm text-ink-muted` with ⌘K hint) · "New" primary sm (opens existing FAB actions: Appointment, Walk-in, Block time) · notification bell icon button with count dot `absolute top-2 end-2 size-2 rounded-full bg-danger ring-2 ring-card` · avatar.

### 5.11 Table / list rows

- Desktop table: wrapper `rounded-xl border border-line bg-card overflow-hidden`; `table w-full text-sm`; thead `bg-sunken/60 text-xs font-semibold text-ink-muted text-start` cells `h-10 px-4`; rows `h-14 border-t border-line hover:bg-sunken/60 transition-colors` (`.table-row-hover`), cells `px-4 text-ink`, numeric `text-end tabular-nums`, row actions in last cell as ghost icon buttons appearing `opacity-0 group-hover:opacity-100 focus-within:opacity-100` (always visible on touch: `[@media(hover:none)]:opacity-100`). Sticky header `sticky top-16 z-10` inside long lists.
- Mobile list row (replaces tables < md): `flex items-center gap-3 px-4 py-3 border-b border-line bg-card active:bg-sunken` → avatar 40 → text block (title `text-[15px] font-semibold`, meta `text-meta`) → trailing value/chevron (`rtl:rotate-180`). Grouped lists use a `rounded-xl border border-line overflow-hidden` wrapper with `text-xs font-semibold text-ink-muted px-4 pt-5 pb-2` group headers.
- Empty table → EmptyState (§5.13), loading → 6 skeleton rows.

### 5.12 Calendar event chip

`absolute inset-x-0.5 rounded-xs border-s-[3px] px-2 py-1 text-xs leading-4 overflow-hidden shadow-xs focus-visible:outline-2 focus-visible:outline-focus` · title line `font-semibold truncate` (client name) · second line `truncate opacity-80 tabular-nums` (service · 10:30–11:15) · ≥ 45 min shows third line (barber or price).

| Status | Fill / text / start border |
|---|---|
| confirmed | `bg-brand-soft text-brand-pressed border-brand` |
| pending / requested | `bg-warning-soft text-warning-text border-warning` + dashed `border-dashed` on the whole chip |
| in progress / arrived | `bg-brand text-on-brand border-brand-pressed` |
| completed / paid | `bg-success-soft text-success-text border-success` |
| no-show | `bg-danger-soft text-danger-text border-danger` |
| cancelled | `bg-sunken text-ink-muted border-line-strong line-through` |
| blocked time / prayer block | `bg-[repeating-linear-gradient(135deg,var(--color-sunken)_0_6px,var(--color-sunken-2)_6px_12px)] text-ink-muted border-line-strong` |
| walk-in | as confirmed + small "W" pill |

Grid: hour lines `border-line`, half-hour `border-line/50 border-dashed`, now-line `h-0.5 bg-danger` with `size-2.5 rounded-full bg-danger` knob at the inline-start, column headers sticky with barber avatar 28 + name. Dragging: chip `shadow-float ring-2 ring-brand opacity-95 cursor-grabbing`; target slot `bg-brand-soft/60`. `calendar-model.ts` colour constants switch to these tokens (CSS var strings).

### 5.13 Empty state

`flex flex-col items-center text-center gap-3 px-6 py-12 rounded-xl border border-dashed border-line bg-card` → art: `size-16 rounded-2xl bg-brand-soft text-brand-text grid place-items-center [&_svg]:size-7` with the sand-stripe hatch at 6% (no illustrations) → title `text-h3 text-ink` → body `text-sm text-ink-muted max-w-sm` → actions `flex flex-wrap justify-center gap-2 mt-2` (primary + secondary). Always offers a next step (roadmap §2.6). Inline variant (inside a panel): no border, `py-8`.

### 5.14 Skeleton

`.skeleton` → `rounded-lg bg-sunken relative overflow-hidden after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.4s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent dark:after:via-white/5 motion-reduce:after:hidden` (RTL: shimmer direction flips with `rtl:after:translate-x-full` and a mirrored keyframe). Shapes mirror the final layout exactly (shop card = 4:3 block + 2 text lines at 60%/40% width; stat card; table rows). Show skeletons after 150ms, never spinners for page content.

### 5.15 Toast

Position: bottom-center above the sticky bar on mobile (`bottom-[calc(env(safe-area-inset-bottom)+88px)]` when a bar is present, else `bottom-4`), bottom-end on desktop (`lg:bottom-6 lg:end-6`). Toast: `flex items-start gap-3 w-[min(420px,calc(100vw-32px))] rounded-xl bg-inverse text-on-inverse px-4 py-3 shadow-float text-sm` → icon 20px (success `text-on-inverse-brand`, error `text-on-inverse-danger`, info `text-on-inverse/80`) → message `flex-1 leading-5` → optional action `text-sm font-semibold text-on-inverse-brand hover:underline` (Undo/View) → close icon `text-on-inverse/70`. `role="status"` (errors `role="alert"`), auto-dismiss 5s (paused on hover/focus), max 3 stacked with 8px gap. Keep `toast.tsx` API and tests.

### 5.16 Rating stars

Display: `inline-flex items-center gap-0.5` five `Star` icons `size-4` (`size-3.5` in meta lines, `size-5` in summary) — filled `fill-accent text-accent`, empty `fill-sunken-2 text-sunken-2` (dark `fill-line text-line`), half via clip `[clip-path:inset(0_50%_0_0)]` mirrored in RTL (`rtl:[clip-path:inset(0_0_0_50%)]`). Always paired with the number (`text-sm font-semibold tabular-nums`) and count (`text-ink-muted`), and an `aria-label` "Rated 4.9 out of 5" on the group; icons `aria-hidden`. Compact meta form: single star + "4.9 (312)". Input (review form): 5 buttons `size-11` with `aria-pressed`, hover preview, arrow-key support.

### 5.17 Map pin & map UI

- Pin = pill marker: `inline-flex items-center gap-1 h-8 px-3 rounded-full bg-card text-ink text-[13px] font-bold tabular-nums shadow-raised border border-line` showing "★ 4.9" or "from 5 JD"; tail `after:absolute after:top-full after:start-1/2 after:-translate-x-1/2 after:border-[6px] after:border-transparent after:border-t-card`.
- Hover/active (synced with list card hover): `bg-inverse text-on-inverse border-inverse scale-110 z-10` (`motion-reduce:scale-100`). Visited: `bg-sunken text-ink-soft`.
- Cluster: `size-10 rounded-full bg-brand text-on-brand font-bold text-sm ring-4 ring-brand/20 grid place-items-center`.
- User location: `size-4 rounded-full bg-[#3B6FB6] ring-4 ring-white shadow-xs` with a 20% halo.
- Popover on pin click: mini shop card `w-72 rounded-2xl shadow-float overflow-hidden` (4:3 photo, name, meta, Book).
- Map controls on the **inline-end** side: `absolute end-3 top-3 flex flex-col gap-2`, buttons `size-10 rounded-full bg-card shadow-raised`; "Search this area" pill top-center `h-10 px-4 rounded-full bg-card shadow-raised text-sm font-semibold`.
- Tile style: muted/greyscale base (tile CSS `filter: saturate(0.6)` only on base layer) so teal/ink pins pop. `results-map.tsx` hex colours → table above.

### 5.18 Other primitives (brief)

- **MetaLine**: unchanged API; separator `·` in `text-ink-disabled mx-1.5`; items `text-ink-muted`, first item may be emphasised `text-ink font-medium`.
- **Price**: `tabular-nums font-semibold text-ink`; "from" prefix `font-normal text-ink-muted`; was-price `line-through text-ink-muted text-xs`; deal price `text-success-text`.
- **Avatar stack**: `flex -space-x-2 rtl:space-x-reverse` with `ring-2 ring-card`.
- **Tooltip**: `rounded-sm bg-inverse text-on-inverse text-xs px-2 py-1 shadow-raised`.
- **Progress / stepper** (booking, onboarding): track `h-1 rounded-full bg-sunken` fill `bg-brand`; step labels `text-xs font-semibold text-ink-muted aria-[current=step]:text-ink`.
- **FAB** (mobile dashboard): `fixed bottom-20 end-4 z-30 size-14 rounded-full bg-brand text-on-brand shadow-float` → speed-dial items as `h-11 rounded-full bg-card shadow-raised px-4` labelled pills.
- **Confetti** (booking success): teal/amber/sand dots only; disabled under reduced motion (already).
- **Links** in body copy: `text-brand-text font-medium underline decoration-brand/30 underline-offset-4 hover:decoration-brand`.

---

## 6. Page blueprints

Legend: **[S]** = sticky. Mobile = 375 design, Desktop = 1280 design. Section renders only when it has content (roadmap §2.5).

### 6.1 Marketplace home (`/[locale]/landing` and the customer home)
Background `bg-page`.
1. Top nav (transparent over hero at scroll 0) **[S]**.
2. **Hero**: `pt-10 pb-12 md:pt-20 md:pb-20`, centred. Eyebrow (`search.heroEyebrow`) → Display title → Body L subtitle `max-w-2xl mx-auto` → big search bar (§5.3) → popular-area pills row (`search.popularAreas`) → social proof MetaLine ("312 booked today · 48 shops ready"). Background: sand with one subtle teal-soft radial at the top-end (`bg-[radial-gradient(60%_50%_at_85%_0%,var(--color-brand-soft),transparent)]`), no photo collage, no illustration.
3. **Book again rail** (signed-in with history) — horizontal rail of compact cards with "Book again".
4. **Categories**: H2 + 2-row horizontally scrolling 1:1 icon tiles on mobile; `lg:grid-cols-6` on desktop.
5. **Rails** (each: H2 start + "See all" link end, horizontal scroller with prev/next round buttons `hidden lg:flex` at the header end): "Top rated in Amman", "Open now near you", "New on Halaqy". Cards = Shop card (§5.4) without service rows.
6. **Reviews carousel**: 3 review cards visible desktop, 1.15 mobile.
7. **Stats band**: `bg-card border-y border-line py-12`, 4 stats in `grid-cols-2 lg:grid-cols-4`, number `text-[40px] font-bold tabular-nums text-ink`, label `text-ink-muted`.
8. **How it works**: 3 steps, numbered circles `size-10 rounded-full bg-brand-soft text-brand-text font-bold`.
9. **For business band**: full-width `rounded-3xl bg-inverse text-on-inverse p-8 md:p-14 grid md:grid-cols-2 gap-8 items-center` inside container — copy + CTA (secondary on dark: `bg-card text-ink`) + a dashboard screenshot (`rounded-2xl shadow-float`), not a Fresha-style illustration.
10. PWA install prompt (existing) → Footer.

### 6.2 Explore / search + map (`/explore`, `/customer/explore`)
- Top nav with compact search pill **[S]** → filter bar **[S]** under it (`top-16`, `h-14 bg-page/95 border-b border-line`): sort select pill, filter chips (Open now, Available today, Price, Kids, Home service, Parking, CliQ, Card), "Filters" button opening a sheet with all filters, result count at end.
- Tabs Shops / Barbers (pill tabs).
- **Desktop ≥ lg**: split `grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-0` — list column `px-8 py-6` with result header (H1 "Barbers in Khalda" `text-h2` + count) and shop cards `grid xl:grid-cols-2 gap-5`; map column **[S]** `sticky top-[120px] h-[calc(100dvh-120px)]` (no rounded corners, flush to the inline-end edge). Hover card ↔ active pin.
- **Mobile**: list only, cards single column; floating "Map" toggle `fixed bottom-6 inset-x-0 mx-auto w-fit h-11 px-5 rounded-full bg-inverse text-on-inverse shadow-float` switching to full-screen map with a bottom carousel of mini cards (snap) synced to pins; "List" toggle returns.
- No results → EmptyState with "Widen to all Amman" / "Try tomorrow"; load more = secondary button full width mobile.

### 6.3 Shop page (`/shop/[shop_id]`, `/customer/shops/[shopId]`)
- Mobile: full-bleed 4:3 photo carousel with on-photo back/share/save buttons and 1/N counter (no top nav overlap; nav becomes transparent overlay). Desktop: top nav **[S]**, then breadcrumb (`text-meta`: Amman › Khalda › Shop), then mosaic (§4).
- **Header block**: H1 shop name → MetaLine (★ 4.9 (312) · Open until 11:00 pm (success text) · Khalda, Amman · 1.2 km) → badges row (Verified, Top rated, Kids, Parking) → action row on mobile (Directions, Call/WhatsApp, Share as secondary sm icon+label pills).
- **Two-column desktop** `grid lg:grid-cols-[minmax(0,1fr)_380px] gap-12`:
  - Main: section tabs **[S]** (Services · Team · Reviews · Portfolio · About) driven by scroll-spy → **Services** (H2, category pill tabs, 3–6 rows per category, "See all N services" link into booking) → **Team** (barber cards rail, 4:5) → **Reviews** (summary + 3 review cards + "See all") → **Portfolio** (1:1 grid, 9 items, lightbox) → **About** (description, amenities icon list in 2 cols, opening hours table with today bolded, static map `aspect-[16/9] rounded-xl` + address + "Get directions") → **Nearby shops** rail.
  - Aside **[S]** `sticky top-24`: booking card `rounded-2xl bg-card border border-line shadow-raised p-6 space-y-4` → shop name `text-h3`, rating meta, next available ("Next: Today 5:30 pm" success text) → BookingCta primary `lg w-full` → open/closed status with chevron to hours → policy line ("Free cancellation until 2 hours before") `text-meta`.
- Mobile **[S]** bottom bar (§5.8): "N services · from X JD" + Book now.

### 6.4 Barber page (`/barber/[handle]`)
Header: 3:1 banner (shop cover or Teal placeholder) → overlapping avatar 96/128 `ring-4 ring-card` → H1 name, role + shop link MetaLine, rating, years experience pill → actions (Book with {name} primary; Share secondary). Body single column `max-w-3xl` (desktop 2-col with same sticky booking aside as shop page): Services they perform (service rows, Book preselects staff) → Portfolio grid → Reviews about them → "Works at" shop card. Mobile sticky bar "Book with Ahmad".

### 6.5 Booking flow (`/book/[shop_id]`, `/customer/shops/[shopId]/book`) + success
- **Chrome**: no marketplace nav. Focus header **[S]** `h-16 bg-card border-b border-line`: back icon button (start) · centre: shop name `text-sm font-semibold` + step label `text-meta` · close (end, returns to shop). Under it a 4-segment progress (`h-1`, Services · Barber · Time · Confirm) — labels visible on desktop as a breadcrumb `text-sm`, current `text-ink font-semibold`.
- **Layout desktop**: `max-w-6xl grid lg:grid-cols-[minmax(0,1fr)_380px] gap-10 py-8`; step content left, **[S]** summary card right (`sticky top-24 rounded-2xl border border-line bg-card shadow-card p-6`: shop thumb 56 `rounded-lg` + name + address meta; selected services list with prices; barber; date/time; divider; total `text-lg font-bold tabular-nums`; Continue primary lg full width; policy line).
- **Mobile**: single column `px-4 pb-32`; summary collapses into the sticky bottom bar (total + "N services" + Continue); tapping the total opens the summary sheet.
- **Step 1 Services**: H1 "Select services" → category pill tabs **[S]** under header → selectable service rows (checkbox semantics).
- **Step 2 Barber**: grid `grid-cols-2 sm:grid-cols-3 gap-3` of selectable barber cards, "Any barber" first.
- **Step 3 Time**: horizontal date strip **[S]** (day pills `w-14 h-16 rounded-2xl` with weekday `text-xs` + date `text-lg font-bold`, selected `bg-inverse text-on-inverse`, unavailable `text-ink-disabled line-through`) + month picker button → time slots grouped Morning/Afternoon/Evening, slot `h-11 rounded-full border border-line-strong text-sm font-semibold tabular-nums hover:border-ink aria-pressed:bg-brand aria-pressed:text-on-brand aria-pressed:border-brand` in `grid grid-cols-3 sm:grid-cols-4 gap-2` → empty day = EmptyState "Next available: Thu 5:30 pm" + Any barber + Join waitlist.
- **Step 4 Review/confirm**: details card, contact (phone + OTP panel), notes textarea, policy callout `rounded-xl bg-sunken p-4 text-sm` with clock icon, Turnstile, Confirm primary. Errors inline + toast.
- **Success**: centred `max-w-md py-12`: success mark `size-16 rounded-full bg-success-soft text-success grid place-items-center` (check draws in 400ms) + confetti → H1 "You're booked" → appointment card (date/time large `text-h2 tabular-nums`, shop, barber, services, total, address) → actions stacked: Add to calendar (secondary), Directions (secondary), Manage booking (link) → "Book another" ghost.

### 6.6 Branded `/b/[slug]` page
The shop's own mini-site: no marketplace nav/footer clutter. Minimal header (shop logo/initials 40 + name, language toggle, "Powered by Halaqy" small link in footer only). Content = shop page sections with Services first (no "nearby shops", no marketplace rails), hero photo 16:9 `rounded-2xl` (desktop) / full-bleed (mobile), sticky booking aside/bottom bar identical to §6.3. Accent colour stays Halaqy teal (no per-shop theming in v2).

### 6.7 Manage booking `/m/[token]`
Focus header (shop name, language). `max-w-xl py-8 space-y-4`: status Pill + H1 date/time → appointment card (services, barber, total, address with map thumb) → policy callout with exact deadline → actions: Reschedule (primary), Add to calendar (secondary), Cancel (destructive-soft, ConfirmDialog with policy restated), "WhatsApp the shop" (secondary with icon) when cancel is blocked. Cancelled/past states swap the action set; never hide the shop contact.

### 6.8 Auth pages (`/auth/*`, `/login`, `/signup`, `/customer/login`, `/join`)
Desktop split `lg:grid-cols-2 min-h-dvh`: form column `flex items-center justify-center px-6` with `max-w-md w-full` card-less form (wordmark top-start, H1, sub, fields, primary full width, secondary links, legal `text-meta`); visual column `hidden lg:block bg-inverse` with one large photo of a shop interior (or Teal placeholder with sand-stripe) + a single testimonial card `rounded-2xl bg-card/95 p-6 shadow-float` at the bottom. Mobile: form only, `px-4 pt-8`. Customer login = phone + OTP (§5.2 OTP). Business signup steps reuse the stepper.

### 6.9 Customer account (`/customer`, `/customer/account`, `/customer/bookings`, `/customer/profile`, `/customer/[appointment_id]`)
Marketplace nav. `max-w-5xl`. Desktop `grid lg:grid-cols-[240px_minmax(0,1fr)] gap-10`: left **[S]** profile mini-card (avatar 56, name, phone) + vertical nav (Bookings, Favourites, Profile, Privacy, Language & digits) using sidebar-item style; mobile = segmented control at top. **Bookings**: "Upcoming" first as large cards (photo 4:3 start column on desktop, date/time `text-h3`, status pill, Manage / Directions), "Past" as list rows with "Book again" soft button. Appointment detail = §6.7 layout. Profile/privacy = grouped settings panels (§6.18 pattern).

### 6.10 For-business landing (`/for-business`)
Marketing page, light: nav with "Log in" + "Set up your shop" primary. Hero `grid lg:grid-cols-2 gap-12 items-center py-16 lg:py-24`: Display headline, Body L, two CTAs (primary + secondary "See pricing"), trust MetaLine (No contract · Arabic & English · CliQ ready); visual = real product screenshots (calendar + phone booking page) in `rounded-2xl shadow-float` frames, slightly overlapping, on a `bg-brand-soft` rounded-3xl backdrop. Then: logos/shops strip (only when real) → feature trio cards (icon tile + H3 + body) → alternating feature rows (screenshot ↔ copy) for Calendar, Online booking & links, WhatsApp reminders, Clients, Analytics → pricing card(s) `rounded-2xl border border-line bg-card p-8` with per-barber price `text-[40px] font-bold tabular-nums` → FAQ accordion (`divide-y divide-line`, rows `py-5 text-title`, chevron rotates) → final CTA band (`bg-inverse` rounded-3xl) → footer.

### 6.11 Onboarding wizard (`/start`)
Focus chrome: header with wordmark + "Save & exit" ghost; progress bar under header **[S]**. Content `max-w-xl mx-auto px-4 py-8 lg:py-12`: step counter `text-meta` ("Step 2 of 6") → H1 question-style title → helper → fields/choices (choice cards `rounded-2xl border p-4` selectable like booking rows; map step `aspect-[4/3] rounded-2xl` map with centred pin) → footer **[S]** on mobile (Back ghost + Continue primary), inline right-aligned on desktop. Share screen = success layout (§6.5) with booking link CopyField, QR preview card and "Open my page".

### 6.12 Dashboard overview (`/(dashboard)`, `/my-day`)
Shell: sidebar (lg) / bottom tabs (mobile) + topbar **[S]**. Content `bg-page`.
1. Greeting row: H1 "Good evening, Ahmad" `text-h2` + date meta; end: segmented Today/Week + "New appointment" primary (desktop).
2. Setup checklist card (new shops only): progress bar + 5 task rows with check circles; dismissible.
3. KPI row `grid grid-cols-2 lg:grid-cols-4 gap-4`: stat cards (Bookings today, Revenue today, Occupancy, New clients).
4. `grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-6`: **Up next** panel (timeline list rows: time `tabular-nums font-semibold w-14`, client + service, barber avatar, status pill, quick actions Arrived/Checkout) | **Sales** panel (area chart chart-1 vs chart-5 previous period) + **Team today** (barber rows with occupancy bars `h-1.5 bg-sunken` fill `bg-brand`).
5. Recent reviews + Messages failed/alerts (warning-soft callouts).
`my-day` (barber role): single column, big current/next appointment card at top (`bg-inverse text-on-inverse rounded-2xl p-5`), then the day's list.

### 6.13 Calendar
Topbar + calendar toolbar **[S]** (`h-14 bg-card border-b border-line px-4 flex items-center gap-2`): Today secondary sm · prev/next icon buttons (mirrored in RTL) · date label `text-h3` (opens month picker) · spacer · barber filter (avatar stack button) · segmented Day/Week/Month · "New" primary sm. Desktop: time grid with sticky time gutter (inline-start, `w-16 text-xs text-ink-muted tabular-nums`) and sticky barber header row; columns `min-w-[180px]`, horizontal scroll inside the grid only. Mobile: vertical day view, swipeable barber selector chips **[S]** under the toolbar (avatar 32 + name pills), FAB (Appointment / Walk-in now / Block time). Event chips §5.12. Slot popover and dialogs per §5.7. Month view: cells `min-h-28 border-line`, day number `text-sm font-semibold`, up to 3 mini chips + "+N".

### 6.14 Queue (`/queue`, `/queue/display`)
Board: 3 columns desktop (Waiting · In chair · Done) as `rounded-xl bg-sunken p-3` lanes with white cards (`rounded-xl bg-card border border-line p-4 shadow-xs`): ticket number `text-[28px] font-bold tabular-nums`, name, service, wait time (warning text after threshold), actions (Call, Start, Done). Mobile: segmented control switches lanes; "Add walk-in" FAB. **Display** (TV): dark-by-default regardless of theme — `bg-[#0B1514] text-[#ECF3F1]`, huge "Now serving" number `text-[120px] font-extrabold tabular-nums text-[#5EEAD4]`, next 5 in a list, shop wordmark + clock; respect reduced motion for number changes (crossfade only).

### 6.15 Clients
Header row: H1 + count, search input (pill `h-11`), filters (Segment: All / New / Regular / Lapsed), Import/Export secondary, "Add client" primary. Desktop table (§5.11): Name (avatar + name + phone meta) · Last visit · Visits · Spend (tabular end) · Tags (pills) · actions. Mobile: list rows. Client detail = side sheet (desktop) / full page (mobile): header (avatar 72, name, phone/WhatsApp buttons), stats row (visits, spend, no-shows), tabs (Appointments · Notes · Messages).

### 6.16 Services
H1 + "Add service" primary + "Reorder" secondary. Category sections as panels (§5.4 panel) — header with category name + count + menu; rows: drag handle (`text-ink-disabled`, `cursor-grab`), name + duration meta, price end, online-booking switch, edit chevron. Service editor = dialog (desktop `max-w-2xl`) / full-screen sheet (mobile) with grouped fields and a sticky footer. Empty = EmptyState "Add your first service" + "Use a template".

### 6.17 Team
H1 + "Add barber" primary. Grid `grid sm:grid-cols-2 xl:grid-cols-3 gap-4` of member cards (`rounded-xl bg-card border p-5`: avatar 56, name, role pill, services count, today's shift meta, rating; footer actions Schedule / Edit). Tabs: Members · Shifts (week matrix: rows barbers, columns days, cells `rounded-sm bg-brand-soft text-brand-pressed text-xs tabular-nums` "10–8", off = `bg-sunken text-ink-muted`) · Commission (if present).

### 6.18 Settings (`/settings/*`)
Desktop `grid lg:grid-cols-[220px_minmax(0,1fr)] gap-8`: settings sub-nav **[S]** (sidebar-item style, grouped: Shop · Booking · Payments · Messaging · Notifications · Links · Tax) | content `max-w-3xl space-y-6` of panels; each panel = title + description (`text-sm text-ink-muted`) left on desktop (`md:grid md:grid-cols-[240px_1fr] md:gap-8`), fields right. Save bar **[S]** at bottom appearing only when dirty (`bg-card border-t shadow-bar`, "Unsaved changes" + Discard ghost + Save primary). Mobile: settings index list → sub-pages with back header. Hours page: day rows with switch + time range selects + "Copy to all"; closures as list rows. Links page: link CopyField cards + QR poster preview `rounded-2xl shadow-raised`.

### 6.19 Analytics
Toolbar: H1 · period segmented (7d / 30d / 90d / custom) · compare toggle · Export secondary. KPI row (stat cards with deltas). Charts grid `grid lg:grid-cols-2 gap-6`, each in a panel with title + legend chips: Revenue (area, chart-1 vs chart-5), Bookings by channel (stacked bars chart-1..4: Online/Walk-in/Phone/Link), Top services (horizontal bars + values), Staff performance (table), Retention (line). Tooltips `bg-inverse` per §5.18. Empty period → EmptyState inside chart area. Digits/ currency via existing formatters; axis labels `text-xs text-ink-muted tabular-nums`; RTL mirrors x-axis direction (time flows inline-start → end).

### 6.20 Admin (`/admin/*`)
Same shell grammar, distinct but related: sidebar header shows "Halaqy Admin" on `bg-inverse` strip (so staff always know they're in the console); content dense tables (§5.11) for Shops, Claims, Reviews, Abuse, Support, Audit with filter bars **[S]**; detail pages two-column (`grid lg:grid-cols-[minmax(0,1fr)_320px]`) with state pills (`shop-state-pills`) and an actions aside (destructive actions in a separated "Danger zone" panel `border-danger/30`). Audit log rows monospace IDs (`font-mono text-xs text-ink-muted`) with copy button.

### 6.21 Misc
Legal pages (`/terms`, `/privacy`, `/policy`): marketplace nav, `max-w-3xl py-12`, H1 + updated date meta, prose (`text-body text-ink-soft space-y-4`, H2 `mt-10`), sticky table of contents on desktop (aside). `not-found` / `error`: centred EmptyState with "Go home" + "Search barbers". `global-error.tsx`: inline styles using light hexes from §2.2.

---

## 7. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `instant` | 100ms | standard | press feedback, checkbox, switch thumb |
| `fast` | 150ms | standard `cubic-bezier(0.2,0,0,1)` | hover colours, borders, focus ring, tab indicator |
| `base` | 200ms | standard | card hover shadow, popover/dropdown in, toast in, image fade-in |
| `enter` | 280ms | enter `cubic-bezier(0.05,0.7,0.1,1)` | dialog/sheet in, page section reveal, map popover |
| `exit` | 180ms | exit `cubic-bezier(0.3,0,0.8,0.15)` | anything leaving (always faster than entering) |
| `slow` | 400–500ms | enter | success check draw, image hover zoom (500ms), progress fill |

Re-point `--transition-fast/normal/slow` to 150/200/400ms with `--ease-standard`.

What animates: button press `scale(0.98)`; card hover `shadow-card → shadow-raised` + image `scale(1.03)`; dialogs fade + `translateY(8px)` desktop / sheets slide up 100% mobile; side sheets slide from inline-end; tab indicator slides (`transition-[inset]`); booking step change crossfade + 12px inline slide in reading direction (RTL mirrors); time-slot select colour fill; map pin active scale 1.1; toast in from bottom 12px; skeleton shimmer 1.4s; booking success check draw 400ms + confetti ≤1.2s; page entrance `fade-slide-up` (staggered 40ms, max 4 items). What never animates: layout-shifting height on data load, prices/totals (no count-up), calendar grid on scroll, anything looping besides the skeleton and spinner.

Reduced motion (`prefers-reduced-motion: reduce` → Tailwind `motion-reduce:`, and the existing global block in globals.css): no transforms (scale/translate/zoom disabled), no shimmer (static `bg-sunken`), no confetti, no smooth scroll (`scroll-behavior: auto`), dialogs/sheets/toasts appear with opacity only at ≤120ms, success check shown complete, carousels jump instead of glide, framer-motion components read `useReducedMotion()` and pass `transition={{ duration: 0 }}` for movement. Animations must never be the only indicator of state.

---

## 8. Accessibility & RTL checklist (every PR)

- Contrast: text ≥ 4.5:1 (≥ 3:1 for ≥ 24px or 19px bold), UI boundaries & icons ≥ 3:1 — use only the token pairs in §2; never `text-brand` on `sunken-2`, never amber `#F59E0B` as text.
- `focus-visible` ring visible on every interactive element (global rule stays; components must not set `outline-none` without `focus-visible:outline-*`).
- Logical properties only: `ms/me/ps/pe/start/end/inset-inline/border-s/border-e/rounded-s/rounded-e`; directional icons get `rtl:rotate-180`; no `left-/right-/ml-/mr-/pl-/pr-/text-left/text-right` in new code.
- Arabic: no `tracking-*`, no `uppercase`, line-heights per §3; numbers and phone fields `dir="ltr"` where they are codes, prices via `formatJOD`.
- Hit targets ≥ 44px on touch; sticky bars respect `env(safe-area-inset-bottom)`.
- Status = colour + icon/label. Images have bilingual alt (decorative `alt=""`).
- Test at 375 and 1280, light + dark, en + ar, and with reduced motion.

---

## 9. Recommended implementation split (one owner per file)

1. **Foundation** (lands first, everyone else rebases on it): `src/app/globals.css`, `src/app/token-contrast.test.ts`, `src/app/manifest.ts`, `src/app/global-error.tsx`, `src/app/[locale]/layout.tsx` (theme-color meta only; fonts unchanged).
2. **Primitives**: `src/components/ui/*` (Button recipes via `glass-button.tsx` + optional new `recipes.ts`, `pill.tsx`, `booking-cta.tsx`, `toast.tsx`, `skeleton.tsx`, `empty-state.tsx`, `dialog.tsx`, `confirm-dialog.tsx`, `glass-card.tsx`, `meta-line.tsx`, `price.tsx`, `confetti.tsx`) + `src/components/shop/rating-stars.tsx`.
3. **Marketplace discovery**: `src/components/search/*`, `src/app/[locale]/landing/**`, `src/app/[locale]/explore/**`, `src/app/[locale]/customer/explore/**`, legal pages, `not-found.tsx`, `error.tsx`.
4. **Shop & barber profiles**: `src/components/shop/*` (except rating-stars), `src/app/[locale]/shop/**` (incl. `COVER_PALETTE` in `shop-utils.ts`), `src/app/[locale]/barber/**`, `src/app/[locale]/b/**`, `src/components/links/branded-*`, `src/app/[locale]/customer/shops/[shopId]/page.tsx`.
5. **Booking & manage**: `src/components/booking/*`, `src/app/[locale]/book/**`, `src/app/[locale]/customer/shops/[shopId]/book/**`, `src/app/[locale]/m/**`, `src/app/[locale]/customer/[appointment_id]/**`.
6. **Customer account & auth**: `src/app/[locale]/auth/**`, `login`, `signup`, `join`, `customer/{page,account,bookings,profile,login}`.
7. **Business acquisition**: `src/app/[locale]/for-business/**`, `src/app/[locale]/start/**`.
8. **Dashboard shell & insights**: `src/components/layout/*`, `src/components/dashboard/*`, `src/components/notifications/*`, `src/components/pwa/*`, `(dashboard)/{layout,page,error}.tsx`, `my-day`, `analytics`.
9. **Calendar & queue**: `src/components/calendar/*`, `(dashboard)/calendar/**`, `(dashboard)/queue/**`.
10. **Back-office lists & settings**: `(dashboard)/{clients,services,team,leads,settings}/**`, `src/components/{settings,team,leads}/*`, `src/components/links/*` (except branded-*).
11. **Admin**: `src/app/admin/**`.

i18n files (`src/i18n/en.ts`, `ar.ts`) have a single owner who merges the keys each workstream reports.
