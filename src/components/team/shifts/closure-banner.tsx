"use client";

import React, { useEffect, useState } from "react";
import { CalendarX2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { formatHijri } from "@/lib/hijri";
import { addDaysIso } from "@/lib/hijri";
import { parseSegments, type Segment } from "./schedule-logic";
import { todayIn } from "./shared";

export interface ClosureNotice {
  kind: "closed" | "special";
  start: string;
  end: string;
  note: string | null;
  segments: Segment[];
}

interface ClosedRow {
  start_date: string;
  end_date: string;
  note_en: string | null;
  note_ar: string | null;
}
interface SpecialRow {
  date: string;
  is_closed: boolean;
  segments: unknown;
  note_en: string | null;
  note_ar: string | null;
}

/**
 * Upcoming closures and special hours within `days`, merged into notices:
 * consecutive special-hours dates with the same hours and note become one
 * range ("Ramadan hours, 8 Feb – 8 Mar").
 */
export function buildClosureNotices(closed: ClosedRow[], special: SpecialRow[], locale: "en" | "ar"): ClosureNotice[] {
  const pick = (en: string | null, ar: string | null) => (locale === "ar" ? ar || en : en || ar) || null;
  const out: ClosureNotice[] = closed.map((c) => ({ kind: "closed", start: c.start_date, end: c.end_date, note: pick(c.note_en, c.note_ar), segments: [] }));
  const sorted = [...special].sort((a, b) => a.date.localeCompare(b.date));
  for (const s of sorted) {
    const segments = parseSegments(s.segments);
    const kind = s.is_closed || segments.length === 0 ? "closed" : "special";
    const note = pick(s.note_en, s.note_ar);
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.kind === kind &&
      prev.note === note &&
      addDaysIso(prev.end, 1) === s.date &&
      JSON.stringify(prev.segments) === JSON.stringify(segments)
    ) {
      prev.end = s.date;
    } else {
      out.push({ kind, start: s.date, end: s.date, note, segments });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Public-page banner for upcoming closures and special hours (Eid, Ramadan).
 * Reads closed_periods and special_hours, which anon may read. Renders
 * nothing when there is nothing to announce.
 */
export function ClosureBanner({ shopId, timezone = "Asia/Amman", days = 21 }: { shopId: string; timezone?: string; days?: number }) {
  const { t, locale, formatDate } = useTranslation();
  const [notices, setNotices] = useState<ClosureNotice[]>([]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const today = todayIn(timezone);
    const until = addDaysIso(today, days);
    Promise.all([
      supabase.from("closed_periods").select("start_date, end_date, note_en, note_ar").eq("shop_id", shopId).gte("end_date", today).lte("start_date", until),
      supabase.from("special_hours").select("date, is_closed, segments, note_en, note_ar").eq("shop_id", shopId).gte("date", today).lte("date", until),
    ])
      .then(([c, s]) => {
        if (cancelled) return;
        setNotices(buildClosureNotices((c.data ?? []) as ClosedRow[], (s.data ?? []) as SpecialRow[], locale));
      })
      .catch(() => {
        /* the banner is optional: stay silent */
      });
    return () => {
      cancelled = true;
    };
  }, [shopId, timezone, days, locale]);

  if (!notices.length) return null;

  const day = (d: string) => formatDate(`${d}T12:00:00Z`, { day: "numeric", month: "short", timeZone: "UTC" });
  const range = (n: ClosureNotice) => (n.start === n.end ? day(n.start) : `${day(n.start)} – ${day(n.end)}`);

  return (
    <aside aria-label={t.shifts.bannerLabel} className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3">
      {notices.slice(0, 3).map((n, i) => (
        <p key={i} className="m-0 flex items-start gap-2 text-sm text-ink">
          {n.kind === "closed" ? (
            <CalendarX2 size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-danger-text" />
          ) : (
            <Clock size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-soft" />
          )}
          <span>
            <strong className="font-semibold">
              {n.kind === "closed" ? interpolate(t.shifts.bannerClosed, { range: range(n) }) : interpolate(t.shifts.bannerSpecial, { range: range(n) })}
            </strong>
            {n.kind === "special" && n.segments.length > 0 && (
              <span dir="ltr" className="ms-1 text-ink-soft">
                {n.segments.map((s) => `${s.start}–${s.end}`).join(" · ")}
              </span>
            )}
            {n.note && <span className="ms-1 text-ink-soft">· {n.note}</span>}
            <span className="ms-1 text-[12px] text-ink-soft">({formatHijri(n.start, locale, { withYear: false })})</span>
          </span>
        </p>
      ))}
    </aside>
  );
}
