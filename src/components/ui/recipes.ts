/**
 * Design System v2 ("Deep Teal & Sand") class recipes — docs/DESIGN_SYSTEM_V2.md §5.
 *
 * Plain strings / pure functions (no React), so they work in server
 * components, client components and tests. Primitives in this folder are
 * built from these; pages can use them directly for one-off elements that
 * must look like a primitive (e.g. a <Link> styled as a button):
 *
 *   <Link href={href} className={buttonClasses({ variant: "secondary", size: "sm" })}>…</Link>
 *   <input className={inputClasses()} aria-invalid={!!error} />
 *   <section className={cardClasses({ elevation: "card" })}>…</section>
 */
import { cn } from "@/lib/utils";

/** Visible keyboard ring (2px teal, offset 2). */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Press feedback: colour transitions + 0.98 scale (none under reduced motion). */
export const pressable =
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-standard active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100";

/** Disabled look for native disabled and aria-disabled. */
export const disabledState =
  "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45";

// ── Buttons (§5.1) ──────────────────────────────────────────────────────────

export const BUTTON_VARIANTS = [
  "primary",
  "secondary",
  "ink",
  "soft",
  "ghost",
  "link",
  "destructive",
  "destructive-soft",
] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

export const BUTTON_SIZES = ["sm", "md", "lg", "xl", "icon", "icon-sm"] as const;
export type ButtonSize = (typeof BUTTON_SIZES)[number];

export const buttonBase = cn(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none cursor-pointer no-underline",
  focusRing,
  pressable,
  disabledState,
);

export const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand shadow-xs hover:bg-brand-hover active:bg-brand-pressed",
  secondary: "bg-card text-ink border border-line-strong hover:border-ink hover:bg-sunken",
  ink: "bg-inverse text-on-inverse hover:bg-ink-soft",
  soft: "bg-brand-soft text-brand-pressed hover:bg-brand-soft-line/60",
  ghost: "bg-transparent text-ink-soft hover:bg-sunken hover:text-ink",
  link: "h-auto px-0 rounded-sm bg-transparent text-brand-text underline-offset-4 hover:underline active:scale-100",
  destructive: "bg-danger text-white hover:brightness-95 dark:text-[#2E1414]",
  "destructive-soft": "bg-danger-soft text-danger-text border border-transparent hover:border-danger/30",
};

export const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm [&_svg]:size-4",
  md: "h-11 px-5 text-[15px] [&_svg]:size-[18px]",
  lg: "h-12 px-6 text-base [&_svg]:size-5",
  xl: "h-[52px] px-7 text-base [&_svg]:size-5",
  icon: "size-11 p-0 [&_svg]:size-5",
  "icon-sm": "size-9 p-0 [&_svg]:size-4",
};

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/** Full class string for a button-looking element (button, a, Link). */
export function buttonClasses({ variant = "primary", size = "md", fullWidth = false, className }: ButtonClassOptions = {}) {
  return cn(
    buttonBase,
    buttonSizeClasses[size],
    buttonVariantClasses[variant],
    variant === "link" && "h-auto px-0",
    fullWidth && "w-full",
    className,
  );
}

/** Inline loading spinner (pair with aria-busy on the control). */
export const spinnerClasses =
  "inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none";

// ── Form fields (§5.2) ──────────────────────────────────────────────────────

export const labelClasses = "mb-1.5 block text-sm font-semibold text-ink";
export const helperClasses = "mt-1.5 text-[13px] text-ink-muted";
export const errorTextClasses = "mt-1.5 flex gap-1.5 text-[13px] font-medium text-danger-text [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0";

const fieldBase =
  "w-full rounded-lg border border-line-strong bg-card px-4 text-base text-ink placeholder:text-ink-muted hover:border-ink-soft focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15 disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-disabled transition-[border-color,box-shadow] duration-150 sm:text-[15px]";

/** Text input. Pass `withIcon` when a leading icon sits at `start-4`. */
export function inputClasses({ withIcon = false, className }: { withIcon?: boolean; className?: string } = {}) {
  return cn(fieldBase, "h-12", withIcon && "ps-11", className);
}
/** Native select: input look + room for a chevron at `end-4`. */
export function selectClasses({ className }: { className?: string } = {}) {
  return cn(fieldBase, "h-12 appearance-none pe-10", className);
}
export function textareaClasses({ className }: { className?: string } = {}) {
  return cn(fieldBase, "min-h-28 py-3 leading-6", className);
}
/** Leading icon slot inside a `relative` wrapper. */
export const fieldIconClasses =
  "pointer-events-none absolute inset-y-0 start-4 grid place-items-center text-ink-muted [&_svg]:size-5";
/** Checkbox (with @tailwindcss/forms). Radio: add `rounded-full`. */
export const checkboxClasses =
  "size-5 rounded-[6px] border-line-strong bg-card text-brand focus:ring-2 focus:ring-brand/30 focus:ring-offset-0";

// ── Surfaces (§5.4) ─────────────────────────────────────────────────────────

export type CardElevation = "flat" | "card" | "raised" | "float";

const ELEVATION: Record<CardElevation, string> = {
  flat: "",
  card: "shadow-card",
  raised: "shadow-raised",
  float: "shadow-float",
};

/**
 * Card surface: white, hairline border, 16px radius. Marketplace cards use
 * `elevation: "card"` (lifts on hover with `interactive`); dense dashboard
 * panels stay `flat`.
 */
export function cardClasses({
  elevation = "flat",
  interactive = false,
  className,
}: { elevation?: CardElevation; interactive?: boolean; className?: string } = {}) {
  return cn(
    "rounded-xl border border-line bg-card text-ink",
    ELEVATION[elevation],
    interactive &&
      "transition-[box-shadow,border-color] duration-200 ease-standard hover:shadow-raised focus-within:shadow-raised",
    className,
  );
}

// ── Pills / chips (§5.5) ────────────────────────────────────────────────────

/** Filter chip (toggle): selected = ink, so teal stays for the one CTA. */
export const filterChipClasses = cn(
  "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-card px-3.5 text-sm font-medium text-ink hover:border-ink aria-pressed:border-inverse aria-pressed:bg-inverse aria-pressed:text-on-inverse [&_svg]:size-4",
  focusRing,
  pressable,
  disabledState,
);

/** Chip sitting on a photo (badges, distance, 1/N counter). Photos don't theme. */
export const onPhotoChipClasses =
  "inline-flex h-7 items-center gap-1 rounded-full bg-white/92 px-2.5 text-xs font-semibold text-[#0F172A] shadow-xs backdrop-blur-sm";

/** Round icon button on a photo (back / share / save). Needs aria-label. */
export const onPhotoIconButtonClasses = cn(
  "grid size-10 place-items-center rounded-full bg-white/92 text-[#0F172A] shadow-xs backdrop-blur-sm hover:bg-white [&_svg]:size-5",
  focusRing,
  pressable,
);

/** Bottom scrim for text over a photo (lower 60%). */
export const photoScrimClasses =
  "pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[rgb(11_21_20/0.72)] via-[rgb(11_21_20/0.24)] to-transparent";

// ── Links in body copy (§5.18) ──────────────────────────────────────────────

export const textLinkClasses =
  "font-medium text-brand-text underline decoration-brand/30 underline-offset-4 hover:decoration-brand";

// ── Layout containers (§2.5) ────────────────────────────────────────────────

export const containerClasses = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";
export const readingContainerClasses = "mx-auto w-full max-w-3xl px-4 sm:px-6";
/** Horizontal rail: snap scroller that bleeds to the screen edge on phones. */
export const railClasses =
  "no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0";
export const railItemClasses = "w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[calc(25%-12px)]";
