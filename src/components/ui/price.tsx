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
  const text = from && !isFree ? t.primitives.fromPrice.replace("{price}", main) : main;
  const previous = was != null && Number.isFinite(was) && was > amount ? formatJOD(was, opts) : null;

  return (
    <Tag className={cn("inline-flex items-baseline gap-1.5 tabular-nums", className)}>
      <bdi className="font-semibold text-[var(--text-primary)]">{text}</bdi>
      {previous ? (
        <>
          <s aria-hidden="true" className="text-xs text-[var(--text-muted)]">
            <bdi>{previous}</bdi>
          </s>
          <span className="sr-only">{t.primitives.priceWas.replace("{price}", previous)}</span>
        </>
      ) : null}
    </Tag>
  );
}

export default Price;
