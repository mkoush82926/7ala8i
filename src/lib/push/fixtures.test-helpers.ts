import type { StaffPushDict } from "./messages";

/** Test dictionary mirroring the shape of t.staffPush. */
export const DICT: StaffPushDict = {
  titles: {
    booking_new: "New booking",
    booking_cancelled: "Booking cancelled",
    booking_rescheduled: "Booking moved",
    walk_in_assigned: "Walk-in assigned to you",
    waitlist_filled: "Waitlist slot filled",
    test: "Alerts on",
  },
  testBody: "Test body",
  reassignedTitle: "Moved to you",
  reassignedAwayTitle: "Moved away",
  movedFromTo: "{from} → {to}",
  unknownClient: "Client",
  whatsappIntro: "Halaqy · {shop}",
  openLink: "Open:",
};
