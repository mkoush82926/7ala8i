"use client";

// A quiet "Add Halaqy to your home screen" card.
//  • Chromium/Android: captures beforeinstallprompt and shows Install.
//  • iOS Safari (no install event): shows the Share → Add to Home Screen hint.
//  • Hidden when already installed (standalone), after a dismissal (30 days,
//    per browser) or when nothing can be offered.

import React, { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { buttonClasses } from "@/components/ui/recipes";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const PWA_DISMISS_KEY = "halaqy:pwa-prompt:dismissed-at";
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

export function shouldOfferInstall(opts: { standalone: boolean; dismissedAt: number | null; now: number }): boolean {
  if (opts.standalone) return false;
  if (opts.dismissedAt && opts.now - opts.dismissedAt < DISMISS_MS) return false;
  return true;
}

export function isIosSafari(ua: string): boolean {
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua));
  return ios && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function readDismissed(): number | null {
  try {
    const v = Number(window.localStorage.getItem(PWA_DISMISS_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function PwaInstallPrompt({ className }: { className?: string }) {
  const { t } = useTranslation();
  const S = t.search;
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"none" | "prompt" | "ios">("none");

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!shouldOfferInstall({ standalone, dismissedAt: readDismissed(), now: Date.now() })) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setMode("prompt");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isIosSafari(navigator.userAgent)) setMode("ios");
    const onInstalled = () => setMode("none");
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "none") return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(PWA_DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore: the card just comes back next visit
    }
    setMode("none");
  };

  const install = async () => {
    if (!evt) return;
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === "accepted") setMode("none");
    } catch {
      setMode("none");
    }
    setEvt(null);
  };

  return (
    <aside
      aria-labelledby="pwa-title"
      className={cn(
        "fade-slide-up flex w-full items-start gap-4 rounded-2xl border border-line bg-card p-4 shadow-card sm:items-center sm:p-5",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-text [&_svg]:size-5"
      >
        {mode === "ios" ? <Share /> : <Download />}
      </span>
      <div className="min-w-0 flex-1">
        <p id="pwa-title" className="text-title text-ink">
          {S.installTitle}
        </p>
        <p className="mt-0.5 text-sm text-ink-muted">{mode === "ios" ? S.installIosHint : S.installBody}</p>
      </div>
      {mode === "prompt" && (
        <button type="button" onClick={install} className={buttonClasses({ variant: "secondary", size: "sm", className: "h-10 px-4" })}>
          {S.installCta}
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label={S.installDismiss}
        className={buttonClasses({ variant: "ghost", size: "icon-sm", className: "-me-1" })}
      >
        <X aria-hidden="true" />
      </button>
    </aside>
  );
}

export default PwaInstallPrompt;
