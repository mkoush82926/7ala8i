/**
 * Publish checklist (WS-1A). The DB function get_shop_publish_checklist()
 * returns one boolean per key; this module turns it into a score, the
 * missing required items and the next suggested step. Required keys mirror
 * shop_publish_missing() in 20250101002010_shop_media.sql.
 */

export const CHECKLIST_KEYS = [
  "name",
  "services",
  "hours",
  "location",
  "photos",
  "contact",
  "description",
  "pin",
  "team",
  "bilingual",
  "amenities",
  "portfolio",
] as const;
export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

export interface ChecklistItemDef {
  key: ChecklistKey;
  required: boolean;
  weight: number;
  /** Section of the settings page that fixes it (anchor id or route). */
  target: string;
}

export const CHECKLIST: readonly ChecklistItemDef[] = [
  { key: "name", required: true, weight: 10, target: "/settings?tab=general" },
  { key: "services", required: true, weight: 15, target: "/services" },
  { key: "hours", required: true, weight: 15, target: "/settings?tab=hours" },
  { key: "location", required: true, weight: 10, target: "#location" },
  { key: "photos", required: false, weight: 12, target: "#photos" },
  { key: "contact", required: false, weight: 6, target: "/settings?tab=general" },
  { key: "description", required: false, weight: 6, target: "#details" },
  { key: "pin", required: false, weight: 6, target: "#location" },
  { key: "team", required: false, weight: 8, target: "#team" },
  { key: "bilingual", required: false, weight: 4, target: "#details" },
  { key: "amenities", required: false, weight: 4, target: "#amenities" },
  { key: "portfolio", required: false, weight: 4, target: "#portfolio" },
];

export type ChecklistState = Partial<Record<ChecklistKey, boolean>>;

export interface ChecklistSummary {
  /** 0–100, weighted. */
  score: number;
  done: ChecklistKey[];
  missingRequired: ChecklistKey[];
  missingRecommended: ChecklistKey[];
  canPublish: boolean;
  /** First missing item (required first), or null when complete. */
  next: ChecklistItemDef | null;
}

export function summarizeChecklist(state: ChecklistState | null | undefined): ChecklistSummary {
  const s = state ?? {};
  const total = CHECKLIST.reduce((sum, i) => sum + i.weight, 0);
  let got = 0;
  const done: ChecklistKey[] = [];
  const missingRequired: ChecklistKey[] = [];
  const missingRecommended: ChecklistKey[] = [];
  for (const item of CHECKLIST) {
    if (s[item.key] === true) {
      got += item.weight;
      done.push(item.key);
    } else if (item.required) {
      missingRequired.push(item.key);
    } else {
      missingRecommended.push(item.key);
    }
  }
  const nextKey = missingRequired[0] ?? missingRecommended[0] ?? null;
  return {
    score: total > 0 ? Math.round((got / total) * 100) : 0,
    done,
    missingRequired,
    missingRecommended,
    canPublish: missingRequired.length === 0,
    next: nextKey ? (CHECKLIST.find((i) => i.key === nextKey) ?? null) : null,
  };
}

/** Parses the DETAIL of a SHOP_INCOMPLETE error ("services,location"). */
export function parseIncompleteDetail(detail: string | null | undefined): ChecklistKey[] {
  return (detail ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ChecklistKey => (CHECKLIST_KEYS as readonly string[]).includes(s));
}
