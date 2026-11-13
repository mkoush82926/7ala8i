import React from "react";
import { cn } from "@/lib/utils";
import { localizeDigits, META_SEPARATOR, type DigitPreference } from "@/lib/format";

/**
 * Dense facts joined by the house middle dot:
 *   <MetaLine locale={locale} items={["4.9 (312)", t.x.openUntil, "Khalda, Amman"]} />
 *   → 4.9 (312) · Open until 11:00 pm · Khalda, Amman
 *
 * - Empty items (null, false, "", undefined) are dropped, so callers can pass
 *   conditional facts inline without leaving stray dots.
 * - Each item is bidi-isolated (<bdi>) so mixed Arabic/Latin facts never
 *   reorder across the separators in RTL.
 * - String / number items get their digits localised when `locale` is set
 *   (Arabic-Indic in Arabic unless the user prefers Latin digits).
 * - Separators are hidden from assistive tech; a visually hidden comma keeps
 *   screen-reader pauses between facts.
 *
 * Server-safe (no hooks), so it renders in server and client components.
 */
export interface MetaItemObject {
  /** Stable key (defaults to the index). */
  key?: string;
  label: React.ReactNode;
  /** Optional leading icon (decorative; mark it aria-hidden). */
  icon?: React.ReactNode;
  /** Tooltip / accessible description. */
  title?: string;
  className?: string;
}

export type MetaItem = MetaItemObject | React.ReactNode | number;

export interface MetaLineProps {
  items: ReadonlyArray<MetaItem>;
  /** Locale for digit localisation of string/number items. Omit to leave text as-is. */
  locale?: string;
  digits?: DigitPreference;
  /** Wrapping element (default "p"). */
  as?: "p" | "div" | "span";
  /** Allow wrapping onto several lines (default) or truncate to one line. */
  truncate?: boolean;
  className?: string;
  /** Extra class for each item. */
  itemClassName?: string;
}

function isItemObject(item: unknown): item is MetaItemObject {
  return typeof item === "object" && item !== null && !React.isValidElement(item) && "label" in item;
}

function isEmpty(item: unknown): boolean {
  if (item === null || item === undefined || item === false || item === true) return true;
  if (typeof item === "string") return item.trim() === "";
  if (typeof item === "number") return !Number.isFinite(item);
  if (isItemObject(item)) return isEmpty(item.label);
  return false;
}

export function MetaLine({
  items,
  locale,
  digits = "auto",
  as: Tag = "p",
  truncate = false,
  className,
  itemClassName,
}: MetaLineProps) {
  const visible = items.filter((item) => !isEmpty(item));
  if (visible.length === 0) return null;

  const localize = (node: React.ReactNode): React.ReactNode => {
    if (!locale) return node;
    if (typeof node === "string" || typeof node === "number") return localizeDigits(String(node), locale, digits);
    return node;
  };

  return (
    <Tag
      className={cn(
        "flex items-center gap-x-1.5 text-sm text-[var(--text-secondary)]",
        truncate ? "min-w-0 flex-nowrap overflow-hidden whitespace-nowrap" : "flex-wrap",
        className,
      )}
    >
      {visible.map((item, i) => {
        const obj = isItemObject(item) ? item : null;
        const key = obj?.key ?? String(i);
        return (
          <React.Fragment key={key}>
            {i > 0 && (
              <>
                <span aria-hidden="true" className="select-none text-[var(--text-muted)]">
                  {META_SEPARATOR}
                </span>
                <span className="sr-only">, </span>
              </>
            )}
            <bdi
              title={obj?.title}
              className={cn(
                "inline-flex items-center gap-1",
                truncate && i === visible.length - 1 && "min-w-0 truncate",
                itemClassName,
                obj?.className,
              )}
            >
              {obj?.icon}
              {localize(obj ? obj.label : (item as React.ReactNode))}
            </bdi>
          </React.Fragment>
        );
      })}
    </Tag>
  );
}

export default MetaLine;
