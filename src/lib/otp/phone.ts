// Phone helpers for OTP delivery. Codes and phone sign-in are Jordanian
// mobiles only (+962 7[789]…), mirroring public.jo_mobile_e164().

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits → Latin; everything else kept. */
export function toLatinDigits(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Digits only (Arabic-Indic digits count). */
export function phoneDigits(raw: string | null | undefined): string {
  return toLatinDigits(raw).replace(/\D/g, "");
}

/**
 * Jordanian mobile → "9627XXXXXXXX" (E.164 digits), null for anything else.
 * Accepts 07…, 7…, 9627…, 009627…, +962 07… and Arabic-Indic digits.
 */
export function toJordanMobile(raw: string | null | undefined): string | null {
  let d = phoneDigits(raw);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 13 && d.startsWith("9620")) d = `962${d.slice(4)}`;
  if (d.length === 10 && d.startsWith("07")) d = `962${d.slice(1)}`;
  else if (d.length === 9 && d.startsWith("7")) d = `962${d}`;
  return /^9627[789]\d{7}$/.test(d) ? d : null;
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

/**
 * Two numbers are the same subscriber: the full international number must
 * match (07… and +9627… agree; +964 7… never matches +962 7…).
 */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const ea = toE164Digits(a);
  return !!ea && ea === toE164Digits(b);
}

/** "+962 7•• ••• 567" style mask for "we sent a code to …". */
export function maskForDisplay(raw: string | null | undefined): string {
  const d = toE164Digits(raw) ?? phoneDigits(raw);
  if (d.length < 10) return d;
  return `+${d.slice(0, d.length - 9)} ${d.slice(-9, -8)}•• ••• ${d.slice(-3)}`;
}
