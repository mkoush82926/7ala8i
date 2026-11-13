// Phone helpers for OTP delivery (Jordan first, any E.164 accepted).

/** Digits only. */
export function phoneDigits(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/**
 * E.164 without "+": 07XXXXXXXX → 9627XXXXXXXX, 7XXXXXXXX → 9627XXXXXXXX,
 * 00962… → 962…, anything already international is kept. Null when it can't
 * be a phone number (fewer than 9 or more than 15 digits).
 */
export function toE164Digits(raw: string | null | undefined): string | null {
  let d = phoneDigits(raw);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("07")) d = `962${d.slice(1)}`;
  else if (d.length === 9 && d.startsWith("7")) d = `962${d}`;
  if (d.length < 9 || d.length > 15) return null;
  return d;
}

/** The key the database uses: the last 9 digits (07X… and 9627X… agree). */
export function nationalKey(raw: string | null | undefined): string {
  return phoneDigits(raw).slice(-9);
}

/** Two numbers are the same subscriber (Jordan national part). */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = nationalKey(a);
  return ka.length === 9 && ka === nationalKey(b);
}

/** "+962 7•• ••• 567" style mask for "we sent a code to …". */
export function maskForDisplay(raw: string | null | undefined): string {
  const d = toE164Digits(raw) ?? phoneDigits(raw);
  if (d.length < 10) return d;
  return `+${d.slice(0, d.length - 9)} ${d.slice(-9, -8)}•• ••• ${d.slice(-3)}`;
}
