import type { Metadata } from "next";

type QueryRecord = Record<string, string | string[] | undefined>;

/** Query keys that make a page a distinct, index-worthy listing. */
const INDEXABLE_KEYS = new Set(["city", "area", "q"]);

/**
 * Plain listings (/explore, ?city=amman, ?city=amman&area=abdoun, ?q=fade)
 * are indexable; anything with time, filters, sort, paging or view state is
 * a personal refinement and stays out of the index (but is still followed).
 */
export function exploreRobots(query: QueryRecord | null | undefined): Metadata["robots"] {
  const keys = Object.keys(query ?? {}).filter((k) => {
    const v = query?.[k];
    return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  });
  const indexable = keys.every((k) => INDEXABLE_KEYS.has(k)) && !(keys.includes("q") && keys.length > 1);
  return indexable ? { index: true, follow: true } : { index: false, follow: true };
}
