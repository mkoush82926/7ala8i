// Scoped styles for the booking flow (bk-*). Logical properties only.
export const BOOKING_CSS = `
.bk-root { --bk-radius: 12px; }
.bk-card { background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: var(--bk-radius); }
.bk-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 8px; }
.bk-option {
  position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 12px;
  min-height: 96px; padding: 18px; border-radius: var(--bk-radius); text-align: start; cursor: pointer;
  background: var(--bg-primary); color: var(--text-primary); font: inherit;
  border: 1.5px solid var(--border-subtle); transition: border-color 140ms ease, background 140ms ease;
}
.bk-option:hover { border-color: var(--border-primary); }
.bk-option.is-selected { border: 2px solid var(--text-primary); background: var(--bg-secondary); padding: 17.5px; }
.bk-service { gap: 14px; justify-content: space-between; }
.bk-check {
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  border: 2px solid var(--border-primary); color: var(--on-accent);
}
.bk-option.is-selected .bk-check { background: var(--accent-brass); border-color: var(--accent-brass); }
.bk-selected-mark {
  position: absolute; top: 12px; inset-inline-end: 12px; display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700;
  background: var(--text-primary); color: var(--on-accent);
}
.bk-pill-row { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 12px; margin-bottom: 4px; scrollbar-width: none; }
.bk-pill {
  flex-shrink: 0; min-height: 40px; padding: 8px 16px; border-radius: 9999px; white-space: nowrap; cursor: pointer;
  font: inherit; font-size: 13px; font-weight: 700;
  border: 1.5px solid var(--border-subtle); background: var(--bg-primary); color: var(--text-primary);
}
.bk-pill.is-selected { background: var(--text-primary); color: var(--on-accent); border-color: var(--text-primary); }
.bk-pill-info {
  display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 9999px;
  font-size: 12px; font-weight: 600; color: var(--text-secondary); background: var(--bg-secondary);
}
.bk-date-strip { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 8px; scrollbar-width: none; scroll-snap-type: x proximity; }
.bk-day {
  width: 62px; min-height: 76px; flex-shrink: 0; border-radius: 10px; cursor: pointer; scroll-snap-align: start;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  font: inherit; border: 1.5px solid var(--border-subtle); background: var(--bg-primary); color: var(--text-primary);
}
.bk-day:hover:not(:disabled) { border-color: var(--border-primary); }
.bk-day.is-selected { background: var(--text-primary); color: var(--on-accent); border-color: var(--text-primary); }
.bk-day:disabled { cursor: not-allowed; color: var(--text-muted); background: var(--bg-secondary); }
.bk-slot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
.bk-slot {
  min-height: 44px; padding: 0 8px; border-radius: 10px; cursor: pointer; font: inherit; font-size: 14px; font-weight: 700;
  border: 1.5px solid var(--border-subtle); background: var(--bg-primary); color: var(--text-primary);
}
.bk-slot:hover:not(:disabled) { border-color: var(--text-primary); }
.bk-slot.is-selected { background: var(--text-primary); color: var(--on-accent); border-color: var(--text-primary); }
.bk-slot:disabled { cursor: not-allowed; color: var(--text-muted); background: var(--bg-secondary); text-decoration: line-through; font-weight: 500; }
.bk-bottom-bar {
  position: sticky; bottom: 0; z-index: 10; margin-top: 24px; padding: 14px 0 calc(14px + env(safe-area-inset-bottom));
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: var(--bg-primary); border-top: 1px solid var(--border-subtle);
  box-shadow: 0 -8px 16px -12px rgba(28, 22, 17, 0.25);
}
.bk-cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 24px;
  border-radius: 10px; border: none; cursor: pointer; text-decoration: none; font: inherit; font-size: 15px; font-weight: 700;
  background: var(--accent-mint); color: var(--on-accent); transition: filter 150ms ease, transform 150ms ease;
}
.bk-cta:hover:not(:disabled) { filter: brightness(1.08); }
.bk-cta:active:not(:disabled) { transform: translateY(1px); }
.bk-cta:disabled { background: var(--border-subtle); color: var(--text-secondary); cursor: not-allowed; }
.bk-cta-pill { border-radius: 9999px; flex-shrink: 0; }
.bk-btn-secondary, .bk-btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 18px;
  border-radius: 10px; cursor: pointer; text-decoration: none; font: inherit; font-size: 14px; font-weight: 700;
  color: var(--text-primary); background: var(--bg-primary); border: 1px solid var(--border-primary);
}
.bk-btn-secondary:hover { background: var(--bg-secondary); }
.bk-btn-ghost { border-color: transparent; color: var(--text-secondary); }
.bk-btn-ghost:hover { color: var(--text-primary); background: var(--bg-secondary); }
.bk-icon-btn {
  width: 44px; height: 44px; flex-shrink: 0; border-radius: 10px; border: 1px solid var(--border-subtle);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  background: var(--bg-primary); color: var(--text-secondary);
}
.bk-icon-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
.bk-link { color: var(--accent-text); font-weight: 700; text-decoration: underline; text-underline-offset: 2px; background: none; border: none; padding: 0; cursor: pointer; font: inherit; }
.bk-two-col { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
.bk-summary { background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--bk-radius); padding: 22px; position: sticky; top: 84px; }
.bk-success { padding: 48px 32px; text-align: center; }
.bk-summary-grid {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0 0 20px; text-align: start;
  background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--bk-radius); padding: 16px 18px;
}
.bk-success-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.bk-spin { animation: bk-spin 1s linear infinite; }
@keyframes bk-spin { to { transform: rotate(360deg); } }
@media (max-width: 720px) {
  .bk-two-col { grid-template-columns: minmax(0, 1fr); }
  .bk-summary { position: static; }
}
@media (max-width: 640px) {
  .bk-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bk-success { padding: 32px 18px; }
  .bk-success-actions > * { flex: 1 1 100%; }
}
@media (max-width: 420px) {
  .bk-grid-2 { grid-template-columns: minmax(0, 1fr); }
  .bk-option { min-height: 0; flex-direction: row; align-items: center; }
  .bk-service { flex-direction: column; align-items: flex-start; }
  .bk-cta-pill { padding: 0 20px; }
}
@media (prefers-reduced-motion: reduce) { .bk-spin { animation: none; } }

.bk-tabs { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 12px; margin-bottom: 4px; scrollbar-width: none; position: sticky; top: 60px; z-index: 5; background: var(--bg-secondary); }
.bk-tabs::-webkit-scrollbar, .bk-date-strip::-webkit-scrollbar, .bk-pill-row::-webkit-scrollbar { display: none; }
.bk-section-title { font-size: 13px; font-weight: 800; color: var(--text-secondary); margin: 18px 0 10px; }
.bk-list { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.bk-row {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 72px; padding: 14px 16px; text-align: start;
  border-radius: var(--bk-radius); border: 1.5px solid var(--border-subtle); background: var(--bg-primary);
  color: var(--text-primary); font: inherit; cursor: pointer; transition: border-color 140ms ease, background 140ms ease;
}
.bk-row:hover { border-color: var(--border-primary); }
.bk-row.is-selected { border: 2px solid var(--text-primary); background: var(--bg-secondary); padding: 13.5px 15.5px; }
.bk-row-main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.bk-row-title { font-size: 15px; font-weight: 800; overflow-wrap: anywhere; }
.bk-row-meta { font-size: 12px; color: var(--text-secondary); }
.bk-row-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.bk-row-price { font-size: 15px; font-weight: 800; white-space: nowrap; }
.bk-add {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  border: 1.5px solid var(--border-primary); color: var(--text-primary); background: var(--bg-primary);
}
.bk-row.is-selected .bk-add { background: var(--accent-mint); border-color: var(--accent-mint); color: var(--on-accent); }
.bk-variant {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 12px 14px; border-radius: 10px; cursor: pointer;
  border: 1.5px solid var(--border-subtle); background: var(--bg-primary); color: var(--text-primary); font: inherit; text-align: start;
}
.bk-variant[aria-checked="true"] { border: 2px solid var(--text-primary); background: var(--bg-secondary); }
.bk-radio { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--border-primary); flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
.bk-variant[aria-checked="true"] .bk-radio { border-color: var(--accent-mint); }
.bk-variant[aria-checked="true"] .bk-radio::after { content: ""; width: 10px; height: 10px; border-radius: 50%; background: var(--accent-mint); }
.bk-barber-next { font-size: 12px; font-weight: 700; color: var(--accent-text); }
.bk-surcharge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; background: var(--bg-secondary); color: var(--text-secondary); border: 1px solid var(--border-subtle); }
.bk-day-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent-mint); }
.bk-jump { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; border-radius: 9999px; border: 1.5px solid var(--border-primary); background: var(--bg-primary); color: var(--text-primary); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.bk-jump:hover { background: var(--bg-secondary); }
.bk-chip { min-height: 36px; padding: 6px 12px; border-radius: 9999px; border: 1px dashed var(--border-primary); background: var(--bg-primary); color: var(--text-primary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.bk-chip:hover { background: var(--bg-secondary); }
.bk-chip[aria-pressed="true"] { border-style: solid; border-color: var(--text-primary); background: var(--bg-secondary); }
.bk-policy { display: flex; gap: 12px; padding: 14px 16px; border-radius: 12px; background: var(--bg-secondary); border: 1px solid var(--border-subtle); font-size: 13px; line-height: 1.55; }
.bk-otp-input { letter-spacing: 0.4em; font-size: 22px; font-weight: 800; text-align: center; }
.bk-row:focus-visible, .bk-variant:focus-visible, .bk-chip:focus-visible, .bk-jump:focus-visible, .bk-day:focus-visible,
.bk-slot:focus-visible, .bk-pill:focus-visible, .bk-option:focus-visible, .bk-cta:focus-visible, .bk-btn-secondary:focus-visible,
.bk-btn-ghost:focus-visible, .bk-icon-btn:focus-visible, .bk-link:focus-visible {
  outline: 2px solid var(--accent-brass); outline-offset: 2px;
}
`;
