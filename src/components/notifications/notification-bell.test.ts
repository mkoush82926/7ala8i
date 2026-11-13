import { describe, expect, it } from "vitest";
import { describeNotification, type NotificationRow } from "./notification-bell";
import type { TranslationKeys } from "@/i18n/en";

// Minimal dictionary stub: only the keys describeNotification reads.
const t = {
  notifications: {
    aClient: "A client",
    bookingCreated: "New booking",
    bookingCancelledByCustomer: "Cancelled by customer",
    bookingStatusChanged: "Booking {status}",
    bookingUpdated: "Booking updated",
  },
  calendar: {
    pending: "Pending",
    confirmed: "Confirmed",
    completed: "Completed",
    noShow: "No Show",
    cancelled: "Cancelled",
  },
} as unknown as TranslationKeys;

const fmt = { time: () => "2:05 PM", date: () => "12 Nov" };

function row(partial: Partial<NotificationRow>): NotificationRow {
  return {
    id: "n1",
    type: null,
    payload: null,
    title: null,
    message: null,
    link: null,
    is_read: false,
    created_at: "2026-11-12T10:00:00Z",
    ...partial,
  };
}

describe("describeNotification", () => {
  it("renders typed rows from the payload with a calendar deep link", () => {
    const start = new Date(2026, 10, 12, 14, 5).toISOString();
    const d = describeNotification(
      row({ type: "booking_created", payload: { client_name: "Omar", service_name: "Fade", start_time: start } }),
      t,
      fmt,
    );
    expect(d.title).toBe("New booking");
    expect(d.body).toBe("Omar · Fade · 12 Nov · 2:05 PM");
    expect(d.link).toBe("/calendar?date=2026-11-12");
  });

  it("localises status changes, including legacy values", () => {
    const d = describeNotification(row({ type: "booking_status_changed", payload: { status: "no-show" } }), t, fmt);
    expect(d.title).toBe("Booking No Show");
    expect(d.body).toBe("A client");
  });

  it("falls back to stored text for legacy rows and ignores bad dates", () => {
    const d = describeNotification(row({ title: "Old", message: "Body", link: "/calendar" }), t, fmt);
    expect(d).toEqual({ title: "Old", body: "Body", link: "/calendar" });
    const bad = describeNotification(
      row({ type: "booking_created", link: "/x", payload: { start_time: "not-a-date" } }),
      t,
      fmt,
    );
    expect(bad.link).toBe("/x");
  });
});
