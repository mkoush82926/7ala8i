"use client";

import React from "react";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { formatJOD, formatJODRange, type CashRounding, type DigitPreference } from "@/lib/format";

/**
 * Money in JOD, rendered through formatJOD() so every surface shows the same
 * fils precision, label ("JD" / "د.أ") and digits.
 *
 *   <Price amount={7.5} />                 → 7.500 JD   /  ٧٫٥٠٠ د.أ
 *   <Price amount={5} from trimZeros />    → from 5 JD  /  من ٥ د.أ
 *   <Price amount={5} max={8} trimZeros /> → 5–8 JD
 *   <Price amount={6} was={8} />           → 6.000 JD  ~~8.000 JD~~ (sr: "Was 8.000 JD")
 *
 * A zero amount shows the localised "Free" label rather than "0.000".
 */
export interface PriceProps {
  amount: number;
  /** Upper bound for a range ("5–8 JD"). */
  max?: number | null;
  /** Prefix with "from" (variable pricing). */
  from?: boolean;
  /** Previous price, shown struck through (deals). */
  was?: number | null;
  rounding?: CashRounding;
  digits?: DigitPreference;
  trimZeros?: boolean;
  className?: string;
  /** Element to render (default span). */
  as?: "span" | "p" | "div";
}

export function Price({
  amount,
  max,
  from = false,
  was,
  rounding,
  digits = "auto",
  trimZeros = false,
  className,
  as: Tag = "span",
}: PriceProps) {
  const { t, locale } = useTranslation();
  const opts = { locale, digits, rounding, trimZeros };

  const isFree = (!Number.isFinite(amount) || amount <= 0) && !(max && max > 0);
  const main = isFree
    ? t.primitives.free
    : max != null && max !== amount
      ? formatJODRange(amount, max, opts)
      : formatJOD(amount, opts);
  const previous = was != null && Number.isFinite(was) && was > amount ? formatJOD(was, opts) : null;

  // "from {price}" → muted prefix/suffix around the semibold amount (§5.18).
  let before = "";
  let after = "";
  if (from && !isFree) {
    const tpl = t.primitives.fromPrice;
    const at = tpl.indexOf("{price}");
    if (at === -1) before = `${tpl} `;
    else {
      before = tpl.slice(0, at);
      after = tpl.slice(at + "{price}".length);
    }
  }

  return (
    <Tag className={cn("inline-flex items-baseline gap-1.5 tabular-nums", className)}>
      <bdi className={cn("font-semibold", previous ? "text-success-text" : "text-ink")}>
        {before && <span className="font-normal text-ink-muted">{before}</span>}
        {main}
        {after && <span className="font-normal text-ink-muted">{after}</span>}
      </bdi>
      {previous ? (
        <>
          <s aria-hidden="true" className="text-xs text-ink-muted">
            <bdi>{previous}</bdi>
          </s>
          <span className="sr-only">{t.primitives.priceWas.replace("{price}", previous)}</span>
        </>
      ) : null}
    </Tag>
  );
}

export default Price;
