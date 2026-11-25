"use client";

// /start — owner sign-up and onboarding wizard (WS-1G).
//
// Account → Shop → Location → Services → Team → Hours → Publish → Share.
// After the account exists, every change is autosaved to
// onboarding_progress (save_onboarding_progress), so a refresh resumes where
// the owner left off. Publishing calls create_shop_from_wizard, which writes
// everything in one transaction.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CloudOff, Loader2, LogOut, RefreshCw, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslation, interpolate, headingTracking } from "@/hooks/use-translation";
import { logout } from "../../auth/actions";
import {
  WIZARD_STEPS,
  buildPayload,
  createDraft,
  firstInvalidStep,
  nextStep,
  prevStep,
  restoreDraft,
  resumeStep,
  stepForErrorDetail,
  stepIndex,
  validateStep,
  wizardErrorCode,
  type OnboardingState,
  type StepErrors,
  type WizardDraft,
  type WizardStep,
} from "../_lib/wizard";
import { StepAccount } from "./step-account";
import { StepShop } from "./step-shop";
import { StepLocation } from "./step-location";
import { StepServices } from "./step-services";
import { StepTeam } from "./step-team";
import { StepHours } from "./step-hours";
import { StepPublish } from "./step-publish";
import { ShareScreen } from "./share-screen";

export interface CityOption {
  id: string;
  slug_en: string;
  name_en: string;
  name_ar: string;
  lat: number | null;
  lng: number | null;
}

export interface AreaOption {
  id: string;
  city_id: string;
  name_en: string;
  name_ar: string;
  lat: number | null;
  lng: number | null;
}

interface StartWizardProps {
  signedIn: boolean;
  initialState: OnboardingState | null;
  loadError: boolean;
  cities: CityOption[];
  areas: AreaOption[];
  phoneAuth: boolean;
}

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string; details?: string } | null }>;
};

const AUTOSAVE_MS = 1200;

// ─── Page frame ────────────────────────────────────────────────────────────

function Frame({
  children,
  progress,
  saveStatus,
  footer,
}: {
  children: React.ReactNode;
  progress?: { index: number; total: number; label: string } | null;
  saveStatus?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t, dir, FF, href, isRTL, FFD } = useTranslation();
  const s = t.start;
  return (
    <div dir={dir} className="flex min-h-[100dvh] flex-col" style={{ background: "var(--bg-primary)", fontFamily: FF }}>
      <header className="sticky top-0 z-20 border-b" style={{ background: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}>
        <div className="mx-auto flex h-14 w-full max-w-xl items-center justify-between gap-3 px-4">
          <Link
            href={href("/for-business")}
            className="text-[18px] font-extrabold"
            style={{ fontFamily: FFD, letterSpacing: headingTracking(isRTL, "-0.01em"), color: "var(--text-primary)" }}
          >
            {s.brand}
          </Link>
          <div className="text-[13px]" style={{ color: "var(--text-muted)" }} aria-live="polite">
            {saveStatus}
          </div>
        </div>
        {progress && (
          <div className="mx-auto w-full max-w-xl px-4 pb-3">
            <div className="mb-1.5 flex justify-between text-[12px]" style={{ color: "var(--text-muted)" }}>
              <span>{progress.label}</span>
              <span>{interpolate(s.stepOf, { current: progress.index + 1, total: progress.total })}</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={progress.total}
              aria-valuenow={progress.index + 1}
              aria-label={s.progressLabel}
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: "var(--border-subtle)" }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${((progress.index + 1) / progress.total) * 100}%`, background: "var(--accent-brass)" }}
              />
            </div>
          </div>
        )}
      </header>
      <main id="main-content" className="mx-auto w-full max-w-xl flex-1 px-4 pb-32 pt-6">
        {children}
      </main>
      {footer && (
        <div
          className="fixed inset-x-0 bottom-0 z-20 border-t"
          style={{ background: "var(--bg-primary)", borderColor: "var(--border-subtle)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-3">{footer}</div>
        </div>
      )}
    </div>
  );
}

// ─── Entry: decide what to show ────────────────────────────────────────────

export function StartWizard({ signedIn, initialState, loadError, cities, areas, phoneAuth }: StartWizardProps) {
  const { t, href, locale } = useTranslation();
  const s = t.start;
  const router = useRouter();
  const [done, setDone] = useState<{ slug: string; marketplaceVisible: boolean; name: string } | null>(null);

  if (done) {
    return (
      <Frame>
        <ShareScreen slug={done.slug} shopName={done.name} celebrate marketplaceVisible={done.marketplaceVisible} />
      </Frame>
    );
  }

  if (loadError) {
    return (
      <Frame>
        <EmptyState
          icon={CloudOff}
          tone="error"
          title={s.loadErrorTitle}
          description={s.loadErrorBody}
          action={{ label: t.common.retry, onClick: () => router.refresh() }}
        />
      </Frame>
    );
  }

  if (!signedIn) {
    return (
      <Frame progress={{ index: 0, total: WIZARD_STEPS.length + 1, label: s.steps.account }}>
        <StepAccount phoneAuth={phoneAuth} />
      </Frame>
    );
  }

  const state = initialState;
  if (!state || state.role !== "shop_admin") {
    return (
      <Frame>
        <EmptyState
          icon={Store}
          title={s.notOwner.title}
          description={state?.role === "barber" ? s.notOwner.barberBody : s.notOwner.customerBody}
        />
        <form action={logout} className="mt-2 flex flex-col items-center gap-3">
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="btn btn-primary">
            <LogOut size={18} aria-hidden />
            {s.notOwner.signOut}
          </button>
          <Link href={href(state?.role === "barber" ? "/my-day" : "/customer")} className="btn btn-ghost">
            {s.notOwner.back}
          </Link>
        </form>
      </Frame>
    );
  }

  const shopName =
    (locale === "ar" ? state.shop?.name_ar || state.shop?.name : state.shop?.name || state.shop?.name_ar) ?? "";

  // Finished (or an already-live shop): go straight to the share screen.
  if (state.shop?.slug && (state.progress?.completed_at || (state.shop.is_published && !state.eligible))) {
    return (
      <Frame>
        <ShareScreen
          slug={state.shop.slug}
          shopName={shopName}
          celebrate={false}
          marketplaceVisible={state.shop.marketplace_visible}
        />
      </Frame>
    );
  }

  if (!state.eligible) {
    return (
      <Frame>
        <EmptyState
          icon={Store}
          title={s.alreadySetUp.title}
          description={s.alreadySetUp.body}
          action={{ label: s.alreadySetUp.cta, href: href("/settings") }}
        />
      </Frame>
    );
  }

  return (
    <Wizard
      state={state}
      cities={cities}
      areas={areas}
      onDone={(slug, marketplaceVisible, name) => setDone({ slug, marketplaceVisible, name })}
    />
  );
}

// ─── The wizard proper ─────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

function Wizard({
  state,
  cities,
  areas,
  onDone,
}: {
  state: OnboardingState;
  cities: CityOption[];
  areas: AreaOption[];
  onDone: (slug: string, marketplaceVisible: boolean, name: string) => void;
}) {
  const { t, locale } = useTranslation();
  const s = t.start;
  const router = useRouter();
  const supabase = useMemo(() => createClient() as unknown as RpcClient, []);

  const initial = useMemo(() => {
    const base = createDraft(state);
    const draft = restoreDraft(state.progress?.data, base);
    return { draft, step: resumeStep(state.progress?.step, draft) };
  }, [state]);

  const [draft, setDraft] = useState<WizardDraft>(initial.draft);
  const [step, setStep] = useState<WizardStep>(initial.step);
  const [errors, setErrors] = useState<StepErrors>({});
  const [showErrors, setShowErrors] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const latest = useRef({ draft, step });
  latest.current = { draft, step };

  const update = useCallback((fn: (d: WizardDraft) => WizardDraft) => {
    dirty.current = true;
    setDraft((d) => fn(d));
  }, []);

  // Live re-validation once the owner has tried to continue.
  useEffect(() => {
    if (showErrors) setErrors(validateStep(step, draft));
  }, [draft, step, showErrors]);

  const persist = useCallback(
    async (stepToSave: WizardStep, data: WizardDraft): Promise<boolean> => {
      setSave("saving");
      const { error } = await supabase.rpc("save_onboarding_progress", { p_step: stepToSave, p_data: data });
      if (error) {
        const code = wizardErrorCode(error);
        if (code === "ONBOARDING_DONE") {
          router.refresh();
          return false;
        }
        setSave("error");
        return false;
      }
      dirty.current = false;
      setSave("saved");
      return true;
    },
    [supabase, router],
  );

  // Debounced autosave of edits within a step.
  useEffect(() => {
    if (!dirty.current) return;
    const id = setTimeout(() => {
      void persist(latest.current.step, latest.current.draft);
    }, AUTOSAVE_MS);
    return () => clearTimeout(id);
  }, [draft, persist]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  function focusHeading() {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      mainRef.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true });
    });
  }

  function goTo(target: WizardStep) {
    setShowErrors(false);
    setErrors({});
    setPublishError(null);
    setStep(target);
    void persist(target, latest.current.draft);
    focusHeading();
  }

  function next() {
    const errs = validateStep(step, draft);
    if (Object.keys(errs).length) {
      setErrors(errs);
      setShowErrors(true);
      toast.error(s.fixErrors);
      requestAnimationFrame(() =>
        mainRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]')?.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
      return;
    }
    const to = nextStep(step);
    if (to) goTo(to);
  }

  function back() {
    const to = prevStep(step);
    if (to) goTo(to);
  }

  function addressLine(): string | null {
    const city = cities.find((c) => c.id === draft.location.cityId);
    const area = areas.find((a) => a.id === draft.location.areaId);
    const name = (x?: { name_en: string; name_ar: string }) => (x ? (locale === "ar" ? x.name_ar : x.name_en) : null);
    const parts = [draft.location.landmark.trim() || null, name(area), name(city)].filter(Boolean);
    return parts.length ? parts.join(locale === "ar" ? "، " : ", ") : null;
  }

  async function publish() {
    const invalid = firstInvalidStep(draft);
    if (invalid) {
      toast.error(interpolate(s.publish.incomplete, { step: s.steps[invalid] }));
      goTo(invalid);
      setErrors(validateStep(invalid, draft));
      setShowErrors(true);
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      const { data, error } = await supabase.rpc("create_shop_from_wizard", {
        payload: buildPayload(draft, { address: addressLine() }),
      });
      if (error) {
        const code = wizardErrorCode(error);
        if (code === "ONBOARDING_DONE") {
          dirty.current = false;
          router.refresh();
          return;
        }
        const msg = s.rpcErrors[code];
        setPublishError(msg);
        toast.error(msg);
        const target = code === "INVALID_INPUT" ? stepForErrorDetail(error.details) : null;
        if (target) goTo(target);
        return;
      }
      const result = data as { slug?: string; marketplace_visible?: boolean } | null;
      dirty.current = false;
      toast.success(s.publish.success);
      const name = (locale === "ar" ? draft.shop.nameAr || draft.shop.nameEn : draft.shop.nameEn || draft.shop.nameAr).trim();
      if (result?.slug) onDone(result.slug, result.marketplace_visible ?? true, name);
      else router.refresh();
    } catch {
      const msg = s.rpcErrors.NETWORK;
      setPublishError(msg);
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  }

  const idx = stepIndex(step);
  const total = WIZARD_STEPS.length + 1; // + the account step already done
  const shownErrors = showErrors ? errors : {};
  const props = { draft, update, errors: shownErrors };

  const saveStatus =
    save === "saving" ? (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 size={14} className="animate-spin" aria-hidden />
        {s.saving}
      </span>
    ) : save === "saved" ? (
      <span className="inline-flex items-center gap-1.5">
        <Check size={14} aria-hidden />
        {s.saved}
      </span>
    ) : save === "error" ? (
      <button
        type="button"
        onClick={() => void persist(step, draft)}
        className="inline-flex items-center gap-1.5 underline underline-offset-2"
        style={{ color: "var(--accent-rose)" }}
      >
        <RefreshCw size={14} aria-hidden />
        {s.saveFailed}
      </button>
    ) : null;

  const isLast = step === "publish";

  return (
    <Frame
      progress={{ index: idx + 1, total, label: s.steps[step] }}
      saveStatus={saveStatus}
      footer={
        <>
          {prevStep(step) && (
            <button type="button" onClick={back} className="btn btn-ghost !px-3" disabled={publishing}>
              <ArrowLeft size={18} aria-hidden className="rtl:rotate-180" />
              {s.back}
            </button>
          )}
          <button
            type="button"
            onClick={isLast ? publish : next}
            disabled={publishing}
            aria-busy={publishing || undefined}
            className={cn("btn btn-primary ms-auto min-w-[150px] flex-1 sm:flex-none")}
          >
            {publishing ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden />
                {s.publish.publishing}
              </>
            ) : isLast ? (
              s.publish.cta
            ) : (
              <>
                {s.continue}
                <ArrowRight size={18} aria-hidden className="rtl:rotate-180" />
              </>
            )}
          </button>
        </>
      }
    >
      <div ref={mainRef} key={step} className="fade-slide-up">
        {step === "shop" && <StepShop {...props} />}
        {step === "location" && <StepLocation {...props} cities={cities} areas={areas} />}
        {step === "services" && <StepServices {...props} />}
        {step === "team" && <StepTeam {...props} ownerName={state.owner?.full_name ?? null} />}
        {step === "hours" && <StepHours {...props} />}
        {step === "publish" && (
          <StepPublish
            draft={draft}
            update={update}
            cities={cities}
            areas={areas}
            onEdit={goTo}
            publishError={publishError}
          />
        )}
      </div>
    </Frame>
  );
}
