"use client";

// Step 3 — time: a day strip (full days greyed out), Morning / Afternoon /
// Evening / Night groups and a "Next available" jump, all from
// get_available_slots. Tapping a time advances to the review step.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarSearch, ChevronsRight, ChevronsLeft, MessageCircle, RefreshCw, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import {
  getAvailableSlots,
  groupSlotsByDayPart,
  nextAvailableSlot,
  slotsForServiceDay,
  type AvailableSlot,
  type RpcClient,
} from "@/lib/availability";
import { ChipsSkeleton, InlineAlert } from "./booking-ui";
import { dateRange } from "./booking-state";
import { nextSlotLabel } from "./booking-format";

/** Days shown in the strip (one RPC call covers them + the night tail). */
export const STRIP_DAYS = 21;

export interface ChosenSlot {
  startIso: string;
  localDate: string;
  localTime: string;
}

export function StepTime({
  client, shopId, serviceIds, barberId, today, tomorrow, date, onDate, selected, onChoose,
  notice, ignoreAppointmentId, onAnyBarber, waHref, refreshKey,
}: {
  client: RpcClient;
  shopId: string;
  serviceIds: string[];
  barberId: string | null;
  today: string;
  tomorrow: string;
  date: string | null;
  onDate: (d: string) => void;
  selected: ChosenSlot | null;
  onChoose: (slot: AvailableSlot) => void;
  notice: string | null;
  ignoreAppointmentId: string | null;
  /** Offered when a specific barber has nothing free. */
  onAnyBarber: (() => void) | null;
  waHref: string | null;
  refreshKey: number;
}) {
  const { t, formatDate, formatTime } = useTranslation();
  const f = t.bookingFlow;
  const [rangeStart, setRangeStart] = useState(today);
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [nextBeyond, setNextBeyond] = useState<AvailableSlot | null | undefined>(undefined);

  const days = useMemo(() => dateRange(rangeStart, STRIP_DAYS), [rangeStart]);
  const itemsKey = serviceIds.join(",");

  useEffect(() => {
    if (!itemsKey) return;
    let cancelled = false;
    const all = dateRange(rangeStart, STRIP_DAYS + 1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset before the async fetch below
    setSlots(null);
    setError(false);
    getAvailableSlots(client, {
      shopId,
      dateFrom: all[0],
      dateTo: all[all.length - 1],
      items: itemsKey.split(","),
      barberId,
      ignoreAppointmentId,
    })
      .then((rows) => { if (!cancelled) setSlots(rows); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [client, shopId, itemsKey, barberId, rangeStart, ignoreAppointmentId, reload, refreshKey]);

  const byDay = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    if (!slots) return map;
    days.forEach((d, i) => {
      const nextDate = i + 1 < days.length ? days[i + 1] : dateRange(d, 2)[1];
      map.set(d, slotsForServiceDay(slots, d, nextDate));
    });
    return map;
  }, [slots, days]);

  const firstOpen = days.find((d) => (byDay.get(d)?.length ?? 0) > 0) ?? null;
  const activeDate = date && days.includes(date) && (byDay.get(date)?.length ?? 0) > 0 ? date : firstOpen;
  const daySlots = activeDate ? byDay.get(activeDate) ?? [] : [];
  const groups = groupSlotsByDayPart(daySlots);
  const firstSlot = firstOpen ? byDay.get(firstOpen)?.[0] ?? null : null;

  // Nothing in the strip: ask the engine for the next free time after it.
  useEffect(() => {
    if (!slots || firstOpen || !itemsKey) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading marker for the async lookup
    setNextBeyond(undefined);
    nextAvailableSlot(client, { shopId, items: itemsKey.split(","), barberId })
      .then((s) => { if (!cancelled) setNextBeyond(s); })
      .catch(() => { if (!cancelled) setNextBeyond(null); });
    return () => { cancelled = true; };
  }, [client, shopId, itemsKey, barberId, slots, firstOpen]);

  const slotHint = useCallback(
    (s: AvailableSlot) =>
      nextSlotLabel(s, today, tomorrow, { weekday: (d) => formatDate(d, "weekdayDay"), time: (x) => formatTime(x) }, {
        today: t.common.today,
        tomorrow: f.tomorrow,
      }),
    [today, tomorrow, formatDate, formatTime, t.common.today, f.tomorrow],
  );

  const jumpTo = (s: AvailableSlot) => {
    if (!days.includes(s.localDate)) setRangeStart(s.localDate);
    onDate(s.localDate);
  };

  const canGoBack = rangeStart > today;
  const partLabel: Record<string, string> = {
    morning: t.booking.morning, afternoon: t.booking.afternoon, evening: t.booking.evening, night: f.night,
  };

  return (
    <div>
      {notice && <div style={{ marginBottom: 16 }}><InlineAlert>{notice}</InlineAlert></div>}

      {/* Day strip */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>
            {activeDate ? formatDate(activeDate, "monthYear") : t.booking.selectDate}
          </h2>
          <div style={{ display: "flex", gap: 6 }}>
            {canGoBack && (
              <button type="button" className="bk-icon-btn" onClick={() => setRangeStart(today)} aria-label={f.backToToday}>
                <ChevronsLeft size={18} aria-hidden="true" className="rtl:-scale-x-100" />
              </button>
            )}
            <button type="button" className="bk-icon-btn" onClick={() => setRangeStart(dateRange(rangeStart, STRIP_DAYS + 1)[STRIP_DAYS])} aria-label={f.laterDates}>
              <ChevronsRight size={18} aria-hidden="true" className="rtl:-scale-x-100" />
            </button>
          </div>
        </div>
        {!slots && !error ? (
          <div style={{ display: "flex", gap: 8, overflow: "hidden" }} aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} variant="card" style={{ width: 62, height: 76, flexShrink: 0 }} />)}
          </div>
        ) : (
          <div className="bk-date-strip" role="radiogroup" aria-label={t.booking.selectDate}>
            {days.map((d) => {
              const count = byDay.get(d)?.length ?? 0;
              const isSelected = d === activeDate;
              const full = count === 0;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${formatDate(d, "long")}${full ? ` · ${f.fullyBooked}` : ""}`}
                  disabled={full}
                  onClick={() => onDate(d)}
                  className={`bk-day${isSelected ? " is-selected" : ""}`}
                >
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{d === today ? t.common.today : formatDate(d, "weekdayShort")}</span>
                  <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.1 }}>{formatDate(d, { day: "numeric" })}</span>
                  {full ? <span style={{ fontSize: 10, fontWeight: 600 }}>{f.full}</span> : <span className="bk-day-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Next available jump */}
      {firstSlot && activeDate !== firstOpen && (
        <div style={{ marginBottom: 16 }}>
          <button type="button" className="bk-jump" onClick={() => jumpTo(firstSlot)}>
            <CalendarSearch size={15} aria-hidden="true" />
            {interpolate(f.nextAvailable, { when: slotHint(firstSlot) })}
          </button>
        </div>
      )}

      {/* Times */}
      <h2 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 12px" }}>
        {t.booking.availableTimes}
        {activeDate && <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}> · {formatDate(activeDate, "weekdayDay")}</span>}
      </h2>

      {error ? (
        <EmptyState
          tone="error" size="sm" icon={AlertCircle} title={t.error.message}
          action={{ label: t.error.tryAgain, onClick: () => setReload((n) => n + 1), icon: RefreshCw }}
        />
      ) : !slots ? (
        <ChipsSkeleton label={t.common.loading} />
      ) : groups.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <EmptyState
            size="sm"
            icon={CalendarSearch}
            title={f.noTimesInRange}
            description={
              nextBeyond === undefined ? t.common.loading
                : nextBeyond ? interpolate(f.nextAvailable, { when: slotHint(nextBeyond) })
                : f.noTimesInWindow
            }
            action={nextBeyond ? { label: f.goToNextAvailable, onClick: () => jumpTo(nextBeyond) } : undefined}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {onAnyBarber && (
              <button type="button" className="bk-jump" onClick={onAnyBarber}>
                <Users size={15} aria-hidden="true" /> {f.tryAnyBarber}
              </button>
            )}
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="bk-jump" style={{ textDecoration: "none" }}>
                <MessageCircle size={15} aria-hidden="true" /> {f.askShopWhatsApp}
              </a>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groups.map((group) => (
            <div key={group.key} role="group" aria-labelledby={`bk-slots-${group.key}`}>
              <p id={`bk-slots-${group.key}`} style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 8px" }}>
                {partLabel[group.key]}
              </p>
              <div className="bk-slot-grid">
                {group.items.map((slot) => {
                  const isSelected = selected?.startIso === slot.startIso;
                  const label = formatTime(slot.localTime);
                  return (
                    <button
                      key={slot.startIso}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onChoose(slot)}
                      className={`bk-slot${isSelected ? " is-selected" : ""}`}
                    >
                      <span dir="ltr">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
