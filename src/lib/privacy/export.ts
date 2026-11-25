// ═══════════════════════════════════════════════════════
// WS-1J · PDPL data export (right of access). Browser-safe.
//
// export_my_data() returns one jsonb document. The customer downloads it as
// JSON (lossless) or as a CSV in long format (section, row, field, value),
// which opens in Excel / Numbers with Arabic intact thanks to the UTF-8 BOM.
// ═══════════════════════════════════════════════════════

export type ExportFormat = "json" | "csv";

export const EXPORT_FORMAT_VERSION = "halaqy.export.v1";

/** Sections in a stable, readable order; unknown sections follow alphabetically. */
export const EXPORT_SECTION_ORDER = [
  "account",
  "profile",
  "verified_phones",
  "consent_records",
  "client_links",
  "clients",
  "appointments",
  "appointment_services",
  "booking_attribution",
  "reviews",
  "payments",
  "sales",
  "sale_items",
  "sale_payments",
  "leads",
  "notifications",
  "message_outbox",
  "marketing_consents",
] as const;

const META_KEYS = new Set(["format", "generated_at"]);

export interface ExportSummary {
  section: string;
  rows: number;
}

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function exportSections(data: unknown): string[] {
  if (!isObject(data)) return [];
  const keys = Object.keys(data).filter((k) => !META_KEYS.has(k));
  const known = EXPORT_SECTION_ORDER.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !(EXPORT_SECTION_ORDER as readonly string[]).includes(k)).sort();
  return [...known, ...rest];
}

function rowsOf(value: unknown): Json[] {
  if (Array.isArray(value)) return value.map((v) => (isObject(v) ? v : { value: v }));
  if (isObject(value)) return [value];
  if (value === null || value === undefined) return [];
  return [{ value }];
}

/** Row counts per section (what the account hub shows before download). */
export function summarizeExport(data: unknown): ExportSummary[] {
  if (!isObject(data)) return [];
  return exportSections(data).map((section) => ({ section, rows: rowsOf(data[section]).length }));
}

export function totalExportRows(data: unknown): number {
  return summarizeExport(data).reduce((n, s) => n + s.rows, 0);
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** RFC 4180 quoting, plus a guard against spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  let text = cellText(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Long-format CSV: section,row,field,value. Starts with a UTF-8 BOM. */
export function exportToCsv(data: unknown): string {
  const lines: string[] = ["section,row,field,value"];
  if (isObject(data)) {
    if (data.format !== undefined) lines.push(["meta", "1", "format", csvCell(data.format)].join(","));
    if (data.generated_at !== undefined) lines.push(["meta", "1", "generated_at", csvCell(data.generated_at)].join(","));
    for (const section of exportSections(data)) {
      rowsOf(data[section]).forEach((row, i) => {
        for (const [field, value] of Object.entries(row)) {
          lines.push([csvCell(section), String(i + 1), csvCell(field), csvCell(value)].join(","));
        }
      });
    }
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function exportToJson(data: unknown): string {
  return `${JSON.stringify(data ?? {}, null, 2)}\n`;
}

/** halaqy-my-data-2026-11-13.json */
export function exportFileName(format: ExportFormat, now: Date = new Date()): string {
  const d = now.toISOString().slice(0, 10);
  return `halaqy-my-data-${d}.${format}`;
}

export function exportMimeType(format: ExportFormat): string {
  return format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8";
}

/** Triggers a browser download. No-op outside the browser. */
export function downloadExport(data: unknown, format: ExportFormat, now: Date = new Date()): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const body = format === "json" ? exportToJson(data) : exportToCsv(data);
  const blob = new Blob([body], { type: exportMimeType(format) });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName(format, now);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
