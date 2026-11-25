"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BellRing, Share, SquarePlus, X } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { currentPlatform, isStandalone, registerServiceWorker } from "@/lib/push/client";
import { cn } from "@/lib/utils";
import { installMode, readDismissedUntil, snoozeInstall, type InstallMode } from "./install-logic";

/** Chrome's beforeinstallprompt event (not in lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export interface InstallPromptProps {
  /** "card" (default) sits in the page flow; "compact" is a one-line strip. */
  variant?: "card" | "compact";
  /** Ignore a previous "Not now" (e.g. on Settings › Notifications). */
  ignoreSnooze?: boolean;
  className?: string;
}

/**
 * Dashboard PWA install prompt (WS-1K). Registers the service worker, offers
 * the native install dialog where the browser supports it, and on iPhone/iPad
 * explains Share → Add to Home Screen — iOS delivers web push only to an
 * installed app. Renders nothing once installed, after "Not now" (2 weeks),
 * or where installing is not possible.
 */
export function InstallPrompt({ variant = "card", ignoreSnooze = false, className }: InstallPromptProps) {
  const { t } = useTranslation();
  const tp = t.pwaInstall;
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<InstallMode>(null);
  const [busy, setBusy] = useState(false);

  const recompute = useCallback(
    (prompt: BeforeInstallPromptEvent | null) => {
      setMode(
        installMode({
          standalone: isStandalone(),
          platform: currentPlatform(),
          hasDeferredPrompt: !!prompt,
          dismissedUntil: ignoreSnooze ? null : readDismissedUntil(safeStorage()),
          now: Date.now(),
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        }),
      );
    },
    [ignoreSnooze],
  );

  useEffect(() => {
    void registerServiceWorker();
    recompute(null);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      const ev = e as BeforeInstallPromptEvent;
      setDeferred(ev);
      recompute(ev);
    };
    const onInstalled = () => {
      setDeferred(null);
      setMode(null);
      toast.success(tp.installed);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [recompute, tp.installed]);

  const dismiss = () => {
    snoozeInstall(safeStorage(), Date.now());
    setMode(null);
  };

  const install = async () => {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "dismissed") snoozeInstall(safeStorage(), Date.now());
      setDeferred(null);
      setMode(null);
    } catch {
      toast.error(tp.failed);
    } finally {
      setBusy(false);
    }
  };

  if (!mode) return null;

  const isIos = mode === "ios";
  const titleId = "pwa-install-title";

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "relative flex gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)]",
        variant === "compact" ? "items-center p-3" : "items-start p-4",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-secondary)] text-[var(--accent-text)]"
      >
        <BellRing size={18} />
      </span>
      <div className="min-w-0 flex-1 pe-8">
        <h2 id={titleId} className="m-0 text-sm font-bold">
          {isIos ? tp.iosTitle : tp.title}
        </h2>
        {variant === "card" && (
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{isIos ? tp.iosBody : tp.body}</p>
        )}
        {isIos && variant === "card" && (
          <ol className="mt-3 flex list-none flex-col gap-2 p-0 text-sm">
            <li className="flex items-center gap-2">
              <Share size={16} aria-hidden="true" className="shrink-0 text-[var(--accent-text)]" />
              <span>{tp.iosStepShare}</span>
            </li>
            <li className="flex items-center gap-2">
              <SquarePlus size={16} aria-hidden="true" className="shrink-0 text-[var(--accent-text)]" />
              <span>{tp.iosStepAdd}</span>
            </li>
            <li className="flex items-center gap-2">
              <BellRing size={16} aria-hidden="true" className="shrink-0 text-[var(--accent-text)]" />
              <span>{tp.iosStepOpen}</span>
            </li>
          </ol>
        )}
        {!isIos && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={install}
              disabled={busy}
              aria-busy={busy || undefined}
              className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--cta-bg)] px-5 text-sm font-bold text-[var(--cta-fg)] hover:opacity-90 disabled:opacity-60"
            >
              {tp.install}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
            >
              {tp.notNow}
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={tp.dismissLabel}
        className="focus-ring absolute end-2 top-2 inline-flex size-11 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </section>
  );
}

export default InstallPrompt;
