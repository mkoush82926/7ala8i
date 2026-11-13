"use client";

import React, { Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ChevronLeft, ChevronRight, Loader2, Mail, MessageCircle, Pencil, Phone,
  Search, Trash2, UserPlus, Users, X, CalendarPlus, AlertCircle,
} from "lucide-react";
import { useTranslation, headingTracking, interpolate } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabase } from "@/hooks/use-supabase";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useClients, ClientMutationError, type ClientMutationErrorCode } from "@/hooks/use-clients";
import {
  PAGE_SIZE,
  getClientAppointments,
  getClientById,
  summarizeVisits,
  type ClientAppointmentRow,
  type ClientInput,
  type ClientRow,
} from "@/lib/queries/clients";
import { normalizeAppointmentStatus, BOOKING_SOURCES, type BookingSource } from "@/lib/types";
import { getInitials, cn } from "@/lib/utils";
import { Drawer, Dialog, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";

// Keystrokes shouldn't each fire a new request — wait for a short pause.
const SEARCH_DEBOUNCE_MS = 300;

const AVATAR_TONES = [
  "bg-[var(--bg-secondary)] text-[var(--text-primary)]",
  "bg-[var(--border-subtle)] text-[var(--text-primary)]",
  "bg-[var(--text-primary)] text-[var(--bg-primary)]",
] as const;

const PHONE_DIGITS_MIN = 7;
const PHONE_DIGITS_MAX = 15;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type T = ReturnType<typeof useTranslation>["t"];

/** t.error.codes[code] ?? fallback — tolerant of the codes map not being present. */
function codeMessage(t: T, code: string | undefined, fallback: string): string {
  const codes = (t.error as unknown as { codes?: Record<string, string> }).codes;
  return (code && codes?.[code]) || fallback;
}

function mutationMessage(t: T, err: unknown, fallback: string): string {
  const code: ClientMutationErrorCode | undefined =
    err instanceof ClientMutationError ? err.code : undefined;
  if (code === "DUPLICATE") return t.clients.duplicatePhone;
  if (code === "FORBIDDEN") return codeMessage(t, "FORBIDDEN", fallback);
  if (code === "NO_SHOP") return codeMessage(t, "NO_SHOP", fallback);
  if (code === "NOT_FOUND") return codeMessage(t, "NOT_FOUND", fallback);
  return fallback;
}

function sourceLabel(t: T, source: string | null | undefined): string | null {
  if (!source) return null;
  const labels = t.clients.sourceOptions as Record<string, string>;
  return labels[source] ?? source;
}

export default function ClientsPage() {
  // ClientsView reads ?id= via useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <ClientsView />
    </Suspense>
  );
}

function ClientsView() {
  const { t, isRTL, FF, formatCurrency, href } = useTranslation();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const currency = useWorkspaceStore((s) => s.currency);
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const router = useRouter();
  const pathname = usePathname();

  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ClientRow | null>(null);
  const [formNonce, setFormNonce] = useState(0);
  const [formState, setFormStateRaw] = useState<{ mode: "create" } | { mode: "edit"; client: ClientRow } | null>(null);
  const [deleting, setDeleting] = useState<ClientRow | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const supabase = useSupabase();

  // Deep link from the topbar search / notifications: /clients?id=<clientId>
  // opens that drawer. The param is stripped once consumed so choosing the
  // same result again changes the URL and re-opens the drawer.
  const linkedClientId = useSearchParams().get("id");
  useEffect(() => {
    if (!linkedClientId || !shopId) return;
    let cancelled = false;
    (async () => {
      let found: ClientRow | null = null;
      try {
        const { data } = await getClientById(supabase, linkedClientId);
        found = (data as ClientRow | null) ?? null;
      } catch {
        found = null;
      }
      if (cancelled) return;
      if (found) setSelected(found);
      else toast.error(t.common.linkNotFound);
      router.replace(pathname, { scroll: false });
    })();
    return () => {
      cancelled = true;
    };
    // t/router/pathname are stable for a given link; re-run only on a new link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedClientId, shopId, supabase]);

  const setFormState = (next: typeof formState) => {
    if (next) setFormNonce((n) => n + 1);
    setFormStateRaw(next);
  };

  // Debounce the search input so every keystroke doesn't trigger a new query.
  useEffect(() => {
    if (inputValue === searchTerm) return;
    const handle = setTimeout(() => {
      setSearchTerm(inputValue);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [inputValue, searchTerm]);

  const {
    clients, totalCount, initialLoading, refreshing, error, refetch,
    addClient, updateClient, deleteClient, restoreClient,
  } = useClients({ page, search: searchTerm });

  // Prefer the freshest copy from the list (e.g. after an edit), but keep the
  // row we opened while the list refetches or pages away.
  const drawerClient = useMemo(
    () => (selected ? clients.find((c) => c.id === selected.id) ?? selected : null),
    [clients, selected],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeFrom = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo = (page - 1) * PAGE_SIZE + clients.length;
  const isSearching = searchTerm.trim().length > 0;

  const clearSearch = () => {
    setInputValue("");
    setSearchTerm("");
    setPage(1);
    searchRef.current?.focus();
  };

  const handleSave = async (input: ClientInput) => {
    if (formState?.mode === "edit") {
      await updateClient(formState.client.id, input);
      toast.success(t.clients.updated);
    } else {
      const created = await addClient(input);
      toast.success(t.clients.created);
      // Show the new client at the top of an unfiltered first page.
      if (isSearching || page !== 1) {
        setInputValue("");
        setSearchTerm("");
        setPage(1);
      }
      setSelected(created);
    }
    setFormState(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const client = deleting;
    try {
      await deleteClient(client.id);
    } catch (err) {
      throw new Error(mutationMessage(t, err, t.clients.deleteFailed));
    }
    setSelected(null);
    if (clients.length === 1 && page > 1) setPage((p) => p - 1);
    toast.success(interpolate(t.clients.deleted, { name: client.name }), {
      action: {
        label: t.common.undo,
        onClick: () => {
          restoreClient(client.id)
            .then(() => toast.success(t.clients.restored))
            .catch((err) => toast.error(mutationMessage(t, err, t.clients.saveFailed)));
        },
      },
    });
  };

  // ── First load: keep the real header, skeleton only the list ──
  const showListSkeleton = !hydrated || (!!shopId && initialLoading);

  return (
    <div className="flex flex-col gap-6 sm:gap-8 fade-slide-up">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2
            className="m-0 text-[24px] sm:text-[28px] font-extrabold text-[var(--text-primary)]"
            style={{ fontFamily: FF, letterSpacing: headingTracking(isRTL, "0.014em") }}
          >
            {t.sidebar.clients}
          </h2>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]" aria-live="polite">
            {showListSkeleton ? " " : interpolate(t.clients.subtitle, { count: totalCount })}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
          {/* Search — stays mounted across refetches so focus/caret never drop */}
          <div className="relative w-full sm:w-[300px]" role="search">
            <Search size={18} className="field-icon" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              inputMode="search"
              autoComplete="off"
              enterKeyHint="search"
              aria-label={t.clients.searchLabel}
              placeholder={t.clients.searchPlaceholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && inputValue) {
                  e.preventDefault();
                  clearSearch();
                }
              }}
              className="field-input has-icon has-action !min-h-[44px] [&::-webkit-search-cancel-button]:hidden"
            />
            {inputValue ? (
              <button
                type="button"
                onClick={clearSearch}
                className="field-action focus-ring"
                aria-label={t.clients.clearSearch}
              >
                {refreshing ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                  <X size={16} aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>

          <button
            type="button"
            className="btn btn-primary shrink-0"
            onClick={() => setFormState({ mode: "create" })}
            disabled={!shopId}
          >
            <UserPlus size={16} aria-hidden="true" />
            {t.clients.newClient}
          </button>
        </div>
      </div>

      {/* ── List ── */}
      {showListSkeleton ? (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
          <TableRowsSkeleton rows={8} columns={4} />
        </div>
      ) : !shopId ? (
        <EmptyState
          icon={Users}
          title={t.clients.emptyTitle}
          description={t.clients.emptyDescription}
        />
      ) : error && clients.length === 0 ? (
        <EmptyState
          tone="error"
          icon={AlertCircle}
          title={t.clients.loadErrorTitle}
          description={t.clients.loadErrorDescription}
          action={{ label: t.common.retry, onClick: refetch }}
        />
      ) : clients.length === 0 && !refreshing ? (
        isSearching ? (
          <EmptyState
            icon={Search}
            title={interpolate(t.clients.noMatchesTitle, { term: searchTerm.trim() })}
            description={t.clients.noMatchesDescription}
            action={{ label: t.clients.clearSearch, onClick: clearSearch }}
          />
        ) : (
          <EmptyState
            icon={Users}
            title={t.clients.emptyTitle}
            description={t.clients.emptyDescription}
            action={{ label: t.clients.newClient, icon: UserPlus, onClick: () => setFormState({ mode: "create" }) }}
          />
        )
      ) : (
        <div
          aria-busy={refreshing || undefined}
          className={cn(
            "overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] transition-opacity",
            refreshing && "opacity-60",
          )}
        >
          <ul className="divide-y divide-[var(--border-subtle)]" aria-label={t.sidebar.clients}>
            {clients.map((client, i) => (
              <ClientListItem
                key={client.id}
                client={client}
                tone={AVATAR_TONES[i % AVATAR_TONES.length]}
                onOpen={() => setSelected(client)}
                spentLabel={t.clients.totalSpent}
                spent={formatCurrency(Number(client.total_spend) || 0, currency, { trimZeros: true })}
                callLabel={interpolate(t.clients.call, { name: client.name })}
                openLabel={interpolate(t.clients.openProfile, { name: client.name })}
                emailLabel={t.clients.emailOnFile}
                noContact={t.clients.noContact}
              />
            ))}
          </ul>
          {error && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--accent-rose)]">
              <span>{t.clients.loadErrorTitle}</span>
              <button type="button" className="btn btn-ghost !min-h-[36px] !px-3 !text-sm" onClick={refetch}>
                {t.common.retry}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Pagination ── */}
      {!showListSkeleton && totalCount > PAGE_SIZE && (
        <nav
          className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between"
          aria-label={t.clients.pagination}
        >
          <p className="text-sm font-medium text-[var(--text-secondary)]" aria-live="polite">
            {interpolate(t.clients.pageRange, { from: rangeFrom, to: rangeTo, total: totalCount })}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || refreshing}
              aria-label={t.clients.previousPage}
              className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-buttons)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft size={18} aria-hidden="true" className="rtl:-scale-x-100" />
            </button>
            <span className="min-w-[96px] px-2 text-center text-sm font-semibold text-[var(--text-primary)]" aria-current="page">
              {interpolate(t.clients.pageOf, { page, pages: totalPages })}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || refreshing}
              aria-label={t.clients.nextPage}
              className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-buttons)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight size={18} aria-hidden="true" className="rtl:-scale-x-100" />
            </button>
          </div>
        </nav>
      )}

      {/* ── Client profile drawer ── */}
      <ClientDrawer
        client={drawerClient}
        open={!!drawerClient}
        onClose={() => setSelected(null)}
        onEdit={(c) => setFormState({ mode: "edit", client: c })}
        onDelete={(c) => setDeleting(c)}
        onBook={(c) => {
          // Opens the calendar's new-booking form prefilled with this client.
          router.push(href(`/calendar?new=1&client=${encodeURIComponent(c.id)}`));
        }}
      />

      {/* ── Create / edit ── */}
      <ClientFormDialog
        key={formNonce}
        open={!!formState}
        initial={formState?.mode === "edit" ? formState.client : null}
        onClose={() => setFormState(null)}
        onSubmit={handleSave}
      />

      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={interpolate(t.clients.deleteTitle, { name: deleting?.name ?? "" })}
        description={t.clients.deleteDescription}
        confirmLabel={t.clients.deleteClient}
        destructive
      />
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function ClientListItem({
  client, tone, onOpen, spent, spentLabel, callLabel, openLabel, emailLabel, noContact,
}: {
  client: ClientRow;
  tone: string;
  onOpen: () => void;
  spent: string;
  spentLabel: string;
  callLabel: string;
  openLabel: string;
  emailLabel: string;
  noContact: string;
}) {
  const contact = client.phone || client.email || noContact;
  return (
    <li className="group flex items-center gap-2 pe-3 transition-colors hover:bg-[var(--bg-secondary)] focus-within:bg-[var(--bg-secondary)] sm:pe-5">
      <button
        type="button"
        onClick={onOpen}
        aria-label={openLabel}
        className="focus-ring-inset flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-3.5 ps-4 text-start sm:gap-4 sm:ps-6"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            tone,
          )}
        >
          {getInitials(client.name) || "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold leading-snug text-[var(--text-primary)]">
            {client.name}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
            <span className="truncate" dir={client.phone ? "ltr" : undefined}>{contact}</span>
            {client.email && client.phone && (
              <Mail size={12} className="shrink-0 text-[var(--accent-brass)]" aria-label={emailLabel} role="img" />
            )}
          </span>
          {/* Spend on phones sits under the contact line */}
          <span className="mt-0.5 block text-[12px] text-[var(--text-muted)] sm:hidden">
            {spentLabel}: <span className="font-semibold text-[var(--text-secondary)]">{spent}</span>
          </span>
        </span>
        <span className="hidden shrink-0 text-end sm:block">
          <span className="block text-[11px] font-semibold text-[var(--text-muted)]">{spentLabel}</span>
          <span className="text-sm font-extrabold text-[var(--text-primary)]">{spent}</span>
        </span>
      </button>

      {client.phone && (
        <a
          href={`tel:${client.phone.replace(/[^\d+]/g, "")}`}
          aria-label={callLabel}
          title={callLabel}
          className="focus-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] transition-opacity hover:text-[var(--text-primary)] lg:h-9 lg:w-9 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
        >
          <Phone size={15} aria-hidden="true" />
        </a>
      )}
    </li>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function ClientDrawer({
  client, open, onClose, onEdit, onDelete, onBook,
}: {
  client: ClientRow | null;
  open: boolean;
  onClose: () => void;
  onEdit: (c: ClientRow) => void;
  onDelete: (c: ClientRow) => void;
  onBook: (client: ClientRow) => void;
}) {
  const { t, formatCurrency, formatDate, formatTime } = useTranslation();
  const currency = useWorkspaceStore((s) => s.currency);
  const supabase = useSupabase();
  const clientId = client?.id ?? null;

  const history = useSupabaseQuery<ClientAppointmentRow[]>(
    async () => {
      const res = await getClientAppointments(supabase, clientId as string, 10);
      return { data: (res.data ?? []) as ClientAppointmentRow[], error: res.error };
    },
    [supabase, clientId],
    { enabled: open && !!clientId, retryCount: 0 },
  );

  const rows = clientId ? history.data ?? [] : [];
  const { visits, lastVisit } = summarizeVisits(rows);

  const statusLabel = (status: string) => {
    switch (normalizeAppointmentStatus(status)) {
      case "pending": return t.calendar.pending;
      case "confirmed": return t.calendar.confirmed;
      case "completed": return t.calendar.completed;
      case "no_show": return t.calendar.noShow;
      case "cancelled": return t.customer.cancelled;
      default: return status;
    }
  };

  const whatsappDigits = (client?.phone ?? "").replace(/\D/g, "");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t.clients.profile}
      size="md"
      footer={
        client ? (
          <DialogFooter>
            <button type="button" className="btn btn-ghost text-[var(--accent-rose)]" onClick={() => onDelete(client)}>
              <Trash2 size={16} aria-hidden="true" />
              {t.clients.deleteClient}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => onEdit(client)}>
              <Pencil size={16} aria-hidden="true" />
              {t.clients.editClient}
            </button>
          </DialogFooter>
        ) : null
      }
    >
      {client && (
        <div className="flex flex-col gap-6">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-lg font-bold text-[var(--bg-primary)]"
            >
              {getInitials(client.name) || "?"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold text-[var(--text-primary)]">{client.name}</p>
              {client.created_at && (
                <p className="text-[13px] text-[var(--text-muted)]">
                  {interpolate(t.clients.addedOn, { date: formatDate(client.created_at, "medium") })}
                </p>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2">
            <a
              className={cn("btn btn-primary", !whatsappDigits && "pointer-events-none opacity-50")}
              href={whatsappDigits ? `https://wa.me/${whatsappDigits}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!whatsappDigits || undefined}
            >
              <MessageCircle size={16} aria-hidden="true" />
              {t.clients.whatsapp}
            </a>
            <button type="button" className="btn btn-secondary" onClick={() => onBook(client)}>
              <CalendarPlus size={16} aria-hidden="true" />
              {t.clients.newBooking}
            </button>
          </div>

          {/* Stats */}
          <dl className="grid grid-cols-3 gap-2">
            {[
              { label: t.clients.totalSpent, value: formatCurrency(Number(client.total_spend) || 0, currency, { trimZeros: true }) },
              { label: t.clients.visits, value: history.initialLoading ? null : String(visits) },
              { label: t.clients.lastVisit, value: history.initialLoading ? null : lastVisit ? formatDate(lastVisit, "dayMonth") : "—" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[var(--radius-md,10px)] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
                <dt className="text-[11px] font-semibold text-[var(--text-muted)]">{stat.label}</dt>
                <dd className="mt-1 truncate text-[15px] font-bold text-[var(--text-primary)]">
                  {stat.value ?? <Skeleton className="h-4 w-10" />}
                </dd>
              </div>
            ))}
          </dl>

          {/* Contact */}
          <dl className="flex flex-col gap-3">
            <ContactField icon={Phone} label={t.clients.phone}>
              {client.phone ? (
                <a href={`tel:${client.phone.replace(/[^\d+]/g, "")}`} dir="ltr" className="text-[var(--text-primary)] underline-offset-2 hover:underline">
                  {client.phone}
                </a>
              ) : "—"}
            </ContactField>
            <ContactField icon={Mail} label={t.clients.email}>
              {client.email ? (
                <a href={`mailto:${client.email}`} dir="ltr" className="break-all text-[var(--text-primary)] underline-offset-2 hover:underline">
                  {client.email}
                </a>
              ) : "—"}
            </ContactField>
            {client.source && (
              <ContactField icon={Users} label={t.clients.source}>
                {sourceLabel(t, client.source)}
              </ContactField>
            )}
          </dl>

          {client.notes && (
            <section>
              <h3 className="field-label">{t.clients.notes}</h3>
              <p className="whitespace-pre-wrap rounded-[var(--radius-inputs)] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 text-sm text-[var(--text-secondary)]">
                {client.notes}
              </p>
            </section>
          )}

          {/* History */}
          <section aria-busy={history.loading || undefined}>
            <h3 className="field-label">{t.clients.recentVisits}</h3>
            {history.initialLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : history.error ? (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-[var(--radius-inputs)] border border-[var(--border-subtle)] p-3 text-sm text-[var(--accent-rose)]">
                <span>{t.clients.historyError}</span>
                <button type="button" className="btn btn-ghost !min-h-[36px] !px-3 !text-sm" onClick={history.refetch}>
                  {t.common.retry}
                </button>
              </div>
            ) : rows.length === 0 ? (
              <p className="rounded-[var(--radius-inputs)] border border-dashed border-[var(--border-subtle)] p-4 text-center text-sm text-[var(--text-muted)]">
                {t.clients.noHistory}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-inputs)] border border-[var(--border-subtle)]">
                {rows.map((apt) => (
                  <li key={apt.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {apt.service_name || "—"}
                      </p>
                      <p className="text-[12px] text-[var(--text-muted)]">
                        {formatDate(apt.start_time, "dayMonth")} · {formatTime(apt.start_time)}
                      </p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        {formatCurrency(Number(apt.price) || 0, apt.currency || currency, { trimZeros: true })}
                      </p>
                      <p className="text-[12px] text-[var(--text-secondary)]">{statusLabel(apt.status)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}

function ContactField({
  icon: Icon, label, children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[12px] font-semibold text-[var(--text-muted)]">{label}</dt>
        <dd className="text-sm font-medium text-[var(--text-primary)]">{children}</dd>
      </div>
    </div>
  );
}

// ─── Create / edit form ───────────────────────────────────────────────────────

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
}

function ClientFormDialog({
  open, initial, onClose, onSubmit,
}: {
  open: boolean;
  initial: ClientRow | null;
  onClose: () => void;
  onSubmit: (input: ClientInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const ids = {
    name: useId(), phone: useId(), email: useId(), source: useId(), notes: useId(),
    nameErr: useId(), phoneErr: useId(), emailErr: useId(), formErr: useId(),
  };
  const [values, setValues] = useState({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    source: (initial?.source ?? "") as BookingSource | "",
    notes: initial?.notes ?? "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof typeof values) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (key in errors) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const name = values.name.trim();
    if (!name) next.name = t.clients.nameRequired;
    else if (name.length > 100) next.name = t.clients.nameTooLong;
    const digits = values.phone.replace(/\D/g, "");
    if (!values.phone.trim()) next.phone = t.clients.phoneRequired;
    else if (digits.length < PHONE_DIGITS_MIN || digits.length > PHONE_DIGITS_MAX || /[^\d\s()+-]/.test(values.phone))
      next.phone = t.clients.phoneInvalid;
    const email = values.email.trim();
    if (email && (!EMAIL_RE.test(email) || email.length > 254)) next.email = t.clients.emailInvalid;
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (found.name) return nameRef.current?.focus();
    if (found.phone) return phoneRef.current?.focus();
    if (found.email) return emailRef.current?.focus();

    setSaving(true);
    try {
      await onSubmit({
        name: values.name,
        phone: values.phone,
        email: values.email,
        notes: values.notes.slice(0, 1000),
        source: values.source || null,
      });
    } catch (err) {
      const msg = mutationMessage(t, err, t.clients.saveFailed);
      if (err instanceof ClientMutationError && err.code === "DUPLICATE") {
        setErrors((er) => ({ ...er, phone: msg }));
        phoneRef.current?.focus();
      } else {
        setFormError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!initial;

  return (
    <Dialog
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      title={isEdit ? t.clients.editClient : t.clients.newClient}
      initialFocusRef={nameRef}
      size="md"
      footer={
        <DialogFooter>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            {t.common.cancel}
          </button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={saving} aria-busy={saving || undefined}>
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {saving ? t.common.processing : isEdit ? t.common.save : t.clients.addClient}
          </button>
        </DialogFooter>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4" aria-describedby={formError ? ids.formErr : undefined}>
        {formError && (
          <p id={ids.formErr} role="alert" className="rounded-[var(--radius-inputs)] bg-[var(--accent-rose-muted)] px-3 py-2 text-sm text-[var(--accent-rose)]">
            {formError}
          </p>
        )}

        <div>
          <label htmlFor={ids.name} className="field-label">{t.clients.name}</label>
          <input
            ref={nameRef}
            id={ids.name}
            className="field-input"
            value={values.name}
            onChange={set("name")}
            autoComplete="off"
            maxLength={100}
            required
            aria-invalid={!!errors.name || undefined}
            aria-describedby={errors.name ? ids.nameErr : undefined}
          />
          {errors.name && <p id={ids.nameErr} className="field-error">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={ids.phone} className="field-label">{t.clients.phone}</label>
            <input
              ref={phoneRef}
              id={ids.phone}
              type="tel"
              inputMode="tel"
              dir="ltr"
              className="field-input text-start"
              value={values.phone}
              onChange={set("phone")}
              autoComplete="off"
              maxLength={24}
              required
              placeholder={t.clients.phonePlaceholder}
              aria-invalid={!!errors.phone || undefined}
              aria-describedby={errors.phone ? ids.phoneErr : undefined}
            />
            {errors.phone && <p id={ids.phoneErr} className="field-error">{errors.phone}</p>}
          </div>
          <div>
            <label htmlFor={ids.email} className="field-label">
              {t.clients.email} <span className="text-[var(--text-muted)]">({t.common.optional})</span>
            </label>
            <input
              ref={emailRef}
              id={ids.email}
              type="email"
              inputMode="email"
              dir="ltr"
              className="field-input text-start"
              value={values.email}
              onChange={set("email")}
              autoComplete="off"
              maxLength={254}
              aria-invalid={!!errors.email || undefined}
              aria-describedby={errors.email ? ids.emailErr : undefined}
            />
            {errors.email && <p id={ids.emailErr} className="field-error">{errors.email}</p>}
          </div>
        </div>

        <div>
          <label htmlFor={ids.source} className="field-label">
            {t.clients.source} <span className="text-[var(--text-muted)]">({t.common.optional})</span>
          </label>
          <select id={ids.source} className="field-input" value={values.source} onChange={set("source")}>
            <option value="">—</option>
            {BOOKING_SOURCES.map((s) => (
              <option key={s} value={s}>{sourceLabel(t, s)}</option>
            ))}
            {values.source && !(BOOKING_SOURCES as readonly string[]).includes(values.source) && (
              <option value={values.source}>{values.source}</option>
            )}
          </select>
        </div>

        <div>
          <label htmlFor={ids.notes} className="field-label">
            {t.clients.notes} <span className="text-[var(--text-muted)]">({t.common.optional})</span>
          </label>
          <textarea
            id={ids.notes}
            className="field-input min-h-[96px] resize-y"
            value={values.notes}
            onChange={set("notes")}
            maxLength={1000}
            rows={3}
            placeholder={t.clients.notesPlaceholder}
          />
        </div>
      </form>
    </Dialog>
  );
}
