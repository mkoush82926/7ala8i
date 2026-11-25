import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

// Key-echoing translator: the test does not depend on copy (or on keys that
// land with the shared i18n merge).
vi.mock("@/hooks/use-translation", () => {
  const proxy = (path: string): unknown =>
    new Proxy(() => path, {
      get: (_t, key) => (key === Symbol.toPrimitive || key === "toString" ? () => path : proxy(`${path}.${String(key)}`)),
    });
  return {
    useTranslation: () => ({
      t: proxy("t"),
      isRTL: false,
      locale: "en",
      formatDate: () => "day",
      formatTime: () => "10:00",
      formatNumber: (n: number) => String(n),
    }),
    interpolate: (s: unknown) => String(s),
  };
});

import { WeekMatrix } from "./week-matrix";
import { rangeFor } from "./calendar-model";
import type { CalendarAppointment } from "@/hooks/use-appointments";

function seed(): { lanes: { key: string; barberId: string; name: string; color: string }[]; appts: CalendarAppointment[]; days: string[] } {
  const days = rangeFor("week", new Date(2026, 10, 14)).days;
  const lanes = Array.from({ length: 6 }, (_, i) => ({ key: `b${i}`, barberId: `b${i}`, name: `Barber ${i}`, color: "#0F766E" }));
  const appts: CalendarAppointment[] = [];
  let n = 0;
  for (const lane of lanes) {
    for (const day of days) {
      for (let k = 0; k < 8; k++) {
        const [y, m, d] = day.split("-").map(Number);
        const start = new Date(y, m - 1, d, 9 + k, 0);
        appts.push({
          id: `a${n++}`,
          barberId: lane.barberId,
          clientId: null,
          clientName: `Client ${n}`,
          serviceIds: [],
          serviceName: "Cut",
          startTime: start.toISOString(),
          endTime: new Date(start.getTime() + 45 * 60000).toISOString(),
          durationMinutes: 45,
          status: "confirmed",
          price: 5,
          currency: "JOD",
          notes: null,
          source: "walk_in",
          arrivedAt: null,
          startedAt: null,
          services: [],
        } as unknown as CalendarAppointment);
      }
    }
  }
  return { lanes, appts, days };
}

describe("WeekMatrix", () => {
  it("renders 6 barbers × 7 days (336 bookings) quickly", () => {
    const { lanes, appts, days } = seed();
    const props = {
      days,
      lanes,
      appointments: appts,
      blocks: [],
      colorFor: () => "#0F766E",
      now: new Date(2026, 10, 14, 12),
      canEdit: () => true,
      isWorking: () => true,
      onOpen: () => {},
      onSlot: () => {},
      onMove: () => {},
      onOpenDay: () => {},
    };
    // Warm-up (module init, style recalculation), then measure.
    const warm = render(<WeekMatrix {...props} />);
    warm.unmount();
    const t0 = performance.now();
    render(<WeekMatrix {...props} />);
    const elapsed = performance.now() - t0;
    expect(screen.getAllByRole("row").length).toBeGreaterThanOrEqual(7);
    // jsdom is several times slower than a browser; the browser budget is 200 ms.
    expect(elapsed).toBeLessThan(400);
  });
});
