"use client";

import React, { useCallback, useId, useMemo, useRef, useState } from "react";
import {
  UserPlus, Search, Settings2, Phone, ShieldCheck, Scissors, X, Copy, Check,
  UserMinus, MessageCircle, Share2, Link2, Loader2, AlertCircle, Users, Clock,
} from "lucide-react";
import { useTranslation, headingTracking, interpolate } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabase } from "@/hooks/use-supabase";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { normalizeSearchTerm } from "@/lib/queries/search";
import { STAFF_ROLES, type StaffRole } from "@/lib/types";
import { cn, getInitials } from "@/lib/utils";
import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";

interface TeamMember {
  id: string;
  full_name: string | null;
  role: StaffRole;
  phone: string | null;
  avatar_url: string | null;
  created_at: string | null;
  barber_services?: { service_id: string }[] | null;
}

interface ServiceOption {
  id: string;
  name: string;
  name_ar: string | null;
}

type T = ReturnType<typeof useTranslation>["t"];

const AVATAR_TONES = [
  "bg-[var(--bg-secondary)] text-[var(--text-primary)]",
  "bg-[var(--border-subtle)] text-[var(--text-primary)]",
  "bg-[var(--text-primary)] text-[var(--bg-primary)]",
] as const;

/** t.error.codes[code] ?? fallback — tolerant of the codes map not being present. */
function codeMessage(t: T, code: string | undefined | null, fallback: string): string {
  const codes = (t.error as unknown as { codes?: Record<string, string> }).codes;
  return (code && codes?.[code]) || fallback;
}

/**
 * Map a Supabase/PostgREST error to user-facing text. DB functions/triggers
 * raise P0001 with the code as the message (e.g. "LAST_ADMIN"); RLS denials
 * come back as 42501.
 */
function dbErrorMessage(t: T, err: unknown, fallback: string): string {
  const e = (err ?? {}) as { code?: string; message?: string };
  if (e.message && /^[A-Z][A-Z_]+$/.test(e.message)) return codeMessage(t, e.message, fallback);
  if (e.code === "42501") return codeMessage(t, "FORBIDDEN", fallback);
  return fallback;
}

function roleLabel(t: T, role: string | null | undefined) {
  return role === "shop_admin" ? t.team.roleAdmin : t.team.roleBarber;
}

export default function TeamPage() {
  const { t, isRTL, FF, formatDate } = useTranslation();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const currentUserId = useWorkspaceStore((s) => s.userId);
  const currentUserRole = useWorkspaceStore((s) => s.role);
  const refreshWorkspace = useWorkspaceStore((s) => s.refreshWorkspace);
  const supabase = useSupabase();
  const isAdmin = currentUserRole === "shop_admin";

  const [searchTerm, setSearchTerm] = useState("");
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [unassignUpcoming, setUnassignUpcoming] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteNonce, setInviteNonce] = useState(0);

  const team = useSupabaseQuery<TeamMember[]>(
    async () => {
      // profiles.phone is a private column: staff read their shop's phones via RPC.
      const [res, phonesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, role, avatar_url, created_at, barber_services(service_id)")
          .eq("shop_id", shopId)
          .in("role", [...STAFF_ROLES])
          .order("created_at", { ascending: true }),
        supabase.rpc("get_profile_phones"),
      ]);
      const phones = new Map(
        ((phonesRes.data ?? []) as { id: string; phone: string | null }[]).map((p) => [p.id, p.phone]),
      );
      const members = ((res.data ?? []) as unknown as Omit<TeamMember, "phone">[]).map(
        (m) => ({ ...m, phone: phones.get(m.id) ?? null }) as TeamMember,
      );
      return { data: members, error: res.error };
    },
    [supabase, shopId],
    { enabled: !!shopId },
  );

  const services = useSupabaseQuery<ServiceOption[]>(
    async () => {
      const res = await supabase
        .from("services")
        .select("id, name, name_ar")
        .eq("shop_id", shopId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return { data: (res.data ?? []) as ServiceOption[], error: res.error };
    },
    [supabase, shopId],
    { enabled: !!shopId && isAdmin },
  );

  const members = useMemo(() => team.data ?? [], [team.data]);
  const shopServices = services.data ?? [];
  const term = normalizeSearchTerm(searchTerm).toLowerCase();
  const filtered = term
    ? members.filter((m) =>
        (m.full_name ?? "").toLowerCase().includes(term) ||
        (m.phone ?? "").replace(/\D/g, "").includes(term.replace(/\D/g, "") || "\u0000"),
      )
    : members;

  /** Re-read the team here AND in the shared workspace (calendar lanes, pickers). */
  const afterTeamChange = useCallback(() => {
    team.refetch();
    void refreshWorkspace();
  }, [team, refreshWorkspace]);

  const handleRemove = async () => {
    if (!removing) return;
    const member = removing;
    const { error } = await supabase
      .from("profiles")
      .update({ shop_id: null })
      .eq("id", member.id)
      .eq("shop_id", shopId);
    if (error) throw new Error(dbErrorMessage(t, error, t.team.removeFailed));

    // Membership is gone; optionally free their future bookings so another
    // barber (or "any barber") can pick them up. Done after the removal so a
    // refused removal (e.g. LAST_ADMIN) never touches appointments.
    if (unassignUpcoming) {
      const { error: unassignError } = await supabase
        .from("appointments")
        .update({ barber_id: null })
        .eq("shop_id", shopId)
        .eq("barber_id", member.id)
        .in("status", ["pending", "confirmed"])
        .gte("start_time", new Date().toISOString());
      if (unassignError) toast.error(t.team.unassignFailed);
    }

    toast.success(interpolate(t.team.removed, { name: member.full_name || t.team.unnamed }));
    if (editing?.id === member.id) setEditing(null);
    afterTeamChange();
  };

  const showSkeleton = !hydrated || (!!shopId && team.initialLoading);

  return (
    <div className="flex flex-col gap-6 sm:gap-8 fade-slide-up">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2
            className="m-0 text-[24px] sm:text-[28px] font-extrabold text-[var(--text-primary)]"
            style={{ fontFamily: FF, letterSpacing: headingTracking(isRTL, "0.016em") }}
          >
            {t.team.title}
          </h2>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{t.team.subtitle}</p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
          <div className="relative w-full sm:w-[280px]" role="search">
            <Search size={18} className="field-icon" aria-hidden="true" />
            <input
              type="search"
              autoComplete="off"
              aria-label={t.team.searchLabel}
              placeholder={t.team.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && searchTerm) {
                  e.preventDefault();
                  setSearchTerm("");
                }
              }}
              className="field-input has-icon has-action !min-h-[44px] [&::-webkit-search-cancel-button]:hidden"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="field-action focus-ring"
                aria-label={t.clients.clearSearch}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-primary shrink-0"
              onClick={() => {
                setInviteNonce((n) => n + 1);
                setInviteOpen(true);
              }}
            >
              <UserPlus size={16} aria-hidden="true" />
              {t.team.invite}
            </button>
          )}
        </div>
      </div>

      {/* ── Team list ── */}
      {showSkeleton ? (
        <ListSkeleton rows={4} />
      ) : team.error && members.length === 0 ? (
        <EmptyState
          tone="error"
          icon={AlertCircle}
          title={t.team.loadErrorTitle}
          description={t.team.loadErrorDescription}
          action={{ label: t.common.retry, onClick: team.refetch }}
        />
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t.team.emptyTitle}
          description={t.team.emptyDescription}
          action={
            isAdmin
              ? { label: t.team.invite, icon: UserPlus, onClick: () => { setInviteNonce((n) => n + 1); setInviteOpen(true); } }
              : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={interpolate(t.team.noMatchesTitle, { term: searchTerm.trim() })}
          action={{ label: t.clients.clearSearch, onClick: () => setSearchTerm("") }}
        />
      ) : (
        <ul
          aria-label={t.team.title}
          aria-busy={team.refreshing || undefined}
          className={cn(
            "divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] transition-opacity",
            team.refreshing && "opacity-60",
          )}
        >
          {filtered.map((member, i) => {
            const name = member.full_name || t.team.unnamed;
            const isSelf = member.id === currentUserId;
            const serviceCount = member.barber_services?.length ?? 0;
            return (
              <li
                key={member.id}
                className="group flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--bg-secondary)] focus-within:bg-[var(--bg-secondary)] sm:flex-nowrap sm:gap-4 sm:px-6"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    AVATAR_TONES[i % AVATAR_TONES.length],
                  )}
                >
                  {getInitials(member.full_name ?? "") || "?"}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-[15px] font-bold text-[var(--text-primary)]">
                    <span className="truncate">{name}</span>
                    {isSelf && (
                      <span className="shrink-0 rounded-full bg-[var(--bg-secondary)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                        {t.team.you}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck size={12} aria-hidden="true" />
                      {roleLabel(t, member.role)}
                    </span>
                    <span aria-hidden="true" className="text-[var(--text-muted)]">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Scissors size={12} aria-hidden="true" />
                      {serviceCount > 0
                        ? interpolate(t.team.servicesCount, { count: serviceCount })
                        : t.team.noServicesAssigned}
                    </span>
                    {member.created_at && (
                      <span className="hidden items-center gap-1 text-[var(--text-muted)] md:inline-flex">
                        <span aria-hidden="true">·</span>
                        {interpolate(t.team.joined, { date: formatDate(member.created_at, "medium") })}
                      </span>
                    )}
                  </p>
                </div>

                <div className="ms-auto flex shrink-0 items-center gap-1">
                  {member.phone && (
                    <a
                      href={`tel:${member.phone.replace(/[^\d+]/g, "")}`}
                      aria-label={interpolate(t.team.call, { name })}
                      title={interpolate(t.team.call, { name })}
                      className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] lg:h-9 lg:w-9"
                    >
                      <Phone size={16} aria-hidden="true" />
                    </a>
                  )}
                  {isAdmin && (
                    <div className="flex items-center gap-1 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => setEditing(member)}
                        className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] lg:h-9 lg:w-9"
                        aria-label={interpolate(t.team.manage, { name })}
                        title={interpolate(t.team.manage, { name })}
                      >
                        <Settings2 size={16} aria-hidden="true" />
                      </button>
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => {
                            setUnassignUpcoming(true);
                            setRemoving(member);
                          }}
                          className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--accent-rose)] lg:h-9 lg:w-9"
                          aria-label={interpolate(t.team.remove, { name })}
                          title={interpolate(t.team.remove, { name })}
                        >
                          <UserMinus size={16} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Member settings */}
      {isAdmin && (
        <MemberSettingsDialog
          key={editing?.id ?? "none"}
          member={editing}
          isSelf={editing?.id === currentUserId}
          shopId={shopId}
          services={shopServices}
          servicesLoading={services.initialLoading}
          onClose={() => setEditing(null)}
          onChanged={afterTeamChange}
        />
      )}

      {/* Invite */}
      {isAdmin && (
        <InviteDialog key={inviteNonce} open={inviteOpen} onClose={() => setInviteOpen(false)} />
      )}

      {/* Remove confirmation */}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={handleRemove}
        title={interpolate(t.team.removeTitle, { name: removing?.full_name || t.team.unnamed })}
        description={t.team.removeDescription}
        confirmLabel={t.team.removeConfirm}
        destructive
      >
        <label className="mt-2 flex cursor-pointer items-start gap-3 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={unassignUpcoming}
            onChange={(e) => setUnassignUpcoming(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-mint)]"
          />
          <span>{t.team.unassignUpcoming}</span>
        </label>
      </ConfirmDialog>
    </div>
  );
}

// ─── Invite ───────────────────────────────────────────────────────────────────

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, formatDate } = useTranslation();
  const [role, setRole] = useState<StaffRole>("barber");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ url: string; expiresAt: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const linkId = useId();
  const roleName = useId();
  const linkRef = useRef<HTMLInputElement>(null);

  const createInvite = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/invite/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success || !body?.data?.url) {
        setError(codeMessage(t, body?.code, t.team.inviteFailed));
        return;
      }
      setInvite({ url: body.data.url, expiresAt: body.data.expiresAt ?? null });
    } catch {
      setError(t.team.inviteFailed);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      toast.success(t.team.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      linkRef.current?.select();
      toast.error(t.team.copyFailed);
    }
  };

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const shareText = invite ? interpolate(t.team.whatsappMessage, { link: invite.url }) : "";

  const roles: { value: StaffRole; label: string; hint: string }[] = [
    { value: "barber", label: t.team.roleBarber, hint: t.team.roleBarberHint },
    { value: "shop_admin", label: t.team.roleAdmin, hint: t.team.roleAdminHint },
  ];

  return (
    <Dialog
      open={open}
      onClose={() => { if (!creating) onClose(); }}
      title={t.team.inviteTitle}
      description={t.team.inviteDescription}
      size="md"
      footer={
        <DialogFooter>
          {invite ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => { setInvite(null); setCopied(false); }}>
                {t.team.newLink}
              </button>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                {t.common.close}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={creating}>
                {t.common.cancel}
              </button>
              <button type="button" className="btn btn-primary" onClick={createInvite} disabled={creating} aria-busy={creating || undefined}>
                {creating ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
                {creating ? t.common.processing : t.team.createLink}
              </button>
            </>
          )}
        </DialogFooter>
      }
    >
      {!invite ? (
        <fieldset className="flex flex-col gap-2" disabled={creating}>
          <legend className="field-label">{t.team.inviteRoleLabel}</legend>
          {roles.map((r) => (
            <label
              key={r.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-[var(--radius-inputs)] border p-3 transition-colors focus-ring-within",
                role === r.value
                  ? "border-[var(--accent-brass)] bg-[var(--bg-secondary)]"
                  : "border-[var(--border-subtle)] hover:border-[var(--border-primary)]",
              )}
            >
              <input
                type="radio"
                name={roleName}
                value={r.value}
                checked={role === r.value}
                onChange={() => setRole(r.value)}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-mint)]"
              />
              <span>
                <span className="block text-sm font-semibold text-[var(--text-primary)]">{r.label}</span>
                <span className="block text-[13px] text-[var(--text-secondary)]">{r.hint}</span>
              </span>
            </label>
          ))}
          {error && (
            <p role="alert" className="field-error">{error}</p>
          )}
        </fieldset>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor={linkId} className="field-label">{t.team.inviteLinkLabel}</label>
            <div className="flex items-center gap-2">
              <input
                ref={linkRef}
                id={linkId}
                readOnly
                dir="ltr"
                value={invite.url}
                onFocus={(e) => e.target.select()}
                className="field-input min-w-0 flex-1 text-start !text-sm"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="btn btn-secondary shrink-0 !px-4"
                aria-label={t.common.copy}
              >
                {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                <span className="hidden sm:inline">{t.common.copy}</span>
              </button>
            </div>
            {invite.expiresAt && (
              <p className="mt-1.5 inline-flex items-center gap-1 text-[13px] text-[var(--text-muted)]">
                <Clock size={12} aria-hidden="true" />
                {interpolate(t.team.inviteExpires, { date: formatDate(invite.expiresAt, "medium") })}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <MessageCircle size={16} aria-hidden="true" />
              {t.team.shareWhatsapp}
            </a>
            {canNativeShare && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  navigator.share({ text: shareText, url: invite.url }).catch(() => undefined);
                }}
              >
                <Share2 size={16} aria-hidden="true" />
                {t.common.share}
              </button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

// ─── Member settings (services · hours · role) ───────────────────────────────

type SettingsTab = "services" | "hours" | "role";

function MemberSettingsDialog({
  member, isSelf, shopId, services, servicesLoading, onClose, onChanged,
}: {
  member: TeamMember | null;
  isSelf: boolean;
  shopId: string;
  services: ServiceOption[];
  servicesLoading: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, isRTL } = useTranslation();
  const [tab, setTab] = useState<SettingsTab>("services");
  const [busy, setBusy] = useState(false);
  const baseId = useId();
  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "services", label: t.team.tabServices },
    { id: "hours", label: t.team.tabHours },
    { id: "role", label: t.team.tabRole },
  ];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    const forward = isRTL ? "ArrowLeft" : "ArrowRight";
    const backward = isRTL ? "ArrowRight" : "ArrowLeft";
    let next = -1;
    if (e.key === forward) next = (index + 1) % tabs.length;
    else if (e.key === backward) next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setTab(tabs[next].id);
    tabRefs.current[next]?.focus();
  };

  const name = member?.full_name || t.team.unnamed;

  return (
    <Dialog
      open={!!member}
      onClose={() => { if (!busy) onClose(); }}
      closeOnBackdrop={!busy}
      title={interpolate(t.team.settingsTitle, { name })}
      size="lg"
      bodyClassName="!pt-0"
    >
      {member && (
        <>
          <div
            role="tablist"
            aria-label={interpolate(t.team.settingsTitle, { name })}
            className="sticky top-0 z-10 -mx-6 mb-4 flex overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4"
          >
            {tabs.map((tb, i) => (
              <button
                key={tb.id}
                ref={(el) => { tabRefs.current[i] = el; }}
                id={`${baseId}-tab-${tb.id}`}
                role="tab"
                type="button"
                aria-selected={tab === tb.id}
                aria-controls={`${baseId}-panel-${tb.id}`}
                tabIndex={tab === tb.id ? 0 : -1}
                onClick={() => setTab(tb.id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={cn(
                  "focus-ring-inset min-h-[44px] shrink-0 border-b-2 px-4 text-sm font-medium transition-colors",
                  tab === tb.id
                    ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                )}
              >
                {tb.label}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id={`${baseId}-panel-${tab}`}
            aria-labelledby={`${baseId}-tab-${tab}`}
            className="pb-2"
          >
            {tab === "services" ? (
              <ServicesPanel
                member={member}
                services={services}
                loading={servicesLoading}
                onBusy={setBusy}
                onSaved={() => { onChanged(); onClose(); }}
                onCancel={onClose}
              />
            ) : tab === "hours" ? (
              <WorkingHoursPanel member={member} onBusy={setBusy} onSaved={onClose} onCancel={onClose} />
            ) : (
              <RolePanel
                member={member}
                isSelf={isSelf}
                shopId={shopId}
                onBusy={setBusy}
                onSaved={() => { onChanged(); onClose(); }}
                onCancel={onClose}
              />
            )}
          </div>
        </>
      )}
    </Dialog>
  );
}

function PanelActions({
  onCancel, onSave, saving, saveLabel, disabled,
}: {
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  saveLabel: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <DialogFooter className="mt-6 border-t border-[var(--border-subtle)] pt-4">
      <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={saving}>
        {t.common.cancel}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || disabled}
        aria-busy={saving || undefined}
        className="btn btn-primary"
      >
        {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        {saving ? t.common.processing : saveLabel}
      </button>
    </DialogFooter>
  );
}

function ServicesPanel({
  member, services, loading, onBusy, onSaved, onCancel,
}: {
  member: TeamMember;
  services: ServiceOption[];
  loading: boolean;
  onBusy: (b: boolean) => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t, isRTL } = useTranslation();
  const supabase = useSupabase();
  const [selectedIds, setSelectedIds] = useState<string[]>(
    () => member.barber_services?.map((bs) => bs.service_id) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  // Add-then-remove so a failure never leaves the barber with zero services
  // (which would hide them from public booking): the worst case is a superset.
  const handleSave = async () => {
    setSaving(true);
    onBusy(true);
    setError(null);
    try {
      if (selectedIds.length > 0) {
        const { error: upsertError } = await supabase
          .from("barber_services")
          .upsert(
            selectedIds.map((sid) => ({ barber_id: member.id, service_id: sid })),
            { onConflict: "barber_id,service_id", ignoreDuplicates: true },
          );
        if (upsertError) throw upsertError;
      }

      const { data: current, error: readError } = await supabase
        .from("barber_services")
        .select("service_id")
        .eq("barber_id", member.id);
      if (readError) throw readError;

      const toRemove = (current ?? [])
        .map((r) => r.service_id as string)
        .filter((sid) => !selectedIds.includes(sid));
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("barber_services")
          .delete()
          .eq("barber_id", member.id)
          .in("service_id", toRemove);
        if (deleteError) throw deleteError;
      }

      toast.success(t.team.servicesSaved);
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(t, err, t.team.servicesFailed));
    } finally {
      setSaving(false);
      onBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--text-secondary)]">{t.team.servicesHint}</p>

      {services.length === 0 ? (
        <p className="rounded-[var(--radius-inputs)] border border-dashed border-[var(--border-subtle)] p-4 text-center text-sm text-[var(--text-muted)]">
          {t.team.noActiveServices}
        </p>
      ) : (
        <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2" disabled={saving}>
          <legend className="sr-only">{t.team.tabServices}</legend>
          {services.map((s) => {
            const checked = selectedIds.includes(s.id);
            return (
              <label
                key={s.id}
                className={cn(
                  "focus-ring-within flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[var(--radius-inputs)] border p-3 transition-colors",
                  checked
                    ? "border-[var(--accent-brass)] bg-[var(--bg-secondary)]"
                    : "border-[var(--border-subtle)] hover:border-[var(--border-primary)]",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(s.id)}
                  className="h-4 w-4 shrink-0 accent-[var(--accent-mint)]"
                />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {isRTL && s.name_ar ? s.name_ar : s.name}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      {error && <p role="alert" className="field-error">{error}</p>}

      <PanelActions
        onCancel={onCancel}
        onSave={handleSave}
        saving={saving}
        saveLabel={t.team.saveServices}
        disabled={services.length === 0}
      />
    </div>
  );
}

interface DaySchedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working: boolean;
  break_start: string | null;
  break_end: string | null;
}

/** "09:00" → "09:00:00"; keeps already-qualified values. */
const withSeconds = (v: string) => (v.length === 5 ? `${v}:00` : v);

function WorkingHoursPanel({
  member, onBusy, onSaved, onCancel,
}: {
  member: TeamMember;
  onBusy: (b: boolean) => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t, formatDate } = useTranslation();
  const supabase = useSupabase();
  const [schedule, setSchedule] = useState<DaySchedule[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Localised weekday names (0 = Sunday): 7 Jan 2024 was a Sunday.
  const dayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, i) => formatDate(new Date(2024, 0, 7 + i), { weekday: "long" })),
    [formatDate],
  );

  const hours = useSupabaseQuery<DaySchedule[]>(
    async () => {
      const res = await supabase
        .from("working_hours")
        .select("day_of_week, start_time, end_time, is_working, break_start, break_end")
        .eq("barber_id", member.id)
        .order("day_of_week", { ascending: true });
      const rows = res.data ?? [];
      const full = Array.from({ length: 7 }, (_, i): DaySchedule => {
        const existing = rows.find((d) => d.day_of_week === i);
        return existing
          ? {
              day_of_week: i,
              start_time: existing.start_time,
              end_time: existing.end_time,
              is_working: existing.is_working ?? true,
              break_start: existing.break_start ?? null,
              break_end: existing.break_end ?? null,
            }
          : { day_of_week: i, start_time: "09:00:00", end_time: "18:00:00", is_working: true, break_start: null, break_end: null };
      });
      return { data: full, error: res.error };
    },
    [supabase, member.id],
    { retryCount: 0 },
  );

  const days = schedule ?? hours.data;

  const updateDay = (day: number, patch: Partial<DaySchedule>) => {
    setSchedule((prev) => (prev ?? hours.data ?? []).map((d) => (d.day_of_week === day ? { ...d, ...patch } : d)));
  };

  const handleSave = async () => {
    if (!days) return;
    for (const d of days) {
      if (!d.is_working) continue;
      const day = dayLabels[d.day_of_week];
      if (d.end_time <= d.start_time) return setError(interpolate(t.team.hoursOrder, { day }));
      if (!d.break_start && !d.break_end) continue;
      if (!d.break_start || !d.break_end) return setError(interpolate(t.team.breakIncomplete, { day }));
      if (d.break_end <= d.break_start) return setError(interpolate(t.team.breakOrder, { day }));
      if (d.break_start < d.start_time || d.break_end > d.end_time)
        return setError(interpolate(t.team.breakOutside, { day }));
    }

    setSaving(true);
    onBusy(true);
    setError(null);
    try {
      const rows = days.map((d) => ({
        barber_id: member.id,
        day_of_week: d.day_of_week,
        start_time: d.start_time,
        end_time: d.end_time,
        is_working: d.is_working,
        break_start: d.is_working ? d.break_start : null,
        break_end: d.is_working ? d.break_end : null,
      }));
      const { error: saveError } = await supabase
        .from("working_hours")
        .upsert(rows, { onConflict: "barber_id,day_of_week" });
      if (saveError) throw saveError;
      toast.success(t.team.hoursSaved);
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(t, err, t.team.hoursFailed));
    } finally {
      setSaving(false);
      onBusy(false);
    }
  };

  if (hours.initialLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  if (hours.error || !days) {
    return (
      <EmptyState
        size="sm"
        tone="error"
        icon={AlertCircle}
        title={t.team.hoursLoadFailed}
        action={{ label: t.common.retry, onClick: hours.refetch }}
      />
    );
  }

  const timeInput =
    "h-11 w-full min-w-0 rounded-[var(--radius-inputs)] border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 text-center text-sm text-[var(--text-primary)] outline-none focus-visible:border-[var(--accent-brass)] sm:w-28 disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2" disabled={saving}>
        <legend className="sr-only">{t.team.tabHours}</legend>
        {days.map((day) => {
          const label = dayLabels[day.day_of_week];
          return (
            <div
              key={day.day_of_week}
              className={cn(
                "flex flex-col gap-2 rounded-[var(--radius-inputs)] border border-[var(--border-subtle)] p-3",
                day.is_working ? "bg-[var(--bg-secondary)]" : "bg-[var(--bg-primary)]",
              )}
            >
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex min-w-[140px] cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={day.is_working}
                    onChange={(e) => updateDay(day.day_of_week, { is_working: e.target.checked })}
                    className="h-4 w-4 shrink-0 accent-[var(--accent-mint)]"
                  />
                  <span className={cn("text-sm font-medium", day.is_working ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]")}>
                    {label}
                  </span>
                  {!day.is_working && <span className="text-[12px] text-[var(--text-muted)]">· {t.team.dayOff}</span>}
                </label>

                {day.is_working && (
                  <div className="flex flex-1 items-center gap-2 sm:flex-none">
                    <input
                      type="time"
                      aria-label={`${label} — ${t.team.startTime}`}
                      value={day.start_time.substring(0, 5)}
                      onChange={(e) => e.target.value && updateDay(day.day_of_week, { start_time: withSeconds(e.target.value) })}
                      className={timeInput}
                    />
                    <span aria-hidden="true" className="text-[var(--text-muted)]">–</span>
                    <input
                      type="time"
                      aria-label={`${label} — ${t.team.endTime}`}
                      value={day.end_time.substring(0, 5)}
                      onChange={(e) => e.target.value && updateDay(day.day_of_week, { end_time: withSeconds(e.target.value) })}
                      className={timeInput}
                    />
                  </div>
                )}
              </div>

              {day.is_working && (
                <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--border-subtle)] pt-2">
                  <span className="w-full text-[12px] font-medium text-[var(--text-muted)] sm:w-auto">{t.team.breakLabel}</span>
                  <div className="flex flex-1 items-center gap-2 sm:flex-none">
                    <input
                      type="time"
                      aria-label={`${label} — ${t.team.breakStart}`}
                      value={day.break_start ? day.break_start.substring(0, 5) : ""}
                      onChange={(e) => updateDay(day.day_of_week, { break_start: e.target.value ? withSeconds(e.target.value) : null })}
                      className={timeInput}
                    />
                    <span aria-hidden="true" className="text-[var(--text-muted)]">–</span>
                    <input
                      type="time"
                      aria-label={`${label} — ${t.team.breakEnd}`}
                      value={day.break_end ? day.break_end.substring(0, 5) : ""}
                      onChange={(e) => updateDay(day.day_of_week, { break_end: e.target.value ? withSeconds(e.target.value) : null })}
                      className={timeInput}
                    />
                  </div>
                  {(day.break_start || day.break_end) && (
                    <button
                      type="button"
                      onClick={() => updateDay(day.day_of_week, { break_start: null, break_end: null })}
                      className="focus-ring min-h-[44px] rounded px-2 text-[12px] font-medium text-[var(--text-muted)] underline transition-colors hover:text-[var(--accent-rose)]"
                      aria-label={`${label} — ${t.team.clearBreak}`}
                    >
                      {t.team.clearBreak}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </fieldset>

      {error && <p role="alert" className="field-error">{error}</p>}

      <PanelActions onCancel={onCancel} onSave={handleSave} saving={saving} saveLabel={t.team.saveHours} />
    </div>
  );
}

function RolePanel({
  member, isSelf, shopId, onBusy, onSaved, onCancel,
}: {
  member: TeamMember;
  isSelf: boolean;
  shopId: string;
  onBusy: (b: boolean) => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const supabase = useSupabase();
  const [role, setRole] = useState<StaffRole>(member.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupName = useId();

  const options: { value: StaffRole; label: string; hint: string }[] = [
    { value: "barber", label: t.team.roleBarber, hint: t.team.roleBarberHint },
    { value: "shop_admin", label: t.team.roleAdmin, hint: t.team.roleAdminHint },
  ];

  const handleSave = async () => {
    if (role === member.role || isSelf) return;
    setSaving(true);
    onBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", member.id)
        .eq("shop_id", shopId);
      if (updateError) throw updateError;
      toast.success(t.team.roleSaved);
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(t, err, t.team.roleFailed));
    } finally {
      setSaving(false);
      onBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {isSelf && (
        <p className="rounded-[var(--radius-inputs)] bg-[var(--bg-secondary)] p-3 text-sm text-[var(--text-secondary)]">
          {t.team.ownRoleLocked}
        </p>
      )}
      <fieldset className="flex flex-col gap-2" disabled={saving || isSelf}>
        <legend className="field-label">{t.team.inviteRoleLabel}</legend>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "focus-ring-within flex cursor-pointer items-start gap-3 rounded-[var(--radius-inputs)] border p-3 transition-colors",
              role === o.value
                ? "border-[var(--accent-brass)] bg-[var(--bg-secondary)]"
                : "border-[var(--border-subtle)] hover:border-[var(--border-primary)]",
              isSelf && "cursor-not-allowed opacity-70",
            )}
          >
            <input
              type="radio"
              name={groupName}
              value={o.value}
              checked={role === o.value}
              onChange={() => setRole(o.value)}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-mint)]"
            />
            <span>
              <span className="block text-sm font-semibold text-[var(--text-primary)]">{o.label}</span>
              <span className="block text-[13px] text-[var(--text-secondary)]">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {error && <p role="alert" className="field-error">{error}</p>}

      <PanelActions
        onCancel={onCancel}
        onSave={handleSave}
        saving={saving}
        saveLabel={t.team.saveRole}
        disabled={isSelf || role === member.role}
      />
    </div>
  );
}
