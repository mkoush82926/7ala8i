// Phone helpers shared by the outbox, the dispatcher and the wa.me fallback.
// Mirrors public.messaging_normalize_phone() in 20250101002200_messaging.sql.

/**
 * Normalises a phone number to international digits (no "+").
 * Jordanian mobiles: 07XXXXXXXX / 7XXXXXXXX / 9627… / 009627… → 9627XXXXXXXX.
 * Returns null when the input cannot be a phone number.
 */
export function normalizePhoneForWa(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const latin = phone
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  let digits = latin.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) digits = `962${digits.slice(1)}`;
  else if (digits.startsWith("7") && digits.length === 9) digits = `962${digits}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** https://wa.me/<digits>?text=… (or a share link without a number). */
export function buildWaLink(phone: string | null | undefined, text: string): string {
  const to = normalizePhoneForWa(phone);
  const q = `text=${encodeURIComponent(text)}`;
  return to ? `https://wa.me/${to}?${q}` : `https://wa.me/?${q}`;
}

/** Log-safe form: keeps the country code and the last 3 digits. */
export function maskForLog(phone: string | null | undefined): string {
  const d = normalizePhoneForWa(phone);
  if (!d) return "-";
  return `${d.slice(0, 3)}…${d.slice(-3)}`;
}
