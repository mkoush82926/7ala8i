"use client";

import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Store,
  Users,
  X,
  AlertTriangle,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { createClient } from "@/lib/supabase/client";
import { invalidateShopSettings } from "@/hooks/use-dashboard-data";
import { invalidateDashboard } from "@/hooks/use-pos";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useTranslation, headingTracking, interpolate } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import {
  CURRENCIES,
  TIMEZONES,
  RANGES,
  SHOP_SETTINGS_COLUMNS,
  copyDayToWorkingDays,
  isFormDirty,
  isWeekDirty,
  parseSettingsTab,
  rowsToWeek,
  shopRowToForm,
  validateShopForm,
  validateWeek,
  weekToRows,
  type DayHours,
  type DayHoursError,
  type FieldError,
  type SettingsTab,
  type ShopField,
  type ShopForm,
  type ShopRow,
  type WorkingHoursRow,
} from "./settings-form";

/** Weekday order: Saturday-first in Arabic (Jordan), Monday-first in English. */
const DAY_ORDER: Record<"ar" | "en", number[]> = { ar: [6, 0, 1, 2, 3, 4, 5], en: [1, 2, 3, 4, 5, 6, 0] };

const card = "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]";
const iconBtn =
  "inline-flex size-11 lg:size-9 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

// Print-kit colours: the poster is always printed on white paper, so these
// are fixed ink values rather than theme tokens.
const PRINT = { ink: "#1c1611", mid: "#5a5147", rule: "#ede3cd", panel: "#f7f1e4", brass: "#7c5a26", paper: "#ffffff" };

const noopSubscribe = () => () => {};

export function SettingsPage() {
  const { t, locale, isRTL, FF, FFD, href, formatDate } = useTranslation();
  const st = t.settings;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = parseSettingsTab(searchParams.get("tab"));

  const shopId = useWorkspaceStore((s) => s.shopId);
  const shopName = useWorkspaceStore((s) => s.shopName);
  const role = useWorkspaceStore((s) => s.role);
  const userId = useWorkspaceStore((s) => s.userId);
  const barbers = useWorkspaceStore((s) => s.barbers);
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const refreshWorkspace = useWorkspaceStore((s) => s.refreshWorkspace);
  const isAdmin = role === "shop_admin";

  const [supabase] = useState(() => createClient());
  const uid = useId();
  const fieldId = (f: string) => `${uid}-${f}`;

  // ── Shop profile + booking policy (one row, one form) ──
  const [shopSnapshot, setShopSnapshot] = useState<ShopForm>(() => shopRowToForm(null, shopName));
  const [shopForm, setShopForm] = useState<ShopForm>(shopSnapshot);
  const [shopErrors, setShopErrors] = useState<Partial<Record<ShopField, FieldError>>>({});
  const [shopStatus, setShopStatus] = useState<"loading" | "ready" | "error">("loading");
  const [savingShop, setSavingShop] = useState(false);
  const shopDirty = isFormDirty(shopForm, shopSnapshot);

  const loadShop = useCallback(async () => {
    if (!shopId) {
      if (hydrated) setShopStatus("ready");
      return;
    }
    setShopStatus("loading");
    const [{ data, error }, privateRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("shops") as any).select(SHOP_SETTINGS_COLUMNS).eq("id", shopId).maybeSingle(),
      supabase.rpc("get_my_shop_private"),
    ]);
    if (error || !data) {
      setShopStatus("error");
      return;
    }
    const priv = ((privateRes.data ?? []) as { shop_id: string; daily_goal: number | null }[]).find(
      (r) => r.shop_id === shopId,
    );
    const form = shopRowToForm({ ...(data as ShopRow), daily_goal: priv?.daily_goal ?? null }, shopName);
    setShopSnapshot(form);
    setShopForm(form);
    setShopErrors({});
    setShopStatus("ready");
    // shopName is only a fallback for a missing name; don't refetch on rename.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, shopId, hydrated]);

  useEffect(() => {
    // Fetch on mount / shop change.
    void loadShop();
  }, [loadShop]);

  const setShopField = <K extends ShopField>(key: K, value: ShopForm[K]) => {
    setShopForm((f) => ({ ...f, [key]: value }));
    if (shopErrors[key]) setShopErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function saveShop(): Promise<boolean> {
    if (!shopId || !isAdmin || savingShop) return false;
    const { errors, update } = validateShopForm(shopForm);
    setShopErrors(errors);
    if (!update) {
      const first = (Object.keys(errors) as ShopField[])[0];
      // Jump to the tab that holds the first invalid field.
      const policyFields: ShopField[] = ["cancellation_policy_hours", "cancellation_fee_percent", "deposit_value"];
      const target: SettingsTab = policyFields.includes(first) ? "policy" : "general";
      if (view !== target) navigate(target);
      requestAnimationFrame(() => document.getElementById(fieldId(first))?.focus());
      toast.error(st.fixErrors);
      return false;
    }
    setSavingShop(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("shops") as any).update(update).eq("id", shopId);
    setSavingShop(false);
    if (error) {
      toast.error(st.saveFailed);
      return false;
    }
    const saved = shopRowToForm(update as ShopRow, shopName);
    setShopSnapshot(saved);
    setShopForm(saved);
    toast.success(st.saved);
    // Name, currency and time zone are used across the app shell, and the
    // overview widgets cache currency / daily goal.
    invalidateShopSettings(shopId);
    invalidateDashboard();
    void refreshWorkspace();
    return true;
  }

  // ── Working hours (per team member) ──
  const [selectedBarber, setSelectedBarber] = useState<string>("");
  const effectiveBarber = isAdmin ? selectedBarber || barbers[0]?.id || userId || "" : userId || "";
  const [weekSnapshot, setWeekSnapshot] = useState<DayHours[]>(() => rowsToWeek([]));
  const [week, setWeek] = useState<DayHours[]>(weekSnapshot);
  const [weekErrors, setWeekErrors] = useState<Record<number, DayHoursError>>({});
  const [hoursStatus, setHoursStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [savingHours, setSavingHours] = useState(false);
  const hoursDirty = isWeekDirty(week, weekSnapshot);
  const hoursRequest = useRef(0);

  const loadHours = useCallback(async () => {
    if (!effectiveBarber) return;
    const id = ++hoursRequest.current;
    setHoursStatus("loading");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("working_hours") as any)
      .select("day_of_week, start_time, end_time, is_working, break_start, break_end")
      .eq("barber_id", effectiveBarber);
    if (id !== hoursRequest.current) return;
    if (error) {
      setHoursStatus("error");
      return;
    }
    const loaded = rowsToWeek((data ?? []) as WorkingHoursRow[]);
    setWeekSnapshot(loaded);
    setWeek(loaded);
    setWeekErrors({});
    setHoursStatus("ready");
  }, [supabase, effectiveBarber]);

  useEffect(() => {
    if (view !== "hours") return;
    // Fetch when the hours tab opens or the selected team member changes.
    void loadHours();
  }, [view, loadHours]);

  const updateDay = (day: number, patch: Partial<DayHours>) => {
    setWeek((w) => w.map((d) => (d.day === day ? { ...d, ...patch } : d)));
    if (weekErrors[day] !== undefined) {
      setWeekErrors((e) => {
        const next = { ...e };
        delete next[day];
        return next;
      });
    }
  };

  async function saveHours(): Promise<boolean> {
    if (!effectiveBarber || savingHours) return false;
    const errors = validateWeek(week);
    setWeekErrors(errors);
    const firstBad = Object.keys(errors)[0];
    if (firstBad !== undefined) {
      document.getElementById(fieldId(`day-${firstBad}-start`))?.focus();
      toast.error(st.fixErrors);
      return false;
    }
    setSavingHours(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("working_hours") as any).upsert(weekToRows(effectiveBarber, week), {
      onConflict: "barber_id,day_of_week",
    });
    setSavingHours(false);
    if (error) {
      toast.error(st.saveFailed);
      return false;
    }
    setWeekSnapshot(week);
    toast.success(st.hoursSaved);
    return true;
  }

  // ── Dirty state, navigation and the unsaved-changes guard ──
  const formOf = (v: SettingsTab | null) => (v === "general" || v === "policy" ? "shop" : v === "hours" ? "hours" : null);
  const currentForm = formOf(view);
  const dirty = (currentForm === "shop" && shopDirty) || (currentForm === "hours" && hoursDirty);
  const saving = savingShop || savingHours;
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  function navigate(target: SettingsTab | null) {
    router.push(target ? `${pathname}?tab=${target}` : pathname, { scroll: false });
  }

  function discard() {
    if (currentForm === "shop") {
      setShopForm(shopSnapshot);
      setShopErrors({});
    } else if (currentForm === "hours") {
      setWeek(weekSnapshot);
      setWeekErrors({});
    }
  }

  /** Runs `action`, asking first when it would drop unsaved edits. */
  function guard(action: () => void, leavesForm = true) {
    if (dirty && leavesForm) setPendingAction(() => action);
    else action();
  }

  const goTo = (target: SettingsTab | null) => guard(() => navigate(target), formOf(target) !== currentForm);

  useEffect(() => {
    if (!shopDirty && !hoursDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [shopDirty, hoursDirty]);

  const save = () => (currentForm === "shop" ? saveShop() : currentForm === "hours" ? saveHours() : Promise.resolve(false));

  // Ctrl/Cmd+S saves the current form.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    if (!currentForm) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentForm]);

  // ── Booking link + QR ──
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const bookingLink = `${origin}/${locale}/shop/${shopId}`;
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const posterQrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      toast.success(st.linkCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(st.copyFailed);
    }
  }

  function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  const displayShopName = (shopSnapshot.name || shopName || "Halaqy").trim();

  function handleDownloadPoster() {
    const qrSource = posterQrCanvasRef.current;
    if (!qrSource) return;
    const W = 600;
    const H = 900;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.direction = isRTL ? "rtl" : "ltr";

    const fit = (text: string, weight: number, maxWidth: number, start: number, min: number) => {
      let size = start;
      while (size > min) {
        ctx.font = `${weight} ${size}px sans-serif`;
        if (ctx.measureText(text).width <= maxWidth) break;
        size -= 1;
      }
      return size;
    };

    ctx.fillStyle = PRINT.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = PRINT.rule;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    ctx.fillStyle = PRINT.ink;
    ctx.fillRect(0, 0, W, 110);
    ctx.fillStyle = PRINT.paper;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 28px sans-serif";
    ctx.fillText("Halaqy", W / 2, 55);

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = PRINT.ink;
    ctx.font = `800 ${fit(displayShopName, 800, 500, 34, 20)}px sans-serif`;
    ctx.fillText(displayShopName, W / 2, 178);

    ctx.fillStyle = PRINT.mid;
    ctx.font = "600 17px sans-serif";
    ctx.fillText(st.posterTagline, W / 2, 212);

    const box = 420;
    const boxX = (W - box) / 2;
    const boxY = 250;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, box, box, 16);
    ctx.fillStyle = PRINT.panel;
    ctx.fill();
    ctx.strokeStyle = PRINT.rule;
    ctx.lineWidth = 1;
    ctx.stroke();
    const qr = 360;
    ctx.drawImage(qrSource, boxX + (box - qr) / 2, boxY + (box - qr) / 2, qr, qr);

    ctx.direction = "ltr";
    ctx.fillStyle = PRINT.brass;
    ctx.font = `600 ${fit(bookingLink, 600, 500, 16, 11)}px sans-serif`;
    ctx.fillText(bookingLink, W / 2, 710);
    ctx.direction = isRTL ? "rtl" : "ltr";

    ctx.strokeStyle = PRINT.rule;
    ctx.beginPath();
    ctx.moveTo(80, 750);
    ctx.lineTo(W - 80, 750);
    ctx.stroke();

    ctx.fillStyle = PRINT.mid;
    ctx.font = "500 14px sans-serif";
    ctx.fillText(st.posterInstruction, W / 2, 792);

    const safeName = displayShopName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    downloadCanvas(canvas, `${safeName || "booking"}-print-kit.png`);
  }

  // ── Labels ──
  const tabs: { id: SettingsTab; label: string; description: string; icon: typeof Store }[] = [
    { id: "general", label: st.general, description: st.generalDesc, icon: Store },
    { id: "policy", label: st.policy, description: st.policyDesc, icon: CalendarClock },
    { id: "hours", label: st.hours, description: st.hoursDesc, icon: Clock },
    { id: "booking", label: st.bookingLink, description: st.bookingLinkHubDesc, icon: Link2 },
    { id: "team", label: st.team, description: st.teamDesc, icon: Users },
  ];
  const activeTab = tabs.find((tb) => tb.id === view) ?? null;

  const errorText = (field: ShopField, code: FieldError | undefined) => {
    if (!code) return undefined;
    switch (code) {
      case "name": return st.errName;
      case "description": return st.errDescription;
      case "email": return st.errEmail;
      case "phone": return st.errPhone;
      case "url": return st.errUrl;
      case "instagram": return st.errInstagram;
      case "range": {
        const r =
          field === "deposit_value" && shopForm.deposit_type === "percentage"
            ? { min: 0, max: 100 }
            : RANGES[field as keyof typeof RANGES] ?? { min: 0, max: 100000 };
        return interpolate(st.errNumber, { min: r.min, max: r.max });
      }
    }
  };

  const dayOrder = DAY_ORDER[locale === "ar" ? "ar" : "en"];
  // 2026-01-04 is a Sunday → index = weekday.
  const dayName = useCallback(
    (wd: number) => formatDate(new Date(2026, 0, 4 + wd, 12), { weekday: "long" }),
    [formatDate],
  );

  const roleLabel = (r: string) => (r === "shop_admin" ? st.roleAdmin : st.roleBarber);
  const staffOptions = useMemo(() => barbers.map((b) => ({ id: b.id, name: b.name || roleLabel(b.role) })), [barbers]); // eslint-disable-line react-hooks/exhaustive-deps

  const text = (field: ShopField, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) =>
    function renderTextInput(a11y: FieldA11y) {
      return (
        <input
          {...a11y}
          {...extra}
          className="field-input"
          value={shopForm[field] as string}
          onChange={(e) => setShopField(field, e.target.value as never)}
        />
      );
    };

  // ── Render ──
  if (hydrated && !shopId) {
    return <EmptyState icon={Store} size="lg" title={st.noShopTitle} description={st.noShopDesc} />;
  }

  const readOnly = !isAdmin;
  const sectionTitle = "m-0 text-base font-bold text-[var(--text-primary)]";

  const shopBody = (children: React.ReactNode) =>
    shopStatus === "loading" || !hydrated ? (
      <ListSkeleton rows={4} />
    ) : shopStatus === "error" ? (
      <EmptyState
        tone="error"
        icon={AlertTriangle}
        title={st.loadFailed}
        action={{ label: t.common.retry, onClick: () => void loadShop(), icon: RefreshCw }}
      />
    ) : (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void saveShop();
        }}
        noValidate
        className="flex flex-col gap-6"
      >
        {readOnly && (
          <p role="note" className="rounded-lg bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            {st.readOnlyNotice}
          </p>
        )}
        <FieldContext.Provider value={{ fieldId, errorFor: (f) => errorText(f, shopErrors[f]) }}>
          <fieldset disabled={readOnly || savingShop} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0">
            {children}
          </fieldset>
        </FieldContext.Provider>
      </form>
    );

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {activeTab && (
            <button
              type="button"
              onClick={() => goTo(null)}
              aria-label={st.backToSettings}
              className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)]"
            >
              <ArrowLeft size={16} aria-hidden className="rtl:-scale-x-100" />
            </button>
          )}
          <div className="min-w-0">
            <h2
              className="m-0 text-[24px] font-extrabold text-[var(--text-primary)] sm:text-[28px]"
              style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "0.014em") }}
            >
              {activeTab ? activeTab.label : st.title}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{activeTab ? activeTab.description : st.subtitle}</p>
          </div>
        </div>
        {currentForm && (isAdmin || currentForm === "hours") && (
          <button
            type="button"
            className="btn btn-primary hidden min-h-11 px-5 sm:inline-flex"
            onClick={() => void save()}
            disabled={saving || !dirty}
            aria-busy={saving || undefined}
          >
            {saving ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
            {st.saveChanges}
          </button>
        )}
      </div>

      {/* ── Hub ── */}
      {!activeTab && (
        <nav aria-label={st.title} className={cn(card, "overflow-hidden")}>
          <ul role="list" className="m-0 list-none p-0">
            {tabs.map((tab) => (
              <li key={tab.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => goTo(tab.id)}
                  className="flex w-full cursor-pointer items-center gap-4 bg-transparent px-4 py-4 text-start transition-colors hover:bg-[var(--bg-secondary)] focus-visible:bg-[var(--bg-secondary)] sm:px-6"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                    <tab.icon size={18} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[var(--text-primary)]">{tab.label}</span>
                    <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{tab.description}</span>
                  </span>
                  <ChevronRight size={18} aria-hidden className="shrink-0 text-[var(--text-muted)] rtl:-scale-x-100" />
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* ── General ── */}
      {view === "general" &&
        shopBody(
          <>
            <section className={cn(card, "p-5 sm:p-8")} aria-labelledby={fieldId("sec-info")}>
              <h3 id={fieldId("sec-info")} className={cn(sectionTitle, "mb-5")} style={{ fontFamily: FF }}>
                {st.shopInfo}
              </h3>
              <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                <Field field="name" label={st.shopName} className="md:col-span-2">
                  {text("name", { type: "text", maxLength: 100, autoComplete: "organization", required: true })}
                </Field>
                <Field field="description" label={st.shopDescription} className="md:col-span-2">
                  {(a11y) => (
                    <textarea
                      {...a11y}
                      className="field-input min-h-[96px] resize-y"
                      rows={3}
                      maxLength={500}
                      value={shopForm.description}
                      onChange={(e) => setShopField("description", e.target.value)}
                    />
                  )}
                </Field>
                <Field field="address" label={st.address} className="md:col-span-2">
                  {text("address", { type: "text", maxLength: 200, autoComplete: "street-address" })}
                </Field>
                <Field field="google_maps_url" label={st.mapsUrl} className="md:col-span-2">
                  {text("google_maps_url", { type: "url", inputMode: "url", dir: "ltr", placeholder: "https://maps.app.goo.gl/…" })}
                </Field>
              </div>
            </section>

            <section className={cn(card, "p-5 sm:p-8")} aria-labelledby={fieldId("sec-contact")}>
              <h3 id={fieldId("sec-contact")} className={cn(sectionTitle, "mb-5")} style={{ fontFamily: FF }}>
                {st.contactSection}
              </h3>
              <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                <Field field="phone" label={st.phone}>
                  {text("phone", { type: "tel", inputMode: "tel", autoComplete: "tel", dir: "ltr", maxLength: 20 })}
                </Field>
                <Field field="whatsapp" label={st.whatsapp}>
                  {text("whatsapp", { type: "tel", inputMode: "tel", dir: "ltr", maxLength: 20, placeholder: "+962 7…" })}
                </Field>
                <Field field="email" label={st.contactEmail}>
                  {text("email", { type: "email", inputMode: "email", autoComplete: "email", dir: "ltr", maxLength: 254 })}
                </Field>
                <Field field="instagram" label={st.instagram} hint={st.instagramHint}>
                  {text("instagram", { type: "text", dir: "ltr", autoCapitalize: "none", spellCheck: false, maxLength: 60 })}
                </Field>
              </div>
            </section>

            <section className={cn(card, "p-5 sm:p-8")} aria-labelledby={fieldId("sec-region")}>
              <h3 id={fieldId("sec-region")} className={cn(sectionTitle, "mb-5")} style={{ fontFamily: FF }}>
                {st.regionSection}
              </h3>
              <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                <Field field="currency" label={st.currency}>
                  {(a11y) => (
                    <select
                      {...a11y}
                      className="field-input"
                      value={shopForm.currency}
                      onChange={(e) => setShopField("currency", e.target.value)}
                    >
                      {[...new Set([shopForm.currency, ...CURRENCIES])].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field field="timezone" label={st.timezone} hint={st.timezoneHint}>
                  {(a11y) => (
                    <select
                      {...a11y}
                      className="field-input"
                      dir="ltr"
                      value={shopForm.timezone}
                      onChange={(e) => setShopField("timezone", e.target.value)}
                    >
                      {[...new Set([shopForm.timezone, ...TIMEZONES])].map((tz) => (
                        <option key={tz} value={tz}>
                          {tz.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field field="daily_goal" label={`${st.dailyGoal} (${shopForm.currency})`} hint={st.dailyGoalHint}>
                  {text("daily_goal", { type: "number", inputMode: "decimal", min: 0, step: "1" })}
                </Field>
              </div>
            </section>
          </>,
        )}

      {/* ── Booking & payments policy ── */}
      {view === "policy" &&
        shopBody(
          <>
            <section className={cn(card, "p-5 sm:p-8")} aria-labelledby={fieldId("sec-cancel")}>
              <h3 id={fieldId("sec-cancel")} className={cn(sectionTitle, "mb-5")} style={{ fontFamily: FF }}>
                {st.cancellationSection}
              </h3>
              <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                <Field field="cancellation_policy_hours" label={st.cancellationHours} hint={st.cancellationHoursHint}>
                  {text("cancellation_policy_hours", { type: "number", inputMode: "numeric", min: 0, max: 168, step: "1" })}
                </Field>
                <Field field="cancellation_fee_percent" label={st.cancellationFee}>
                  {text("cancellation_fee_percent", { type: "number", inputMode: "decimal", min: 0, max: 100, step: "1" })}
                </Field>
              </div>
            </section>

            <section className={cn(card, "p-5 sm:p-8")} aria-labelledby={fieldId("sec-deposit")}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 id={fieldId("sec-deposit")} className={sectionTitle} style={{ fontFamily: FF }}>
                    {st.requireDeposit}
                  </h3>
                  <p id={fieldId("deposit-hint")} className="mt-1 text-xs text-[var(--text-muted)]">
                    {st.requireDepositHint}
                  </p>
                </div>
                <Switch
                  checked={shopForm.require_deposit}
                  onChange={(v) => setShopField("require_deposit", v)}
                  label={st.requireDeposit}
                  describedBy={fieldId("deposit-hint")}
                />
              </div>
              {shopForm.require_deposit && (
                <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                  <fieldset className="m-0 min-w-0 border-0 p-0">
                    <legend className="field-label">{st.depositType}</legend>
                    <div className="flex flex-wrap gap-2">
                      {(["percentage", "fixed"] as const).map((dt) => (
                        <label
                          key={dt}
                          className={cn(
                            "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus-ring)]",
                            shopForm.deposit_type === dt
                              ? "border-[var(--accent-brass)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                              : "border-[var(--border-subtle)] text-[var(--text-secondary)]",
                          )}
                        >
                          <input
                            type="radio"
                            name={fieldId("deposit_type")}
                            value={dt}
                            checked={shopForm.deposit_type === dt}
                            onChange={() => setShopField("deposit_type", dt)}
                            className="accent-[var(--accent-brass)]"
                          />
                          {dt === "percentage" ? st.depositPercentage : st.depositFixed}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <Field
                    field="deposit_value"
                    label={`${st.depositValue} (${shopForm.deposit_type === "percentage" ? "%" : shopForm.currency})`}
                  >
                    {text("deposit_value", { type: "number", inputMode: "decimal", min: 0, step: "0.5" })}
                  </Field>
                </div>
              )}
            </section>
          </>,
        )}

      {/* ── Working hours ── */}
      {view === "hours" && (
        <section className={cn(card, "p-4 sm:p-8")} aria-labelledby={fieldId("sec-hours")}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <h3 id={fieldId("sec-hours")} className={sectionTitle} style={{ fontFamily: FF }}>
              {st.hours}
            </h3>
            {isAdmin && staffOptions.length > 1 && (
              <div className="w-full sm:w-64">
                <label htmlFor={fieldId("staff")} className="field-label">
                  {st.staffMember}
                </label>
                <select
                  id={fieldId("staff")}
                  className="field-input"
                  value={effectiveBarber}
                  disabled={savingHours}
                  onChange={(e) => {
                    const next = e.target.value;
                    guard(() => setSelectedBarber(next), hoursDirty);
                  }}
                >
                  {staffOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!effectiveBarber ? (
            <EmptyState bare size="sm" icon={Users} title={st.noStaff} />
          ) : hoursStatus === "error" ? (
            <EmptyState
              bare
              tone="error"
              size="sm"
              icon={AlertTriangle}
              title={st.loadFailed}
              action={{ label: t.common.retry, onClick: () => void loadHours(), icon: RefreshCw }}
            />
          ) : hoursStatus !== "ready" ? (
            <ListSkeleton rows={7} />
          ) : (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void saveHours();
              }}
            >
              <fieldset disabled={savingHours} className="m-0 min-w-0 border-0 p-0">
                <legend className="sr-only">{st.hours}</legend>
                <ul role="list" className="m-0 flex list-none flex-col p-0">
                  {dayOrder.map((wd) => {
                    const d = week[wd];
                    const name = dayName(wd);
                    const err = weekErrors[wd];
                    const errId = fieldId(`day-${wd}-error`);
                    return (
                      <li
                        key={wd}
                        className="flex flex-col gap-3 border-b border-[var(--border-subtle)] py-4 first:pt-0 last:border-b-0 last:pb-0 lg:flex-row lg:items-start lg:gap-6"
                      >
                        <div className="flex items-center justify-between gap-3 lg:w-48 lg:shrink-0 lg:pt-2">
                          <span className="text-sm font-bold text-[var(--text-primary)]">{name}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-[var(--text-muted)]" aria-hidden>
                              {d.isWorking ? st.open : st.dayOff}
                            </span>
                            <Switch
                              checked={d.isWorking}
                              onChange={(v) => updateDay(wd, { isWorking: v })}
                              label={`${name}: ${st.open}`}
                            />
                          </span>
                        </div>

                        {d.isWorking && (
                          <div className="flex min-w-0 flex-1 flex-col gap-3">
                            <div className="flex flex-wrap items-end gap-3">
                              <TimeField
                                id={fieldId(`day-${wd}-start`)}
                                label={st.opens}
                                value={d.start}
                                invalid={err === "order"}
                                describedBy={err ? errId : undefined}
                                onChange={(v) => updateDay(wd, { start: v })}
                              />
                              <TimeField
                                id={fieldId(`day-${wd}-end`)}
                                label={st.closes}
                                value={d.end}
                                invalid={err === "order"}
                                describedBy={err ? errId : undefined}
                                onChange={(v) => updateDay(wd, { end: v })}
                              />
                              <button
                                type="button"
                                className={iconBtn}
                                onClick={() => setWeek((w) => copyDayToWorkingDays(w, wd))}
                                aria-label={`${st.copyToAll}: ${name}`}
                                title={st.copyToAll}
                              >
                                <Copy size={15} aria-hidden />
                              </button>
                            </div>

                            {d.hasBreak ? (
                              <div className="flex flex-wrap items-end gap-3">
                                <TimeField
                                  id={fieldId(`day-${wd}-bstart`)}
                                  label={st.breakStart}
                                  value={d.breakStart}
                                  invalid={err === "break"}
                                  describedBy={err ? errId : undefined}
                                  onChange={(v) => updateDay(wd, { breakStart: v })}
                                />
                                <TimeField
                                  id={fieldId(`day-${wd}-bend`)}
                                  label={st.breakEnd}
                                  value={d.breakEnd}
                                  invalid={err === "break"}
                                  describedBy={err ? errId : undefined}
                                  onChange={(v) => updateDay(wd, { breakEnd: v })}
                                />
                                <button
                                  type="button"
                                  className={cn(iconBtn, "hover:text-[var(--accent-rose)]")}
                                  onClick={() => updateDay(wd, { hasBreak: false })}
                                  aria-label={`${st.removeBreak}: ${name}`}
                                  title={st.removeBreak}
                                >
                                  <X size={15} aria-hidden />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-[var(--accent-text)] hover:bg-[var(--bg-secondary)] lg:min-h-9"
                                onClick={() => updateDay(wd, { hasBreak: true })}
                                aria-label={`${st.addBreak}: ${name}`}
                              >
                                <Plus size={14} aria-hidden />
                                {st.addBreak}
                              </button>
                            )}

                            {err && (
                              <p id={errId} className="field-error m-0" role="alert">
                                {err === "order" ? st.errHoursOrder : st.errBreak}
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            </form>
          )}
        </section>
      )}

      {/* ── Booking link ── */}
      {view === "booking" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          <section
            className="flex min-h-[240px] min-w-0 flex-col justify-between gap-6 rounded-xl bg-[var(--text-primary)] p-6 text-[var(--bg-primary)] sm:p-10"
            aria-labelledby={fieldId("sec-link")}
          >
            <div className="min-w-0">
              <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--bg-primary)_12%,transparent)] px-3 py-1 text-[11px] font-bold">
                <span className="size-1.5 rounded-full bg-[var(--accent-brass)]" aria-hidden />
                <span id={fieldId("sec-link")}>{st.onlineBookingLink}</span>
              </span>
              <p className="m-0 break-all text-lg font-extrabold sm:text-2xl" dir="ltr" style={{ fontFamily: "var(--font-intervar), sans-serif" }}>
                {bookingLink}
              </p>
              <p className="mt-3 text-sm opacity-80">{st.bookingLinkDesc}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void handleCopy()} className="btn btn-secondary min-h-11" disabled={!shopId}>
                {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                {copied ? st.linkCopied : st.copyLink}
              </button>
              <a
                href={bookingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold underline-offset-4 opacity-90 hover:underline"
              >
                {st.viewPage}
                <ExternalLink size={14} aria-hidden className="rtl:-scale-x-100" />
              </a>
            </div>
          </section>

          <section className={cn(card, "flex flex-col items-center justify-center p-6 text-center sm:p-8")} aria-labelledby={fieldId("sec-qr")}>
            <div className="mb-5 rounded-xl bg-white p-4">
              <QRCodeCanvas ref={qrCanvasRef} value={bookingLink} size={128} role="img" aria-label={st.qrAlt} />
            </div>
            <div className="hidden" aria-hidden>
              <QRCodeCanvas ref={posterQrCanvasRef} value={bookingLink} size={480} />
            </div>
            <h3 id={fieldId("sec-qr")} className="m-0 text-sm font-bold text-[var(--text-primary)]">
              {st.qrTitle}
            </h3>
            <p className="mb-4 mt-1 text-xs text-[var(--text-secondary)]">{st.qrHint}</p>
            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                className="btn btn-secondary min-h-11 w-full"
                onClick={() => qrCanvasRef.current && downloadCanvas(qrCanvasRef.current, "booking-qr-code.png")}
              >
                <Download size={15} aria-hidden />
                {st.downloadQr}
              </button>
              <button type="button" className="btn btn-secondary min-h-11 w-full" onClick={handleDownloadPoster}>
                <Printer size={15} aria-hidden />
                {st.downloadPoster}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Team (managed on the Team page) ── */}
      {view === "team" && (
        <section className={cn(card, "overflow-hidden")} aria-labelledby={fieldId("sec-team")}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-4 sm:px-6">
            <div>
              <h3 id={fieldId("sec-team")} className={sectionTitle} style={{ fontFamily: FF }}>
                {st.teamMembers}
              </h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{st.teamManageHint}</p>
            </div>
            <Link href={href("/team")} className="btn btn-primary min-h-11">
              <Users size={15} aria-hidden />
              {st.manageTeam}
            </Link>
          </div>
          {barbers.length === 0 ? (
            <EmptyState bare size="sm" icon={Users} title={st.noStaff} />
          ) : (
            <ul role="list" className="m-0 list-none p-0">
              {barbers.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-4 py-4 last:border-b-0 sm:px-6"
                >
                  <span
                    aria-hidden
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-sm font-bold text-[var(--text-secondary)]"
                  >
                    {(member.name || "?").trim().slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[var(--text-primary)]">
                      {member.name || roleLabel(member.role)}
                    </span>
                    <span className="block text-xs text-[var(--text-secondary)]">{roleLabel(member.role)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Unsaved changes bar ── */}
      {dirty && (
        <div
          role="region"
          aria-label={st.unsavedChanges}
          className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.25)] sm:mx-0 sm:rounded-xl sm:border sm:px-5"
        >
          <p className="m-0 text-sm font-semibold text-[var(--text-primary)]" aria-live="polite">
            {st.unsavedChanges}
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <button type="button" className="btn btn-secondary min-h-11 flex-1 sm:flex-none" onClick={discard} disabled={saving}>
              {st.discard}
            </button>
            <button
              type="button"
              className="btn btn-primary min-h-11 flex-1 sm:flex-none"
              onClick={() => void save()}
              disabled={saving}
              aria-busy={saving || undefined}
            >
              {saving ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
              {saving ? t.common.processing : st.saveChanges}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={() => {
          const action = pendingAction;
          discard();
          setPendingAction(null);
          action?.();
        }}
        destructive
        title={st.discardTitle}
        description={st.discardDesc}
        confirmLabel={st.discard}
        cancelLabel={st.keepEditing}
      />
    </div>
  );
}

// ─── Small controls ───

type FieldA11y = { id: string; "aria-invalid"?: true; "aria-describedby"?: string };

const FieldContext = createContext<{ fieldId: (f: string) => string; errorFor: (f: ShopField) => string | undefined }>({
  fieldId: (f) => f,
  errorFor: () => undefined,
});

/** Label + control + hint/error wiring for a shop form field. */
function Field({
  field, label, hint, children, className,
}: {
  field: ShopField;
  label: string;
  hint?: string;
  children: (a11y: FieldA11y) => React.ReactNode;
  className?: string;
}) {
  const { fieldId, errorFor } = useContext(FieldContext);
  const id = fieldId(field);
  const err = errorFor(field);
  const describedBy = [hint ? `${id}-hint` : null, err ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children({ id, "aria-invalid": err ? true : undefined, "aria-describedby": describedBy })}
      {hint && !err && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-[var(--text-muted)]">
          {hint}
        </p>
      )}
      {err && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}

function Switch({
  checked, onChange, label, describedBy,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-block h-6 w-11 rounded-full transition-colors",
          checked ? "bg-[var(--accent-mint)]" : "bg-[var(--border-primary)]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-[var(--bg-primary)] shadow transition-all",
            checked ? "start-[22px]" : "start-0.5",
          )}
        />
      </span>
    </button>
  );
}

function TimeField({
  id, label, value, invalid, describedBy, onChange,
}: {
  id: string;
  label: string;
  value: string;
  invalid?: boolean;
  describedBy?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="w-[calc(50%-0.375rem)] min-w-[120px] sm:w-36">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        type="time"
        step={300}
        dir="ltr"
        className="field-input"
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
