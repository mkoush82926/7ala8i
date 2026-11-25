"use client";

import React, { useCallback, useId, useMemo, useRef, useState } from "react";
import {
  UserPlus, Search, Settings2, Phone, ShieldCheck, Scissors, X, Copy, Check,
  UserMinus, MessageCircle, Share2, Link2, AlertCircle, Users, Clock,
} from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabase } from "@/hooks/use-supabase";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { normalizeSearchTerm } from "@/lib/queries/search";
import { STAFF_ROLES, type StaffRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { ShiftsPanel } from "@/components/team/shifts";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { PhotoFrame } from "@/components/ui/photo-frame";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { buttonClasses, checkboxClasses, fieldIconClasses, focusRing, inputClasses } from "@/components/ui/recipes";

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

/** Selectable option card (role pickers, service checklist). */
const choiceCard = (on: boolean, extra?: string | false) =>
  cn(
    "focus-ring-within flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors duration-150",
    on ? "border-brand bg-brand-soft/50 ring-1 ring-brand" : "border-line bg-card hover:border-ink-soft",
    extra,
  );

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
  const { t, formatDate, formatNumber } = useTranslation();
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
    <div className="flex flex-col gap-5 lg:gap-6 fade-slide-up">
      {/* ── Page header ── */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-h2 text-ink">{t.team.title}</h1>
            {!showSkeleton && members.length > 0 && (
              <Pill tone="neutral" className="tabular-nums">{formatNumber(members.length)}</Pill>
            )}
          </div>
          <p className="mt-1 text-[15px] text-ink-muted">{t.team.subtitle}</p>
        </div>

        <div className="flex w-full items-center gap-2 lg:w-auto">
          <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none" role="search">
            <span aria-hidden="true" className={fieldIconClasses}>
              <Search />
            </span>
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
              className={inputClasses({ withIcon: true, className: "h-11 rounded-full pe-12 [&::-webkit-search-cancel-button]:hidden" })}
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
            <Button
              icon={<UserPlus aria-hidden="true" />}
              aria-label={t.team.invite}
              className="max-sm:w-11 max-sm:px-0"
              onClick={() => {
                setInviteNonce((n) => n + 1);
                setInviteOpen(true);
              }}
            >
              <span className="hidden sm:inline">{t.team.invite}</span>
            </Button>
          )}
        </div>
      </header>

      {/* ── Team grid ── */}
      {showSkeleton ? (
        <ul aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="rounded-xl border border-line bg-card p-4 lg:p-5">
              <div className="flex items-center gap-4">
                <Skeleton variant="circle" className="size-14" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
              <Skeleton className="mt-5 h-3 w-1/2" />
              <Skeleton className="mt-4 h-9 w-full rounded-full" />
            </li>
          ))}
        </ul>
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
            "grid gap-4 transition-opacity duration-200 sm:grid-cols-2 xl:grid-cols-3",
            team.refreshing && "opacity-60",
          )}
        >
          {filtered.map((member) => {
            const name = member.full_name || t.team.unnamed;
            const isSelf = member.id === currentUserId;
            const serviceCount = member.barber_services?.length ?? 0;
            const isAdminRole = member.role === "shop_admin";
            return (
              <li
                key={member.id}
                className="group flex flex-col rounded-xl border border-line bg-card p-4 transition-shadow duration-200 hover:shadow-card focus-within:shadow-card lg:p-5"
              >
                <div className="flex items-start gap-4">
                  <PhotoFrame
                    src={member.avatar_url}
                    alt=""
                    ratio="none"
                    rounded="full"
                    sizes="56px"
                    fallbackName={member.full_name || "?"}
                    seed={member.id}
                    className="size-14 shrink-0"
                    initialsClassName="text-lg md:text-lg"
                  />

                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-title line-clamp-2 break-words text-ink">
                      <bdi>{name}</bdi>
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Pill
                        tone={isAdminRole ? "ink" : "brand"}
                        size="sm"
                        icon={isAdminRole ? <ShieldCheck /> : <Scissors />}
                      >
                        {roleLabel(t, member.role)}
                      </Pill>
                      {isSelf && <Pill tone="neutral" size="sm">{t.team.you}</Pill>}
                    </div>
                  </div>

                  {member.phone && (
                    <a
                      href={`tel:${member.phone.replace(/[^\d+]/g, "")}`}
                      aria-label={interpolate(t.team.call, { name })}
                      title={interpolate(t.team.call, { name })}
                      className={buttonClasses({ variant: "secondary", size: "icon-sm", className: "-me-1 max-lg:size-11" })}
                    >
                      <Phone aria-hidden="true" />
                    </a>
                  )}
                </div>

                <p className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-ink-muted">
                  {serviceCount > 0 || !isAdmin ? (
                    <span className={cn("inline-flex items-center gap-1", serviceCount === 0 && "text-warning-text")}>
                      <Scissors size={13} aria-hidden="true" />
                      {serviceCount > 0
                        ? interpolate(t.team.servicesCount, { count: serviceCount })
                        : t.team.noServicesAssigned}
                    </span>
                  ) : (
                    // Actionable: opens member settings on the Services tab.
                    <button
                      type="button"
                      onClick={() => setEditing(member)}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1 rounded-sm font-semibold text-warning-text underline-offset-4 hover:underline",
                        focusRing,
                      )}
                    >
                      <Scissors size={13} aria-hidden="true" />
                      {t.team.assignServices}
                    </button>
                  )}
                  {member.created_at && (
                    <>
                      <span aria-hidden="true" className="text-ink-disabled">·</span>
                      <span>{interpolate(t.team.joined, { date: formatDate(member.created_at, "medium") })}</span>
                    </>
                  )}
                </p>

                {isAdmin && (
                  <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="min-w-0 flex-1 max-lg:h-11"
                      icon={<Settings2 aria-hidden="true" />}
                      onClick={() => setEditing(member)}
                      aria-label={interpolate(t.team.manage, { name })}
                    >
                      {t.team.manageShort}
                    </Button>
                    {!isSelf && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 hover:bg-danger-soft hover:text-danger-text max-lg:size-11"
                        onClick={() => {
                          setUnassignUpcoming(true);
                          setRemoving(member);
                        }}
                        aria-label={interpolate(t.team.remove, { name })}
                        title={interpolate(t.team.remove, { name })}
                      >
                        <UserMinus aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                )}
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
        <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl bg-sunken p-3 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={unassignUpcoming}
            onChange={(e) => setUnassignUpcoming(e.target.checked)}
            className={cn(checkboxClasses, "mt-0.5 shrink-0 accent-brand")}
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
              <Button variant="secondary" onClick={() => { setInvite(null); setCopied(false); }}>
                {t.team.newLink}
              </Button>
              <Button onClick={onClose}>
                {t.common.close}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose} disabled={creating}>
                {t.common.cancel}
              </Button>
              <Button onClick={createInvite} loading={creating} icon={<Link2 aria-hidden="true" />}>
                {creating ? t.common.processing : t.team.createLink}
              </Button>
            </>
          )}
        </DialogFooter>
      }
    >
      {!invite ? (
        <fieldset className="flex flex-col gap-2.5" disabled={creating}>
          <legend className="field-label">{t.team.inviteRoleLabel}</legend>
          {roles.map((r) => (
            <label key={r.value} className={choiceCard(role === r.value)}>
              <input
                type="radio"
                name={roleName}
                value={r.value}
                checked={role === r.value}
                onChange={() => setRole(r.value)}
                className={cn(checkboxClasses, "mt-0.5 shrink-0 rounded-full accent-brand")}
              />
              <span>
                <span className="block text-sm font-semibold text-ink">{r.label}</span>
                <span className="mt-0.5 block text-[13px] text-ink-muted">{r.hint}</span>
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
                className="field-input min-w-0 flex-1 bg-sunken text-start !text-sm tabular-nums"
              />
              <Button
                variant={copied ? "soft" : "secondary"}
                onClick={handleCopy}
                className="max-sm:w-11 max-sm:px-0"
                aria-label={t.common.copy}
                icon={copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              >
                <span className="hidden sm:inline">{t.common.copy}</span>
              </Button>
            </div>
            {invite.expiresAt && (
              <p className="mt-1.5 inline-flex items-center gap-1 text-[13px] text-ink-muted">
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
              className={buttonClasses({ variant: "secondary" })}
            >
              <MessageCircle size={18} aria-hidden="true" />
              {t.team.shareWhatsapp}
            </a>
            {canNativeShare && (
              <Button
                variant="secondary"
                icon={<Share2 aria-hidden="true" />}
                onClick={() => {
                  navigator.share({ text: shareText, url: invite.url }).catch(() => undefined);
                }}
              >
                {t.common.share}
              </Button>
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
  const { t } = useTranslation();
  const [tab, setTab] = useState<SettingsTab>("services");
  const [busy, setBusy] = useState(false);
  const baseId = useId();
  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "services", label: t.team.tabServices },
    { id: "hours", label: t.team.tabHours },
    { id: "role", label: t.team.tabRole },
  ];
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
          <div className="sticky top-0 z-10 -mx-6 mb-5 bg-card px-6">
            <SegmentedControl<SettingsTab>
              variant="underline"
              semantics="tabs"
              idPrefix={baseId}
              ariaLabel={interpolate(t.team.settingsTitle, { name })}
              options={tabs.map((tb) => ({ value: tb.id, label: tb.label }))}
              value={tab}
              onChange={setTab}
              className="w-full"
            />
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
              <ShiftsPanel member={member} onBusy={setBusy} onSaved={onClose} onCancel={onClose} />
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
    <DialogFooter className="mt-6 border-t border-line pt-4">
      <Button variant="secondary" onClick={onCancel} disabled={saving}>
        {t.common.cancel}
      </Button>
      <Button onClick={onSave} disabled={disabled} loading={saving}>
        {saving ? t.common.processing : saveLabel}
      </Button>
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
      <p className="text-sm text-ink-muted">{t.team.servicesHint}</p>

      {services.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-ink-muted">
          {t.team.noActiveServices}
        </p>
      ) : (
        <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2" disabled={saving}>
          <legend className="sr-only">{t.team.tabServices}</legend>
          {services.map((s) => {
            const checked = selectedIds.includes(s.id);
            return (
              <label key={s.id} className={choiceCard(checked, "min-h-12 items-center py-3")}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(s.id)}
                  className={cn(checkboxClasses, "shrink-0 accent-brand")}
                />
                <span className="text-sm font-medium text-ink">
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
        <p className="rounded-xl bg-sunken p-4 text-sm text-ink-soft">
          {t.team.ownRoleLocked}
        </p>
      )}
      <fieldset className="flex flex-col gap-2" disabled={saving || isSelf}>
        <legend className="field-label">{t.team.inviteRoleLabel}</legend>
        {options.map((o) => (
          <label key={o.value} className={choiceCard(role === o.value, isSelf && "cursor-not-allowed opacity-70")}>
            <input
              type="radio"
              name={groupName}
              value={o.value}
              checked={role === o.value}
              onChange={() => setRole(o.value)}
              className={cn(checkboxClasses, "mt-0.5 shrink-0 rounded-full accent-brand")}
            />
            <span>
              <span className="block text-sm font-semibold text-ink">{o.label}</span>
              <span className="mt-0.5 block text-[13px] text-ink-muted">{o.hint}</span>
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
