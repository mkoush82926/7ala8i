import React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses, focusRing, pressable } from "./recipes";

/**
 * Marketplace search bar shell (§5.3) — presentation only. The owner of
 * search keeps state, URL params (q, area, when, sort, f[]) and popovers;
 * these pieces only provide the v2 look.
 *
 * Desktop (md+): one big pill with segments + submit
 *   <SearchBarShell ariaLabel={t.search.label} onSubmit={submit} className="hidden md:flex">
 *     <SearchSegment icon={<Scissors />} label={t.search.what} value={serviceText} onClick={openWhat} aria-expanded={whatOpen} />
 *     <SearchDivider />
 *     <SearchSegment icon={<MapPin />} label={t.search.where} value={areaText} onClick={openWhere} />
 *     <SearchDivider />
 *     <SearchSegment icon={<Clock />} label={t.search.when} value={whenText} onClick={openWhen} />
 *     <SearchSubmit label={t.search.submit} />
 *   </SearchBarShell>
 *
 * Mobile (base): a single tappable pill that opens the full-screen sheet
 *   <SearchPill className="md:hidden" ariaLabel={t.search.open} summary={[service, area, when]} onClick={openSheet} />
 *
 * Results pages: <SearchPill compact … /> inside the sticky nav.
 * Segment popovers: <SearchPopover> + <SearchOption>.
 */
export interface SearchBarShellProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "role"> {
  /** Accessible name of the search landmark. */
  ariaLabel: string;
  children: React.ReactNode;
}

export function SearchBarShell({ ariaLabel, children, className, ...rest }: SearchBarShellProps) {
  return (
    <form
      role="search"
      aria-label={ariaLabel}
      className={cn(
        "relative mx-auto flex w-full max-w-4xl items-stretch rounded-full border border-line bg-card p-1.5 shadow-search",
        className,
      )}
      {...rest}
    >
      {children}
    </form>
  );
}

export interface SearchSegmentProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  icon?: React.ReactNode;
  /** Small bold label (What / Where / When). */
  label: React.ReactNode;
  /** Current value or placeholder text (All services / Amman / Any time). */
  value?: React.ReactNode;
  /**
   * Render as a <div> wrapper instead of a button — use when the segment
   * hosts its own <input> (pass it as children, under the label).
   */
  asContainer?: boolean;
}

const segmentClasses = cn(
  "flex min-w-0 flex-1 items-center gap-3 rounded-full px-5 py-2.5 text-start hover:bg-sunken focus-within:bg-sunken",
  "transition-colors duration-150 ease-standard motion-reduce:transition-none",
);

export function SearchSegment({ icon, label, value, asContainer = false, className, children, type = "button", ...rest }: SearchSegmentProps) {
  const body = (
    <>
      {icon ? (
        <span aria-hidden="true" className="shrink-0 text-ink-muted [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-ink">{label}</span>
        {children ?? (value != null && <span className="block truncate text-sm text-ink-muted">{value}</span>)}
      </span>
    </>
  );
  if (asContainer) {
    return <div className={cn(segmentClasses, className)}>{body}</div>;
  }
  return (
    <button type={type} className={cn(segmentClasses, "cursor-pointer", focusRing, className)} {...rest}>
      {body}
    </button>
  );
}

/** Hairline between segments. */
export function SearchDivider({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("h-8 w-px shrink-0 self-center bg-line", className)} />;
}

export interface SearchSubmitProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visible from lg; the accessible name below lg (icon-only). */
  label: string;
  icon?: React.ReactNode;
}

export function SearchSubmit({ label, icon, className, type = "submit", ...rest }: SearchSubmitProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={buttonClasses({
        variant: "primary",
        size: "lg",
        className: cn("size-14 shrink-0 px-0 lg:w-auto lg:px-7", className),
      })}
      {...rest}
    >
      <span aria-hidden="true" className="inline-flex">
        {icon ?? <Search />}
      </span>
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

export interface SearchPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible prefix (e.g. "Search barbers"); the summary follows it. */
  ariaLabel: string;
  /** Summary facts, joined with the house middle dot (empties dropped). */
  summary: ReadonlyArray<React.ReactNode>;
  /** Compact h-11 pill for the sticky results nav. */
  compact?: boolean;
  icon?: React.ReactNode;
}

/** Mobile / compact trigger: one pill that opens the full search sheet. */
export function SearchPill({ ariaLabel, summary, compact = false, icon, className, type = "button", ...rest }: SearchPillProps) {
  const items = summary.filter((s) => s !== null && s !== undefined && s !== false && s !== "");
  return (
    <button
      type={type}
      className={cn(
        "flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-full border border-line bg-card text-start",
        compact ? "h-11 px-4 shadow-xs" : "h-14 px-5 shadow-search",
        focusRing,
        pressable,
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="shrink-0 text-ink [&_svg]:size-5">
        {icon ?? <Search />}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-x-1.5 truncate text-sm text-ink-muted">
        <span className="sr-only">{ariaLabel}: </span>
        {items.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <>
                <span aria-hidden="true" className="text-ink-disabled">
                  ·
                </span>
                <span className="sr-only">, </span>
              </>
            )}
            <bdi className={cn("truncate", i === 0 && "font-semibold text-ink")}>{item}</bdi>
          </React.Fragment>
        ))}
      </span>
    </button>
  );
}

export interface SearchPopoverProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Horizontal anchor under the segment. */
  align?: "start" | "center" | "end";
}

/** Dropdown panel under a segment (caller controls open state + dismissal). */
export function SearchPopover({ align = "start", className, ...rest }: SearchPopoverProps) {
  return (
    <div
      className={cn(
        "absolute top-full z-50 mt-3 w-[min(420px,90vw)] rounded-2xl border border-line bg-card p-2 shadow-float",
        align === "start" && "start-0",
        align === "end" && "end-0",
        align === "center" && "start-1/2 -translate-x-1/2 rtl:translate-x-1/2",
        className,
      )}
      {...rest}
    />
  );
}

export interface SearchOptionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: React.ReactNode;
  /** Secondary line. */
  description?: React.ReactNode;
}

/** Option row inside a SearchPopover (role="option" — wrap rows in role="listbox"). */
export function SearchOption({ selected = false, icon, description, className, children, type = "button", ...rest }: SearchOptionProps) {
  return (
    <button
      type={type}
      role="option"
      aria-selected={selected}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm text-ink hover:bg-sunken aria-selected:bg-brand-soft aria-selected:font-semibold",
        focusRing,
        className,
      )}
      {...rest}
    >
      {icon ? (
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-ink-soft [&_svg]:size-4">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{children}</span>
        {description && <span className="block truncate text-[13px] font-normal text-ink-muted">{description}</span>}
      </span>
    </button>
  );
}

export default SearchBarShell;
