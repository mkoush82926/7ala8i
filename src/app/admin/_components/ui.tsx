import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ADMIN_COPY, adminErrorMessage } from "@/lib/admin/dictionary";
import { buildHref, pageBounds, pageCount } from "@/lib/admin/params";
import type { AdminErrorCode } from "@/lib/admin/rpc";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/recipes";

/** Server-safe presentational pieces shared by the back-office pages. */

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-full text-sm font-semibold text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <ArrowLeft size={16} aria-hidden className="rtl:rotate-180" />
            {back.label}
          </Link>
        )}
        <h1 className="text-h2 text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[15px] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={cn(
        "rounded-xl border border-line bg-card p-4 lg:p-5",
        className,
      )}
    >
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-h3 text-ink">
                {title}
              </h2>
            )}
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
  const body = (
    <>
      <span className="block text-sm font-medium text-ink-muted">{label}</span>
      <span className="text-stat mt-2 block text-ink">{value}</span>
    </>
  );
  const cls =
    "block rounded-xl border border-line bg-card p-4 lg:p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
  return href ? (
    <Link href={href} className={cn(cls, "transition-shadow duration-200 hover:shadow-card")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Link-based segmented filter (state lives in the URL). */
export function FilterTabs<T extends string>({
  label,
  options,
  value,
  hrefFor,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  hrefFor: (value: T) => string;
}) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
      <ul className="flex w-max gap-1 rounded-full bg-sunken p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <li key={o.value}>
              <Link
                href={hrefFor(o.value)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  active
                    ? "bg-card text-ink shadow-xs"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {o.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Pagination({
  path,
  params,
  page,
  size,
  total,
}: {
  path: string;
  params: Record<string, string | number | null | undefined>;
  page: number;
  size: number;
  total: number;
}) {
  const bounds = pageBounds(page, size, total);
  const pages = pageCount(total, size);
  if (!bounds || pages <= 1) return null;
  const c = ADMIN_COPY.common;
  const linkCls = buttonClasses({ variant: "secondary", size: "sm" });
  const disabledCls = "pointer-events-none opacity-45";
  return (
    <nav aria-label={c.pageOf(bounds.from, bounds.to, total)} className="mt-4 flex items-center justify-between gap-3">
      <p className="text-[13px] tabular-nums text-ink-soft">{c.pageOf(bounds.from, bounds.to, total)}</p>
      <div className="flex gap-2">
        <Link
          href={buildHref(path, { ...params, page: page - 1 })}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={cn(linkCls, page <= 1 && disabledCls)}
        >
          {c.previous}
        </Link>
        <Link
          href={buildHref(path, { ...params, page: page + 1 })}
          aria-disabled={page >= pages}
          tabIndex={page >= pages ? -1 : undefined}
          className={cn(linkCls, page >= pages && disabledCls)}
        >
          {c.next}
        </Link>
      </div>
    </nav>
  );
}

/** Error state for a failed RPC read, with a retry link back to the same URL. */
export function ErrorPanel({ code, retryHref }: { code: AdminErrorCode; retryHref: string }) {
  return (
    <EmptyState
      tone="error"
      icon={AlertTriangle}
      title={ADMIN_COPY.common.errorTitle}
      description={adminErrorMessage(code)}
      action={{ label: ADMIN_COPY.common.retry, href: retryHref }}
      headingLevel={2}
    />
  );
}

/** Definition list row used on detail pages. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-ink-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}
