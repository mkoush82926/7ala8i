"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { Camera, EyeOff, ExternalLink, Loader2, Pencil, Users } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { publicEnv } from "@/lib/env";
import { cn } from "@/lib/utils";
import { ShopImage } from "../shop-image";
import { AVATAR_MAX_EDGE, pathFromPublicUrl, publicMediaUrl } from "../lib/media";
import { barberPath } from "../lib/slug";
import { prepareImage, removeShopMedia, UploadError, uploadShopMedia } from "../lib/upload";
import {
  barberFormFromRow,
  barberPatch,
  LANGUAGE_OPTIONS,
  LIMITS,
  saveErrorKey,
  toggleLanguage,
  validateBarber,
  type BarberForm,
  type BarberProfileRow,
  type FieldErrorCode,
} from "./profile-form";
import type { AnyClient } from "./types";
import { SettingsSection, Switch, TextField } from "./ui";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export function Avatar({ name, url, size = 48 }: { name: string; url: string | null; size?: number }) {
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-secondary)] text-sm font-bold text-[var(--text-secondary)]"
      style={{ width: size, height: size }}
    >
      {url ? <ShopImage src={url} alt="" fill sizes={`${size}px`} className="object-cover" /> : <span aria-hidden="true">{initials(name)}</span>}
    </span>
  );
}

/** Public barber cards: avatar, handle, title, bio, languages, experience, visibility. */
export function TeamProfiles({
  supabase,
  shopId,
  team,
  userId,
  isAdmin,
  onTeam,
  onChanged,
}: {
  supabase: AnyClient;
  shopId: string;
  team: BarberProfileRow[];
  userId: string | null;
  isAdmin: boolean;
  onTeam: (next: BarberProfileRow[]) => void;
  onChanged: () => void;
}) {
  const { t, locale } = useTranslation();
  const pp = t.publicProfile;
  const [editing, setEditing] = useState<BarberProfileRow | null>(null);

  const canEdit = (m: BarberProfileRow) => isAdmin || m.id === userId;
  const roleTitle = (m: BarberProfileRow) =>
    (locale === "ar" ? m.title_ar || m.title_en : m.title_en || m.title_ar) || (m.role === "shop_admin" ? pp.roleOwner : pp.roleBarber);

  return (
    <SettingsSection id="team" title={pp.teamTitle} description={pp.teamDesc}>
      {team.length === 0 ? (
        <EmptyState icon={Users} size="sm" title={pp.teamEmptyTitle} description={pp.teamEmptyDesc} action={{ label: pp.teamEmptyAction, href: `/${locale}/team` }} />
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {team.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <Avatar name={m.full_name} url={m.avatar_url} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                  <span className="truncate">{m.full_name || pp.unnamed}</span>
                  {!m.is_public && (
                    <Pill tone="neutral" size="sm" icon={<EyeOff size={12} aria-hidden="true" />}>
                      {pp.hidden}
                    </Pill>
                  )}
                </p>
                <p className="truncate text-xs text-[var(--text-secondary)]">
                  {roleTitle(m)}
                  {m.handle && (
                    <span dir="ltr" className="ms-2 text-[var(--text-muted)]">
                      @{m.handle}
                    </span>
                  )}
                </p>
              </div>
              {m.handle && m.is_public && (
                <Link
                  href={barberPath(m.handle, locale)}
                  target="_blank"
                  className="focus-ring hidden sm:inline-grid h-10 w-10 place-items-center rounded-[8px] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                  aria-label={interpolate(pp.viewBarberPage, { name: m.full_name })}
                  title={interpolate(pp.viewBarberPage, { name: m.full_name })}
                >
                  <ExternalLink size={16} aria-hidden="true" />
                </Link>
              )}
              {canEdit(m) && (
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(m)} aria-label={interpolate(pp.editBarber, { name: m.full_name })}>
                  <Pencil size={14} aria-hidden="true" />
                  <span className="hidden sm:inline">{pp.edit}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <BarberEditor
          key={editing.id}
          supabase={supabase}
          shopId={shopId}
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            onTeam(team.map((m) => (m.id === row.id ? row : m)));
            setEditing(null);
            onChanged();
          }}
          onAvatar={(row) => onTeam(team.map((m) => (m.id === row.id ? row : m)))}
        />
      )}
    </SettingsSection>
  );
}

function BarberEditor({
  supabase,
  shopId,
  member,
  onClose,
  onSaved,
  onAvatar,
}: {
  supabase: AnyClient;
  shopId: string;
  member: BarberProfileRow;
  onClose: () => void;
  onSaved: (row: BarberProfileRow) => void;
  onAvatar: (row: BarberProfileRow) => void;
}) {
  const { t, locale, formatNumber } = useTranslation();
  const pp = t.publicProfile;
  const initial = barberFormFromRow(member);
  const [form, setForm] = useState<BarberForm>(initial);
  const [current, setCurrent] = useState(member);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const errors = validateBarber(form);
  const patch = barberPatch(initial, form);
  const dirty = Object.keys(patch).length > 0;
  const set = <K extends keyof BarberForm>(k: K, v: BarberForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const err = (code: FieldErrorCode | undefined, max?: number) =>
    code ? (code === "tooLong" ? pp.errors.tooLong.replace("{max}", formatNumber(max ?? 0)) : pp.errors[code]) : null;
  const langName = (code: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
    } catch {
      return code;
    }
  };

  const onAvatarFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const img = await prepareImage(file, { maxEdge: AVATAR_MAX_EDGE, aspect: 1 });
      const path = await uploadShopMedia(supabase, "barber", shopId, img, member.id);
      const url = publicMediaUrl(publicEnv.supabaseUrl, path);
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", member.id);
      if (error) {
        await removeShopMedia(supabase, [path]);
        throw new UploadError("upload");
      }
      const old = pathFromPublicUrl(current.avatar_url);
      if (old) await removeShopMedia(supabase, [old]);
      const next = { ...current, avatar_url: url };
      setCurrent(next);
      onAvatar(next);
      toast.success(pp.avatarUpdated);
    } catch (e) {
      toast.error(pp.uploadErrors[e instanceof UploadError ? e.code : "upload"]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (Object.keys(errors).length > 0 || !dirty) return;
    setSaving(true);
    setServerError(null);
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", member.id)
      .select("handle, languages")
      .maybeSingle();
    setSaving(false);
    if (error || !data) {
      const key = saveErrorKey(error);
      const msg = key === "handleTaken" ? pp.handleTaken : key === "handleInvalid" ? pp.errors.invalid : pp.saveFailed;
      if (key === "handleTaken" || key === "handleInvalid") setServerError(msg);
      toast.error(msg);
      return;
    }
    const years = patch.years_experience !== undefined ? (patch.years_experience as number | null) : current.years_experience;
    const row: BarberProfileRow = {
      ...current,
      handle: (data as { handle: string | null }).handle,
      title_en: form.title_en.trim() || null,
      title_ar: form.title_ar.trim() || null,
      bio_en: form.bio_en.trim() || null,
      bio_ar: form.bio_ar.trim() || null,
      languages: ((data as { languages: string[] | null }).languages ?? []) as string[],
      years_experience: years,
      is_public: form.is_public,
    };
    toast.success(pp.saved);
    onSaved(row);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={interpolate(pp.editBarber, { name: member.full_name })}
      size="lg"
      footer={
        <DialogFooter>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="button" className="btn btn-primary" disabled={!dirty || saving || Object.keys(errors).length > 0} onClick={() => void save()}>
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {t.common.save}
          </button>
        </DialogFooter>
      }
    >
      <div className="grid gap-5">
        <div className="flex items-center gap-4">
          <Avatar name={member.full_name} url={current.avatar_url} size={72} />
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => void onAvatarFile(e.target.files?.[0])}
            />
            <button type="button" className="btn btn-secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
              {current.avatar_url ? pp.changePhoto : pp.addPhoto}
            </button>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{pp.avatarHint}</p>
          </div>
        </div>

        <TextField
          label={pp.handle}
          hint={pp.handleHint}
          value={form.handle}
          onChange={(v) => {
            setServerError(null);
            set("handle", v.toLowerCase());
          }}
          dir="ltr"
          maxLength={LIMITS.handleMax}
          error={serverError ?? err(errors.handle)}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <TextField label={pp.titleEn} placeholder={pp.titlePlaceholderEn} value={form.title_en} onChange={(v) => set("title_en", v)} dir="ltr" maxLength={LIMITS.title} error={err(errors.title_en, LIMITS.title)} />
          <TextField label={pp.titleAr} placeholder={pp.titlePlaceholderAr} value={form.title_ar} onChange={(v) => set("title_ar", v)} dir="rtl" maxLength={LIMITS.title} error={err(errors.title_ar, LIMITS.title)} />
          <TextField label={pp.bioEn} value={form.bio_en} onChange={(v) => set("bio_en", v)} multiline dir="ltr" maxLength={LIMITS.bio} error={err(errors.bio_en, LIMITS.bio)} />
          <TextField label={pp.bioAr} value={form.bio_ar} onChange={(v) => set("bio_ar", v)} multiline dir="rtl" maxLength={LIMITS.bio} error={err(errors.bio_ar, LIMITS.bio)} />
        </div>

        <TextField
          label={pp.yearsExperience}
          value={form.years_experience}
          onChange={(v) => set("years_experience", v)}
          inputMode="numeric"
          maxLength={2}
          className="max-w-[200px]"
          error={err(errors.years_experience)}
        />

        <fieldset>
          <legend className="field-label">{pp.languages}</legend>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set([...LANGUAGE_OPTIONS, ...form.languages])).map((code) => {
              const on = form.languages.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("languages", toggleLanguage(form.languages, code))}
                  className={cn(
                    "focus-ring min-h-[36px] rounded-full border px-3 text-sm font-semibold transition-colors",
                    on
                      ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                      : "border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]",
                  )}
                >
                  {langName(code)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Switch checked={form.is_public} onChange={(v) => set("is_public", v)} label={pp.showOnProfile} description={pp.showOnProfileDesc} />
      </div>
    </Dialog>
  );
}

export default TeamProfiles;
