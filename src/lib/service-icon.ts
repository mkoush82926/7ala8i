// Maps a service name to a Material Symbols icon name via simple keyword
// matching. Services have no photo/icon column in the schema, so this keeps
// the UI from resorting to a handful of generic stock photos repeated across
// every service card — an icon per service reads as intentional design
// instead of placeholder filler.
//
// Keywords cover English and Arabic names (shops often name services only in
// Arabic). Arabic matching ignores tashkeel/tatweel and folds alef/ya/ta-marbuta
// variants so "صبغة" and "صبغه" or "أطفال" and "اطفال" match alike. Short
// stems that occur inside unrelated words (e.g. "لون" in "صالون") are avoided.

const KEYWORDS = {
  packages: ["package", "vip", "combo", "باقة", "باقه", "بكج"],
  beard: ["beard", "shave", "moustache", "mustache", "لحية", "لحيه", "ذقن", "شنب", "شارب", "حلاقة ذقن", "سكسوكة"],
  color: ["color", "colour", "dye", "highlight", "صبغ", "صبغة", "تلوين", "هايلايت"],
  kids: ["kid", "child", "boy", "طفل", "اطفال", "صغار", "ولاد"],
  spa: ["spa", "facial", "mask", "سبا", "تنظيف بشرة", "بشرة", "ماسك", "مساج", "فيشل"],
  treatment: ["keratin", "treatment", "protein", "كيراتين", "علاج", "بروتين"],
} as const;

/** Lower-cases and folds Arabic letter variants for keyword matching. Exported for tests. */
export function normalizeServiceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "") // tashkeel + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

const NORMALIZED = Object.fromEntries(
  Object.entries(KEYWORDS).map(([k, words]) => [k, words.map(normalizeServiceName)]),
) as Record<keyof typeof KEYWORDS, string[]>;

function has(n: string, group: keyof typeof KEYWORDS): boolean {
  return NORMALIZED[group].some((w) => n.includes(w));
}

export function getServiceIcon(name: string): string {
  const n = normalizeServiceName(name);
  if (has(n, "beard")) return "face";
  if (has(n, "color")) return "palette";
  if (has(n, "spa")) return "spa";
  if (has(n, "treatment")) return "auto_awesome";
  if (has(n, "kids")) return "child_care";
  return "content_cut";
}

export type ServiceCategory = "packages" | "beard" | "color" | "kids" | "spa" | "hair";

// Same keyword-matching approach as getServiceIcon, grouping services into
// browsable categories (services have no category column in the schema) —
// mirrors the category-pill filter pattern real booking platforms use so a
// shop with a long menu isn't just one long undifferentiated list.
// Pass every name a service has (e.g. name and name_ar); the first match wins.
export function getServiceCategory(...names: (string | null | undefined)[]): ServiceCategory {
  const n = names.filter(Boolean).map((x) => normalizeServiceName(x as string)).join(" ");
  if (has(n, "packages")) return "packages";
  if (has(n, "beard")) return "beard";
  if (has(n, "color")) return "color";
  if (has(n, "kids")) return "kids";
  if (has(n, "spa")) return "spa";
  return "hair";
}
