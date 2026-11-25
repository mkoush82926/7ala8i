// Staff push copy lookup: t.staffPush from the shared i18n dictionaries.
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import type { StaffPushDict, PushLocale } from "./messages";

/** Returns the dictionary for `locale`, or null if the keys are not merged yet. */
export function staffPushDict(locale: PushLocale): StaffPushDict | null {
  const source = (locale === "ar" ? ar : en) as unknown as { staffPush?: StaffPushDict };
  const fallback = en as unknown as { staffPush?: StaffPushDict };
  return source.staffPush ?? fallback.staffPush ?? null;
}
