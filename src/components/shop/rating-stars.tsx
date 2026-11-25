"use client";

import React from "react";
import {
  RatingStars as BaseRatingStars,
  type RatingStarsProps as BaseRatingStarsProps,
  type RatingStarsSize,
} from "@/components/ui/rating-stars";

/**
 * Shop-page rating stars: the v2 primitive (§5.16, amber fills, half stars
 * mirrored in RTL) with the legacy numeric `size` still accepted so older
 * call sites keep working. Prefer the named sizes in new code.
 *
 *   <RatingStars rating={4.6} size="md" label={t.shopPage.ratingLabel…} />
 *   <RatingStars rating={4.9} value="4.9" count="(312)" compact />
 */
export type RatingStarsProps = Omit<BaseRatingStarsProps, "size"> & {
  /** Named size, or a legacy pixel size (12 → xs, 16 → sm, 20 → md, 24 → lg). */
  size?: RatingStarsSize | number;
};

export function starSize(size: RatingStarsSize | number | undefined): RatingStarsSize {
  if (size === undefined) return "sm";
  if (typeof size === "string") return size;
  if (size <= 14) return "xs";
  if (size <= 17) return "sm";
  if (size <= 21) return "md";
  return "lg";
}

export function RatingStars({ size, ...rest }: RatingStarsProps) {
  return <BaseRatingStars size={starSize(size)} {...rest} />;
}

export { RatingInput } from "@/components/ui/rating-stars";
export type { RatingStarsSize } from "@/components/ui/rating-stars";

export default RatingStars;
