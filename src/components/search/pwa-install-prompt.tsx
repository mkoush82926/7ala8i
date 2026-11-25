"use client";

// A quiet "Add Halaqy to your home screen" card.
//  • Chromium/Android: captures beforeinstallprompt and shows Install.
//  • iOS Safari (no install event): shows the Share → Add to Home Screen hint.
//  • Hidden when already installed (standalone), after a dismissal (30 days,
//    per browser) or when nothing can be offered.

import React, { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

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

export function PwaInstallPrompt() {
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
      className="mx-auto mt-10 flex w-full max-w-[1200px] items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 sm:items-center"
    >
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg-primary)] text-[var(--accent-text)]">
        {mode === "ios" ? <Share size={18} /> : <Download size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <p id="pwa-title" className="text-[15px] font-bold text-[var(--text-primary)]">
          {S.installTitle}
        </p>
        <p className="text-[13.5px] text-[var(--text-secondary)]">{mode === "ios" ? S.installIosHint : S.installBody}</p>
      </div>
      {mode === "prompt" && (
        <button type="button" onClick={install} className="btn btn-secondary !min-h-[40px] shrink-0 !rounded-full !px-4 !text-[14px]">
          {S.installCta}
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label={S.installDismiss}
        className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </aside>
  );
}

export default PwaInstallPrompt;
