// TS twin of public.mask_phone() (supabase/migrations/20250101001900_marketplace_spine.sql).
// Keep both in sync; the tests in mask.test.ts pin the shared behaviour.
//
//   maskPhone("+962791112222") → "+962 7•••••222"
//   maskPhone("0791112222")    → "0••••••222"
//   maskPhone("123")           → "•••"
//   maskPhone("")              → null

export const MASK_CHAR = "•";

export function maskPhone(phone: string | null | undefined): string | null {
  if (phone == null || phone.trim() === "") return null;
  // Accept Arabic-Indic digits typed by users.
  let d = phone
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replace(/\D/g, "");
  if (d.length < 6) return MASK_CHAR.repeat(3);
  if (d.startsWith("00962")) d = d.slice(2);
  let head = "";
  let rest = d;
  if (d.startsWith("962") && d.length >= 10) {
    head = "+962 ";
    rest = d.slice(3);
  }
  return head + rest.slice(0, 1) + MASK_CHAR.repeat(Math.max(rest.length - 4, 1)) + rest.slice(-3);
}
