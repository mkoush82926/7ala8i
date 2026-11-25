// Scoped styles for the booking flow (bk-*), Design System v2 ("Deep Teal &
// Sand", docs/DESIGN_SYSTEM_V2.md §5 / §6.5). Logical properties only; every
// colour is a semantic token so dark mode follows the theme store. The root is
// a size container: the summary aside / two-column review appear when the
// flow itself is ≥ 960px wide (the branded /b page stays single-column).
const SH_CARD = "var(--shadow-card, 0 1px 2px rgb(15 23 42 / 0.04), 0 4px 12px -4px rgb(15 23 42 / 0.08))";
const SH_RAISED = "var(--shadow-raised, 0 2px 4px rgb(15 23 42 / 0.04), 0 12px 28px -10px rgb(15 23 42 / 0.18))";
const SH_XS = "var(--shadow-xs, 0 1px 2px rgb(15 23 42 / 0.06))";
const SH_BAR = "var(--shadow-bar, 0 -1px 0 rgb(15 23 42 / 0.06), 0 -8px 24px -12px rgb(15 23 42 / 0.16))";
const EASE = "var(--ease-standard, cubic-bezier(0.2, 0, 0, 1))";

export const BOOKING_CSS = `
.bk-root { --bk-radius: 16px; container: bk / inline-size; color: var(--color-ink); }
.bk-card { background: var(--color-card); border: 1px solid var(--color-line); border-radius: var(--bk-radius); box-shadow: ${SH_CARD}; }

/* ── Layout: content + summary aside (wide containers only) ── */
.bk-layout { display: block; }
.bk-aside { display: none; }
@container bk (min-width: 960px) {
  .bk-layout { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 40px; align-items: start; }
  .bk-aside { display: block; position: sticky; top: 88px; }
}
.bk-summary-card {
  background: var(--color-card); border: 1px solid var(--color-line); border-radius: 20px; padding: 24px;
  box-shadow: ${SH_CARD}; display: flex; flex-direction: column; gap: 16px;
}

/* ── Stepper ── */
.bk-steps { display: flex; gap: 6px; flex: 1; min-width: 0; }
.bk-step { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.bk-step-bar { height: 4px; border-radius: 9999px; background: var(--color-sunken-2); overflow: hidden; }
.bk-step-bar > span { display: block; height: 100%; width: 0; border-radius: inherit; background: var(--color-brand); transition: width 400ms var(--ease-enter, ${EASE}); }
.bk-step[data-state="done"] .bk-step-bar > span, .bk-step[data-state="current"] .bk-step-bar > span { width: 100%; }
.bk-step-label { display: none; font-size: 13px; font-weight: 600; color: var(--color-ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bk-step[data-state="current"] .bk-step-label { color: var(--color-ink); }
.bk-step[data-state="done"] .bk-step-label { color: var(--color-ink-soft); }
@container bk (min-width: 640px) { .bk-step-label { display: block; } }

/* ── Barber cards ── */
.bk-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 8px; }
@container bk (min-width: 560px) { .bk-grid-2 { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.bk-option {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px;
  min-height: 160px; padding: 20px 12px 16px; border-radius: 20px; text-align: center; cursor: pointer;
  background: var(--color-card); color: var(--color-ink); font: inherit;
  border: 1px solid var(--color-line); box-shadow: ${SH_XS};
  transition: border-color 150ms ${EASE}, box-shadow 150ms ${EASE}, background-color 150ms ${EASE}, transform 150ms ${EASE};
}
.bk-option:hover { border-color: var(--color-ink-soft); box-shadow: ${SH_CARD}; }
.bk-option:active { transform: scale(0.98); }
.bk-option.is-selected { border-color: var(--color-brand); box-shadow: 0 0 0 1px var(--color-brand), ${SH_CARD}; background: color-mix(in srgb, var(--color-brand-soft) 45%, var(--color-card)); }
.bk-service { gap: 14px; justify-content: space-between; }
.bk-check {
  width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  border: 2px solid var(--color-line-strong); color: var(--color-on-brand);
}
.bk-option.is-selected .bk-check { background: var(--color-brand); border-color: var(--color-brand); }
.bk-selected-mark {
  position: absolute; top: 10px; inset-inline-end: 10px; display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 9999px; background: var(--color-brand); color: var(--color-on-brand);
}

/* ── Pills (category tabs) ── */
.bk-pill-row { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 12px; margin-bottom: 4px; scrollbar-width: none; }
.bk-pill {
  flex-shrink: 0; height: 40px; padding: 0 16px; border-radius: 9999px; white-space: nowrap; cursor: pointer;
  font: inherit; font-size: 14px; font-weight: 600;
  border: 1px solid var(--color-line); background: var(--color-card); color: var(--color-ink-soft);
  transition: border-color 150ms ${EASE}, background-color 150ms ${EASE}, color 150ms ${EASE};
}
.bk-pill:hover { border-color: var(--color-ink-soft); color: var(--color-ink); }
.bk-pill.is-selected { background: var(--color-inverse); color: var(--color-on-inverse); border-color: var(--color-inverse); }
.bk-pill-info {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 9999px;
  font-size: 12px; font-weight: 600; color: var(--color-ink-soft); background: var(--color-sunken);
}

/* ── Day strip + slots (§6.5 step 3) ── */
.bk-date-strip { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 8px; scrollbar-width: none; scroll-snap-type: x proximity; }
.bk-day {
  width: 56px; min-height: 72px; flex-shrink: 0; border-radius: 16px; cursor: pointer; scroll-snap-align: start;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  font: inherit; border: 1px solid var(--color-line); background: var(--color-card); color: var(--color-ink);
  transition: border-color 150ms ${EASE}, background-color 150ms ${EASE}, color 150ms ${EASE};
}
.bk-day:hover:not(:disabled) { border-color: var(--color-ink); }
.bk-day.is-selected { background: var(--color-inverse); color: var(--color-on-inverse); border-color: var(--color-inverse); }
.bk-day:disabled { cursor: not-allowed; color: var(--color-ink-disabled); background: transparent; border-style: dashed; }
.bk-day:disabled .bk-day-num { text-decoration: line-through; }
.bk-slot-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
@container bk (min-width: 480px) { .bk-slot-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@container bk (min-width: 720px) { .bk-slot-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
.bk-slot {
  height: 44px; padding: 0 8px; border-radius: 9999px; cursor: pointer; font: inherit; font-size: 14px; font-weight: 600;
  font-variant-numeric: tabular-nums; border: 1px solid var(--color-line-strong); background: var(--color-card); color: var(--color-ink);
  transition: border-color 150ms ${EASE}, background-color 150ms ${EASE}, color 150ms ${EASE}, transform 150ms ${EASE};
}
.bk-slot:hover:not(:disabled) { border-color: var(--color-ink); }
.bk-slot:active:not(:disabled) { transform: scale(0.98); }
.bk-slot.is-selected { background: var(--color-brand); color: var(--color-on-brand); border-color: var(--color-brand); }
.bk-slot:disabled { cursor: not-allowed; color: var(--color-ink-disabled); background: var(--color-sunken); text-decoration: line-through; font-weight: 500; }

/* ── Bottom bar (sticky CTA) ── */
.bk-bottom-bar {
  position: sticky; bottom: 0; z-index: 10; margin: 24px -16px 0; padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  background: color-mix(in srgb, var(--color-card) 94%, transparent); border-top: 1px solid var(--color-line);
  box-shadow: ${SH_BAR}; -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
}
@container bk (min-width: 640px) {
  .bk-bottom-bar { margin: 24px 0 0; border: 1px solid var(--color-line); border-radius: 20px; padding: 12px 12px 12px 20px; padding-inline: 20px 12px; bottom: 16px; box-shadow: ${SH_RAISED}; }
}

/* ── Buttons ── */
.bk-cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; padding: 0 28px;
  border-radius: 9999px; border: none; cursor: pointer; text-decoration: none; font: inherit; font-size: 16px; font-weight: 600;
  background: var(--color-brand); color: var(--color-on-brand); box-shadow: ${SH_XS};
  transition: background-color 150ms ${EASE}, transform 150ms ${EASE};
}
.bk-cta:hover:not(:disabled) { background: var(--color-brand-hover); }
.bk-cta:active:not(:disabled) { background: var(--color-brand-pressed); transform: scale(0.98); }
.bk-cta:disabled { background: var(--color-sunken-2); color: var(--color-ink-muted); cursor: not-allowed; box-shadow: none; }
.bk-cta-pill { flex-shrink: 0; }
.bk-btn-secondary, .bk-btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 20px;
  border-radius: 9999px; cursor: pointer; text-decoration: none; font: inherit; font-size: 15px; font-weight: 600;
  color: var(--color-ink); background: var(--color-card); border: 1px solid var(--color-line-strong);
  transition: background-color 150ms ${EASE}, border-color 150ms ${EASE}, transform 150ms ${EASE};
}
.bk-btn-secondary:hover { background: var(--color-sunken); border-color: var(--color-ink); }
.bk-btn-secondary:active, .bk-btn-ghost:active { transform: scale(0.98); }
.bk-btn-ghost { border-color: transparent; background: transparent; color: var(--color-ink-soft); }
.bk-btn-ghost:hover { color: var(--color-ink); background: var(--color-sunken); }
.bk-icon-btn {
  width: 44px; height: 44px; flex-shrink: 0; border-radius: 9999px; border: 1px solid var(--color-line);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  background: var(--color-card); color: var(--color-ink-soft);
  transition: background-color 150ms ${EASE}, color 150ms ${EASE}, border-color 150ms ${EASE};
}
.bk-icon-btn:hover { background: var(--color-sunken); color: var(--color-ink); border-color: var(--color-line-strong); }
.bk-link { color: var(--color-brand-text); font-weight: 600; text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--color-brand) 35%, transparent); text-underline-offset: 4px; background: none; border: none; padding: 0; cursor: pointer; font: inherit; }
.bk-link:hover { text-decoration-color: var(--color-brand); }

/* ── Review step two-column ── */
.bk-two-col { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; }
@container bk (min-width: 760px) { .bk-two-col { grid-template-columns: minmax(0, 1fr) 340px; gap: 32px; } }
.bk-summary { background: var(--color-card); border: 1px solid var(--color-line); border-radius: 20px; padding: 24px; box-shadow: ${SH_RAISED}; }
@container bk (min-width: 760px) { .bk-summary { position: sticky; top: 88px; } }

/* ── Success ── */
.bk-success { padding: 48px 32px; text-align: center; max-width: 560px; margin: 0 auto; border-radius: 20px; }
.bk-summary-grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 0 0 16px; text-align: start;
  background: var(--color-sunken); border-radius: 16px; padding: 16px 18px;
}
.bk-success-actions { display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
.bk-success-mark {
  width: 64px; height: 64px; border-radius: 9999px; margin: 0 auto 20px; display: grid; place-items: center;
  background: var(--color-success-soft); color: var(--color-success);
}
.bk-success-mark svg path { stroke-dasharray: 32; stroke-dashoffset: 32; animation: bk-draw 400ms var(--ease-enter, ${EASE}) 120ms forwards; }
@keyframes bk-draw { to { stroke-dashoffset: 0; } }
.bk-spin { animation: bk-spin 1s linear infinite; }
@keyframes bk-spin { to { transform: rotate(360deg); } }
@container bk (max-width: 520px) {
  .bk-success { padding: 32px 18px; }
}
@container bk (max-width: 400px) {
  .bk-cta-pill { padding: 0 22px; }
}

/* ── Services list (§5.4 selectable service row) ── */
.bk-tabs { display: flex; gap: 8px; overflow-x: auto; padding: 8px 2px 12px; margin: 0 0 4px; scrollbar-width: none; position: sticky; top: 64px; z-index: 5; background: var(--color-page); }
.bk-tabs::-webkit-scrollbar, .bk-date-strip::-webkit-scrollbar, .bk-pill-row::-webkit-scrollbar { display: none; }
.bk-section-title { font-size: 13px; font-weight: 700; color: var(--color-ink-muted); margin: 18px 0 10px; }
.bk-list { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.bk-row {
  display: flex; align-items: center; gap: 16px; width: 100%; min-height: 76px; padding: 16px; text-align: start;
  border-radius: var(--bk-radius); border: 1px solid var(--color-line); background: var(--color-card); box-shadow: ${SH_XS};
  color: var(--color-ink); font: inherit; cursor: pointer;
  transition: border-color 150ms ${EASE}, background-color 150ms ${EASE}, box-shadow 150ms ${EASE};
}
.bk-row:hover { border-color: var(--color-ink-soft); }
.bk-row.is-selected { border-color: var(--color-brand); box-shadow: 0 0 0 1px var(--color-brand); background: color-mix(in srgb, var(--color-brand-soft) 45%, var(--color-card)); }
.bk-row-main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.bk-row-title { font-size: 16px; line-height: 22px; font-weight: 600; overflow-wrap: anywhere; }
[dir="rtl"] .bk-row-title { font-weight: 700; line-height: 26px; }
.bk-row-meta { font-size: 13px; line-height: 18px; color: var(--color-ink-muted); }
.bk-row-desc { margin-top: 2px; font-size: 14px; color: var(--color-ink-muted); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.bk-row-price { font-size: 15px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
.bk-add {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  border: 2px solid var(--color-line-strong); color: var(--color-ink-soft); background: var(--color-card);
  transition: background-color 150ms ${EASE}, border-color 150ms ${EASE}, color 150ms ${EASE};
}
.bk-row.is-selected .bk-add { background: var(--color-brand); border-color: var(--color-brand); color: var(--color-on-brand); }
.bk-variant {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 60px; padding: 12px 16px; border-radius: 16px; cursor: pointer;
  border: 1px solid var(--color-line); background: var(--color-card); color: var(--color-ink); font: inherit; text-align: start;
  transition: border-color 150ms ${EASE}, background-color 150ms ${EASE};
}
.bk-variant:hover { border-color: var(--color-ink-soft); }
.bk-variant[aria-checked="true"] { border-color: var(--color-brand); box-shadow: 0 0 0 1px var(--color-brand); background: color-mix(in srgb, var(--color-brand-soft) 45%, var(--color-card)); }
.bk-radio { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--color-line-strong); flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
.bk-variant[aria-checked="true"] .bk-radio { border-color: var(--color-brand); }
.bk-variant[aria-checked="true"] .bk-radio::after { content: ""; width: 10px; height: 10px; border-radius: 50%; background: var(--color-brand); }
.bk-barber-next { font-size: 13px; font-weight: 600; color: var(--color-success-text); }
.bk-surcharge { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; background: var(--color-accent-soft); color: var(--color-warning-text); font-variant-numeric: tabular-nums; }
.bk-day-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--color-brand); }
.bk-day.is-selected .bk-day-dot { background: currentColor; }
.bk-jump { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 16px; border-radius: 9999px; border: 1px solid var(--color-brand-soft-line); background: var(--color-brand-soft); color: var(--color-brand-pressed); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; transition: background-color 150ms ${EASE}; }
.bk-jump:hover { background: color-mix(in srgb, var(--color-brand-soft-line) 60%, var(--color-brand-soft)); }
:is(.dark, [data-theme="dark"]) .bk-jump { color: var(--color-brand-text); }
.bk-chip { min-height: 36px; padding: 6px 14px; border-radius: 9999px; border: 1px solid var(--color-line-strong); background: var(--color-card); color: var(--color-ink); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; transition: background-color 150ms ${EASE}, border-color 150ms ${EASE}, color 150ms ${EASE}; }
.bk-chip:hover { border-color: var(--color-ink); }
.bk-chip[aria-pressed="true"] { border-color: var(--color-inverse); background: var(--color-inverse); color: var(--color-on-inverse); }
.bk-policy { display: flex; gap: 12px; padding: 16px; border-radius: 16px; background: var(--color-sunken); font-size: 14px; line-height: 1.55; }
.bk-policy p:first-child { color: var(--color-ink); }
.bk-otp-input { letter-spacing: 0.4em; font-size: 22px; font-weight: 700; text-align: center; font-variant-numeric: tabular-nums; }
.bk-row:focus-visible, .bk-variant:focus-visible, .bk-chip:focus-visible, .bk-jump:focus-visible, .bk-day:focus-visible,
.bk-slot:focus-visible, .bk-pill:focus-visible, .bk-option:focus-visible, .bk-cta:focus-visible, .bk-btn-secondary:focus-visible,
.bk-btn-ghost:focus-visible, .bk-icon-btn:focus-visible, .bk-link:focus-visible {
  outline: 2px solid var(--color-focus); outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .bk-spin { animation: none; }
  .bk-success-mark svg path { animation: none; stroke-dashoffset: 0; }
  .bk-step-bar > span, .bk-row, .bk-option, .bk-slot, .bk-day, .bk-cta, .bk-pill, .bk-chip { transition: none; }
  .bk-option:active, .bk-slot:active:not(:disabled), .bk-cta:active:not(:disabled), .bk-btn-secondary:active, .bk-btn-ghost:active { transform: none; }
}
`;
