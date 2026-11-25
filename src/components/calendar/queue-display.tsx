"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Maximize2, X } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useQueue } from "./use-queue";
import { displayName, roundWait } from "./queue-model";

const MAX_WAITING = 8;

/**
 * TV view for a screen in the shop: who's in the chair and who's next with
 * an estimated wait. First names and an initial only, never phones. Covers
 * the dashboard chrome; updates live.
 */
export function QueueDisplay() {
  const { t, href, formatTime, formatNumber, formatDate } = useTranslation();
  const shopName = useWorkspaceStore((s) => s.shopName);
  const barbers = useWorkspaceStore((s) => s.barbers);
  const q = useQueue();
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const barberFirst = (id: string | null) => {
    const n = id ? barbers.find((b) => b.id === id)?.name : null;
    return n ? n.trim().split(/\s+/)[0] : "";
  };

  const goFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-6 py-4 lg:px-10">
        <div className="min-w-0">
          <p className="truncate text-[clamp(20px,2.6vw,36px)] font-light">{shopName}</p>
          <p className="text-[clamp(13px,1.2vw,18px)] text-[var(--text-secondary)]">{t.queue.displaySubtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-end tabular-nums">
            <span className="block text-[clamp(24px,3vw,44px)] font-light">{formatTime(clock)}</span>
            <span className="block text-[clamp(12px,1vw,16px)] text-[var(--text-muted)]">{formatDate(clock, "weekdayDay")}</span>
          </p>
          <button type="button" onClick={goFullscreen} className="btn btn-ghost h-11 w-11 p-0" aria-label={t.queue.fullscreen}>
            <Maximize2 size={18} aria-hidden="true" />
          </button>
          <Link href={href("/queue")} className="btn btn-ghost h-11 w-11 p-0" aria-label={t.queue.exitDisplay}>
            <X size={20} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className="grid flex-1 gap-6 overflow-hidden p-6 lg:grid-cols-2 lg:gap-10 lg:p-10" aria-live="polite">
        <section aria-labelledby="tv-serving" className="flex min-h-0 flex-col">
          <h2 id="tv-serving" className="mb-4 text-[clamp(16px,1.6vw,24px)] font-medium text-[var(--text-secondary)]">
            {t.queue.serving}
          </h2>
          {q.serving.length === 0 ? (
            <p className="text-[clamp(16px,1.6vw,24px)] text-[var(--text-muted)]">{t.queue.displayNobodyServing}</p>
          ) : (
            <ul className="space-y-3 overflow-hidden">
              {q.serving.map((e) => (
                <li key={e.id} className="flex items-center gap-4 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] px-5 py-4">
                  <span className="text-[clamp(22px,2.4vw,40px)] font-semibold tabular-nums text-[var(--accent-text)]">#{formatNumber(e.ticketNo)}</span>
                  <span className="min-w-0 flex-1 truncate text-[clamp(20px,2.2vw,36px)]">{displayName(e.clientName, e.ticketNo)}</span>
                  <span className="text-[clamp(14px,1.4vw,22px)] text-[var(--text-secondary)]">{barberFirst(e.assignedBarberId)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="tv-next" className="flex min-h-0 flex-col">
          <h2 id="tv-next" className="mb-4 text-[clamp(16px,1.6vw,24px)] font-medium text-[var(--text-secondary)]">
            {t.queue.upNext}
          </h2>
          {q.waiting.length === 0 ? (
            <p className="text-[clamp(16px,1.6vw,24px)] text-[var(--text-muted)]">{t.queue.displayNoWait}</p>
          ) : (
            <ol className="space-y-3 overflow-hidden">
              {q.waiting.slice(0, MAX_WAITING).map((e) => {
                const est = q.estimates.get(e.id);
                const m = est && est.waitMinutes >= 0 ? roundWait(est.waitMinutes) : null;
                return (
                  <li key={e.id} className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-5 py-3">
                    <span className="w-[3ch] text-[clamp(20px,2vw,34px)] font-semibold tabular-nums text-[var(--text-muted)]">{formatNumber(e.ticketNo)}</span>
                    <span className="min-w-0 flex-1 truncate text-[clamp(18px,2vw,32px)]">{displayName(e.clientName, e.ticketNo)}</span>
                    <span className="text-[clamp(16px,1.6vw,26px)] font-medium tabular-nums text-[var(--accent-text)]">
                      {m === null ? "—" : m === 0 ? t.queue.waitNow : interpolate(t.queue.waitMinutes, { n: formatNumber(m) })}
                    </span>
                  </li>
                );
              })}
              {q.waiting.length > MAX_WAITING && (
                <li className="px-5 text-[clamp(14px,1.4vw,20px)] text-[var(--text-muted)]">
                  {interpolate(t.queue.displayMore, { n: formatNumber(q.waiting.length - MAX_WAITING) })}
                </li>
              )}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}
