// Device list helpers for Settings › Notifications (WS-1K). Pure.

export type DeviceKind = "iphone" | "ipad" | "android" | "mac" | "windows" | "linux" | "other";

export interface DeviceInfo {
  kind: DeviceKind;
  /** Browser product name (not translated), or null when unknown. */
  browser: string | null;
}

/** Rough, privacy-friendly description of a stored user agent. */
export function describeUserAgent(ua: string | null | undefined): DeviceInfo {
  const s = ua ?? "";
  let kind: DeviceKind = "other";
  if (/iPad/i.test(s)) kind = "ipad";
  else if (/iPhone|iPod/i.test(s)) kind = "iphone";
  else if (/Android/i.test(s)) kind = "android";
  else if (/Macintosh|Mac OS X/i.test(s)) kind = "mac";
  else if (/Windows/i.test(s)) kind = "windows";
  else if (/Linux|CrOS/i.test(s)) kind = "linux";

  let browser: string | null = null;
  if (/EdgA?\//.test(s)) browser = "Edge";
  else if (/SamsungBrowser\//.test(s)) browser = "Samsung Internet";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/Firefox\/|FxiOS\//.test(s)) browser = "Firefox";
  else if (/Chrome\/|CriOS\//.test(s)) browser = "Chrome";
  else if (/Safari\//.test(s)) browser = "Safari";
  return { kind, browser };
}

export interface DeviceRow {
  id: string;
  endpoint: string;
  user_agent: string | null;
  locale: string | null;
  last_success_at: string | null;
  last_failure_at?: string | null;
  failure_count?: number | null;
  created_at: string;
}

/** This device first, then most recently active. */
export function sortDevices<T extends DeviceRow>(rows: ReadonlyArray<T>, currentEndpoint: string | null): T[] {
  const activity = (r: DeviceRow) => Date.parse(r.last_success_at ?? r.created_at) || 0;
  return [...rows].sort((a, b) => {
    if (currentEndpoint) {
      if (a.endpoint === currentEndpoint && b.endpoint !== currentEndpoint) return -1;
      if (b.endpoint === currentEndpoint && a.endpoint !== currentEndpoint) return 1;
    }
    return activity(b) - activity(a);
  });
}

/** A device whose recent pushes keep failing (shown with a warning). */
export function isDeviceUnhealthy(row: Pick<DeviceRow, "failure_count">): boolean {
  return (row.failure_count ?? 0) >= 3;
}
