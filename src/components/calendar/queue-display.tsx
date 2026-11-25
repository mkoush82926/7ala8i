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

  const [current, ...alsoServing] = q.serving;
  // The TV is dark regardless of the app theme (§6.14): fixed hexes from the dark palette.
  const iconButton =
    "grid size-11 place-items-center rounded-full text-[#B8C7C4] transition-colors duration-150 hover:bg-[#172725] hover:text-[#ECF3F1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5EEAD4] motion-reduce:transition-none";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[#0B1514] text-[#ECF3F1] [color-scheme:dark]">
      <header className="flex items-center justify-between gap-4 border-b border-[#22312F] px-6 py-4 lg:px-10 lg:py-5">
        <div className="flex min-w-0 items-center gap-4">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#2DD4BF] text-xl font-extrabold text-[#042F2E]">
            {(shopName || "H").trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[clamp(20px,2.4vw,34px)] font-bold leading-tight tracking-tight rtl:tracking-normal">{shopName}</p>
            <p className="text-[clamp(13px,1.1vw,17px)] text-[#8FA3A0]">{t.queue.displaySubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="me-2 text-end tabular-nums">
            <span className="block text-[clamp(24px,3vw,44px)] font-bold leading-none">{formatTime(clock)}</span>
            <span className="mt-1 block text-[clamp(12px,1vw,16px)] text-[#8FA3A0]">{formatDate(clock, "weekdayDay")}</span>
          </p>
          <button type="button" onClick={goFullscreen} className={iconButton} aria-label={t.queue.fullscreen}>
            <Maximize2 size={18} aria-hidden="true" />
          </button>
          <Link href={href("/queue")} className={iconButton} aria-label={t.queue.exitDisplay}>
            <X size={20} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className="grid flex-1 gap-6 overflow-hidden p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-10 lg:p-10" aria-live="polite">
        <section aria-labelledby="tv-serving" className="flex min-h-0 flex-col">
          <h2 id="tv-serving" className="mb-4 text-[clamp(16px,1.5vw,24px)] font-semibold text-[#8FA3A0]">
            {t.queue.serving}
          </h2>
          {!current ? (
            <div className="grid flex-1 place-items-center rounded-3xl border border-dashed border-[#22312F] p-8">
              <p className="text-center text-[clamp(20px,2.2vw,34px)] font-semibold text-[#B8C7C4]">{t.queue.displayNobodyServing}</p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex flex-col justify-center rounded-3xl border border-[#1D4B46] bg-[#0F2E2B] px-8 py-6 lg:px-10 lg:py-8">
                <span
                  key={current.id}
                  className="block text-[clamp(88px,11vw,160px)] font-extrabold leading-none tabular-nums text-[#5EEAD4] motion-safe:animate-[tv-fade_400ms_ease-out]"
                >
                  {formatNumber(current.ticketNo)}
                </span>
                <span className="mt-3 block truncate text-[clamp(24px,2.8vw,44px)] font-bold">{displayName(current.clientName, current.ticketNo)}</span>
                {barberFirst(current.assignedBarberId) && (
                  <span className="mt-1 block text-[clamp(16px,1.6vw,26px)] text-[#99F6E4]">{barberFirst(current.assignedBarberId)}</span>
                )}
              </div>
              {alsoServing.length > 0 && (
                <ul className="grid gap-3 overflow-hidden sm:grid-cols-2">
                  {alsoServing.map((e) => (
                    <li key={e.id} className="flex items-center gap-4 rounded-2xl bg-[#111E1C] px-5 py-4">
                      <span className="text-[clamp(24px,2.4vw,40px)] font-bold tabular-nums text-[#5EEAD4]">{formatNumber(e.ticketNo)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[clamp(16px,1.6vw,26px)] font-semibold">{displayName(e.clientName, e.ticketNo)}</span>
                        <span className="block truncate text-[clamp(13px,1.2vw,18px)] text-[#8FA3A0]">{barberFirst(e.assignedBarberId)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="tv-next" className="flex min-h-0 flex-col">
          <h2 id="tv-next" className="mb-4 text-[clamp(16px,1.5vw,24px)] font-semibold text-[#8FA3A0]">
            {t.queue.upNext}
          </h2>
          {q.waiting.length === 0 ? (
            <div className="grid flex-1 place-items-center rounded-3xl border border-dashed border-[#22312F] p-8">
              <p className="text-center text-[clamp(20px,2.2vw,34px)] font-semibold text-[#B8C7C4]">{t.queue.displayNoWait}</p>
            </div>
          ) : (
            <ol className="space-y-2.5 overflow-hidden">
              {q.waiting.slice(0, MAX_WAITING).map((e, i) => {
                const est = q.estimates.get(e.id);
                const m = est && est.waitMinutes >= 0 ? roundWait(est.waitMinutes) : null;
                return (
                  <li
                    key={e.id}
                    className={
                      i === 0
                        ? "flex items-center gap-5 rounded-2xl border border-[#1D4B46] bg-[#111E1C] px-6 py-4"
                        : "flex items-center gap-5 rounded-2xl bg-[#111E1C]/70 px-6 py-3"
                    }
                  >
                    <span className="w-[3ch] shrink-0 text-[clamp(22px,2.2vw,38px)] font-bold tabular-nums text-[#ECF3F1]">{formatNumber(e.ticketNo)}</span>
                    <span className="min-w-0 flex-1 truncate text-[clamp(18px,1.9vw,30px)] font-medium">{displayName(e.clientName, e.ticketNo)}</span>
                    <span className="shrink-0 text-[clamp(16px,1.6vw,26px)] font-semibold tabular-nums text-[#5EEAD4]">
                      {m === null ? "—" : m === 0 ? t.queue.waitNow : interpolate(t.queue.waitMinutes, { n: formatNumber(m) })}
                    </span>
                  </li>
                );
              })}
              {q.waiting.length > MAX_WAITING && (
                <li className="px-6 pt-1 text-[clamp(14px,1.3vw,20px)] text-[#8FA3A0]">
                  {interpolate(t.queue.displayMore, { n: formatNumber(q.waiting.length - MAX_WAITING) })}
                </li>
              )}
            </ol>
          )}
        </section>
      </main>
      <style>{`@keyframes tv-fade { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  );
}
