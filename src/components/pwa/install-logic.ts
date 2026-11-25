// PWA install prompt decisions (WS-1K). Pure, unit-tested.
import type { DevicePlatform } from "@/lib/push/client";

export const INSTALL_DISMISS_KEY = "halaqy_pwa_install_dismissed_until";
/** "Not now" hides the prompt for two weeks. */
export const INSTALL_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

export type InstallMode =
  /** Chrome/Edge/Samsung: our button opens the browser's install dialog. */
  | "native"
  /** iOS Safari: no install API, show Share → Add to Home Screen steps. */
  | "ios"
  | null;

export interface InstallInput {
  standalone: boolean;
  platform: DevicePlatform;
  /** A captured beforeinstallprompt event is waiting. */
  hasDeferredPrompt: boolean;
  /** Epoch ms from storage, or null. */
  dismissedUntil: number | null;
  now: number;
  /** iOS in-app browsers (Instagram, Facebook, Chrome on iOS ≥ 16.4 can install too). */
  userAgent?: string;
}

/** iOS browsers that can add a web app to the Home Screen. */
export function iosCanInstall(userAgent: string | undefined): boolean {
  const ua = userAgent ?? "";
  // In-app webviews (Instagram, Facebook, WhatsApp…) cannot install.
  if (/FBAN|FBAV|Instagram|WhatsApp|Line\//i.test(ua)) return false;
  return true;
}

export function installMode(i: InstallInput): InstallMode {
  if (i.standalone) return null;
  if (i.dismissedUntil != null && i.dismissedUntil > i.now) return null;
  if (i.hasDeferredPrompt) return "native";
  if (i.platform === "ios" && iosCanInstall(i.userAgent)) return "ios";
  return null;
}

export function readDismissedUntil(storage: Pick<Storage, "getItem"> | null | undefined): number | null {
  try {
    const raw = storage?.getItem(INSTALL_DISMISS_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function snoozeInstall(storage: Pick<Storage, "setItem"> | null | undefined, now: number): number {
  const until = now + INSTALL_SNOOZE_MS;
  try {
    storage?.setItem(INSTALL_DISMISS_KEY, String(until));
  } catch {
    /* private mode: the prompt simply comes back next visit */
  }
  return until;
}
