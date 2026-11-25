"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BellRing, Share, SquarePlus, X } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { currentPlatform, isStandalone, registerServiceWorker } from "@/lib/push/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/recipes";
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

  const compact = variant === "compact";

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "relative flex gap-3 rounded-xl border border-line bg-card text-ink",
        compact ? "items-center py-3 pe-12 ps-3 sm:gap-4" : "items-start p-4 pe-12 lg:p-5 lg:pe-14",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "bg-hatch-ink grid shrink-0 place-items-center bg-brand-soft text-brand-text",
          compact ? "size-10 rounded-lg" : "size-12 rounded-xl",
        )}
      >
        <BellRing size={compact ? 18 : 22} />
      </span>
      <div className={cn("min-w-0 flex-1", compact && !isIos && "sm:flex sm:items-center sm:justify-between sm:gap-4")}>
        <h2 id={titleId} className="m-0 text-[15px] font-semibold leading-snug text-ink">
          {isIos ? tp.iosTitle : tp.title}
        </h2>
        {!compact && <p className="m-0 mt-1 text-sm text-ink-muted">{isIos ? tp.iosBody : tp.body}</p>}
        {isIos && !compact && (
          <ol className="m-0 mt-3 flex list-none flex-col gap-2 p-0 text-sm text-ink-soft">
            {[
              { icon: Share, text: tp.iosStepShare },
              { icon: SquarePlus, text: tp.iosStepAdd },
              { icon: BellRing, text: tp.iosStepOpen },
            ].map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-center gap-3">
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-brand-text">
                  <Icon size={16} />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        )}
        {!isIos && (
          <div className={cn("flex flex-wrap gap-2", compact ? "mt-2 sm:mt-0 sm:shrink-0" : "mt-3")}>
            <Button size="sm" onClick={install} loading={busy}>
              {tp.install}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {tp.notNow}
            </Button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={tp.dismissLabel}
        className={cn(
          "absolute end-1 grid size-11 place-items-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-sunken hover:text-ink motion-reduce:transition-none",
          compact ? "top-1/2 -translate-y-1/2" : "top-1",
          focusRing,
        )}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  );
}

export default InstallPrompt;
