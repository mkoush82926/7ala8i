import React from "react";
import { Star } from "lucide-react";

/** Five brass stars; pass `label` to expose it as one image to assistive tech. */
export function RatingStars({ rating, size = 16, label }: { rating: number; size?: number; label?: string }) {
  const rounded = Math.round(rating);
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          aria-hidden="true"
          strokeWidth={1.75}
          style={{
            color: s <= rounded ? "var(--accent-brass)" : "var(--border-subtle)",
            fill: s <= rounded ? "var(--accent-brass)" : "transparent",
          }}
        />
      ))}
    </span>
  );
}

export default RatingStars;
