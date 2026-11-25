"use client";

import React, { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { nextAvailableSlot, type AvailableSlot } from "@/lib/availability";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { localDateIn, noonOf, relativeDay } from "./lib/when";

/**
 * "Next available: Thu 5:30 pm" for one barber (or any barber), computed by
 * the availability engine after mount. Renders nothing on error.
 */
export function NextAvailable({
  shopId,
  serviceId,
  barberId,
  timeZone,
  className,
}: {
  shopId: string;
  serviceId: string | null;
  barberId?: string | null;
  timeZone: string;
  className?: string;
}) {
  const { t, formatLocalDate: formatDate, formatLocalTime: formatTime } = useTranslation();
  const [state, setState] = useState<{ status: "loading" | "ok" | "none" | "error"; slot?: AvailableSlot }>({ status: "loading" });

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    nextAvailableSlot(createClient(), { shopId, items: [serviceId], barberId: barberId ?? null })
      .then((slot) => {
        if (!cancelled) setState(slot ? { status: "ok", slot } : { status: "none" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [shopId, serviceId, barberId]);

  if (!serviceId || state.status === "error") return null;

  let text: string;
  if (state.status === "loading") text = t.barberPage.checkingAvailability;
  else if (state.status === "none" || !state.slot) text = t.barberPage.noAvailability;
  else {
    const slot = state.slot;
    const rel = relativeDay(slot.localDate, localDateIn(new Date(), timeZone));
    const day =
      rel === "today" ? t.common.today : rel === "tomorrow" ? t.shopProfile.tomorrow : formatDate(noonOf(slot.localDate), { weekday: "short", day: "numeric", month: "short" });
    text = interpolate(t.barberPage.nextAvailable, { when: `${day} ${formatTime(slot.localTime)}` });
  }

  return (
    <p className={className} aria-live="polite">
      <CalendarClock size={16} aria-hidden="true" className="me-1.5 -mt-0.5 inline-block text-success" />
      {text}
    </p>
  );
}

export default NextAvailable;
