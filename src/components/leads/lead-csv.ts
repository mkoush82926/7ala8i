import type { LeadDraft } from "@/store/leads-store";

/** Import guard rails (one insert statement per import). */
export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BYTES = 1024 * 1024;

/** Minimal RFC-4180-ish line parser: quoted cells and escaped quotes (""). */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** Spreadsheet formula prefixes are stripped so an exported file can't execute them. */
function clean(value: string | undefined, max: number): string {
  let v = (value ?? "").replace(/^[=@\t\r]+/, "");
  // "+962…" / "-5" are data; "+cmd" / "-A1" are formulas.
  while (/^[+\-][^\d\s.]/.test(v)) v = v.slice(1);
  return v.trim().slice(0, max);
}

/**
 * Parses a leads CSV. With a header row, columns are matched by name
 * (name, phone|contact|mobile, email, value, notes; Arabic headers too);
 * without one, the first two columns are name and phone.
 */
export function parseLeadsCsv(text: string): LeadDraft[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const find = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const nameIdx = find("name", "full name", "الاسم");
  const phoneIdx = find("phone", "contact", "mobile", "الهاتف", "رقم الهاتف");
  const emailIdx = find("email", "البريد الإلكتروني");
  const valueIdx = find("value", "القيمة");
  const notesIdx = find("notes", "ملاحظات");
  const hasHeader = nameIdx !== -1 || phoneIdx !== -1;
  const rows = hasHeader ? lines.slice(1) : lines;

  return rows
    .map((line) => {
      const cells = parseCsvLine(line);
      const at = (idx: number) => (idx === -1 ? undefined : cells[idx]);
      const name = clean(hasHeader ? at(nameIdx) : cells[0], 120);
      const phone = clean(hasHeader ? at(phoneIdx) : cells[1], 30);
      const email = clean(at(hasHeader ? emailIdx : -1), 160);
      const rawValue = parseFloat(clean(at(hasHeader ? valueIdx : -1), 20));
      const notes = clean(at(hasHeader ? notesIdx : -1), 1000);
      return {
        name,
        phone: phone || null,
        email: email || null,
        value: Number.isFinite(rawValue) && rawValue >= 0 ? rawValue : null,
        notes: notes || null,
        stage: "new" as const,
      };
    })
    .filter((lead) => lead.name.length > 0);
}
