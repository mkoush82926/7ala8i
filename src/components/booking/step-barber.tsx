"use client";

// Step 2 — barber: "Any barber" first, then cards with surcharge and the
// barber's next free time (next_available_slot). Tapping a card advances.

import React, { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslation } from "@/hooks/use-translation";
import { nextAvailableSlot, type AvailableSlot, type RpcClient } from "@/lib/availability";
import { BarberAvatar, SelectedMark } from "./booking-ui";
import { barberSurcharge, type Line, type ServiceRow } from "./booking-state";
import { nextSlotLabel, surchargeLabel } from "./booking-format";
import type { BookingBarber } from "./use-booking-data";

type NextMap = Record<string, AvailableSlot | null | undefined>;

export function StepBarber({
  client, shopId, barbers, lines, servicesById, selected, onChoose, currency, today, tomorrow,
}: {
  client: RpcClient;
  shopId: string;
  barbers: BookingBarber[];
  lines: Line[];
  servicesById: Map<string, ServiceRow>;
  selected: string | null;
  onChoose: (id: string) => void;
  currency: string | null;
  today: string;
  tomorrow: string;
}) {
  const { t, locale, formatLocalDate: formatDate, formatLocalTime: formatTime } = useTranslation();
  const f = t.bookingFlow;
  const serviceIds = useMemo(() => lines.map((l) => l.serviceId), [lines]);
  const itemsKey = serviceIds.join(",");
  const barbersKey = barbers.map((b) => b.id).join(",");
  const [next, setNext] = useState<NextMap>({});
  const [loading, setLoading] = useState(true);

  // Earliest free time per barber, plus "any" — in parallel, best effort.
  useEffect(() => {
    if (!itemsKey) return;
    let cancelled = false;
    const ids = ["any", ...(barbersKey ? barbersKey.split(",") : [])];
    const items = itemsKey.split(",");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the async fetch below
    setLoading(true);
    Promise.all(
      ids.map(async (id) => {
        try {
          return [id, await nextAvailableSlot(client, { shopId, items, barberId: id === "any" ? null : id })] as const;
        } catch {
          return [id, undefined] as const;
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setNext(Object.fromEntries(pairs));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [client, shopId, itemsKey, barbersKey]);

  const hint = (slot: AvailableSlot | null | undefined) => {
    if (slot === undefined) return loading ? f.checkingTimes : null;
    if (slot === null) return f.noTimesSoon;
    return nextSlotLabel(
      slot, today, tomorrow,
      {
        weekday: (d) => formatDate(d, "weekdayShort"),
        time: (hhmm) => formatTime(hhmm),
      },
      { today: t.common.today, tomorrow: f.tomorrow },
    );
  };

  if (barbers.length === 0) {
    return <EmptyState size="sm" icon={Users} title={t.booking.noBarbers} />;
  }

  const anyHint = hint(next.any);

  const stack = barbers.slice(0, 3);

  return (
    <div className="bk-grid-2" role="group" aria-label={t.booking.chooseBarber}>
      {barbers.length > 1 && (
        <button
          type="button"
          aria-pressed={selected === "any"}
          onClick={() => onChoose("any")}
          className={`bk-option${selected === "any" ? " is-selected" : ""}`}
        >
          <span aria-hidden="true" style={{ display: "inline-flex", height: 72, alignItems: "center" }}>
            {stack.length > 1 ? (
              stack.map((b, i) => (
                <span
                  key={b.id}
                  style={{ marginInlineStart: i === 0 ? 0 : -14, borderRadius: "50%", boxShadow: "0 0 0 3px var(--color-card)", display: "inline-flex" }}
                >
                  <BarberAvatar name={b.full_name?.trim() || "?"} url={b.avatar_url} seed={b.id} size={44} />
                </span>
              ))
            ) : (
              <span style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--color-brand-soft)", color: "var(--color-brand-text)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={28} />
              </span>
            )}
          </span>
          <span style={{ display: "block", minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 16, fontWeight: 600 }}>{t.booking.anyBarber}</span>
            <span className="text-meta" style={{ display: "block", color: "var(--color-ink-muted)", marginTop: 2 }}>{f.anyBarberHint}</span>
            {anyHint && <span className="bk-barber-next" style={{ display: "block", marginTop: 6 }}>{next.any ? `${f.earliest}: ${anyHint}` : anyHint}</span>}
          </span>
          {selected === "any" && <SelectedMark label={t.booking.selected} />}
        </button>
      )}
      {barbers.map((b) => {
        const isSelected = selected === b.id;
        const name = b.full_name?.trim() || "—";
        const delta = surchargeLabel(barberSurcharge(lines, servicesById, b.barber_services), currency, locale);
        const h = hint(next[b.id]);
        return (
          <button
            key={b.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChoose(b.id)}
            className={`bk-option${isSelected ? " is-selected" : ""}`}
          >
            <BarberAvatar name={name} url={b.avatar_url} seed={b.id} size={72} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0, maxWidth: "100%" }}>
              <span style={{ fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>{name}</span>
              {delta && <span className="bk-surcharge" aria-label={`${f.priceDifference}: ${delta}`}>{delta}</span>}
              {h && <span className="bk-barber-next">{h}</span>}
            </span>
            {isSelected && <SelectedMark label={t.booking.selected} />}
          </button>
        );
      })}
    </div>
  );
}
