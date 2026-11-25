"use client";

import React, { useId, useMemo, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Download, Loader2, Printer } from "lucide-react";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { useTranslation } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "./copy-field";
import { POSTER_LANGS, POSTER_MM, POSTER_SIZES, displayUrl, posterFileName, posterPixels, type PosterLang, type PosterSize } from "./link-utils";
import { posterLayout, toPercent, type PosterInput, type PosterLayout } from "./poster-layout";
import { downloadBlob, renderPosterPng } from "./poster-png";

const PRINT_CLASS = "halaqy-poster-print";

/** Print stylesheet: only the poster, edge to edge on the chosen paper. */
function printCss(size: PosterSize): string {
  const mm = POSTER_MM[size];
  return `@media print {
  @page { size: ${size.toUpperCase()} portrait; margin: 0; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  .${PRINT_CLASS}, .${PRINT_CLASS} * { visibility: visible !important; }
  .${PRINT_CLASS} {
    position: fixed !important; inset-block-start: 0 !important; inset-inline-start: 0 !important;
    width: ${mm.w}mm !important; max-width: none !important; height: ${mm.h}mm !important;
    border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
}`;
}

/** DOM rendering of the poster layout (screen preview and the printout). */
function PosterPreview({ layout, value, label }: { layout: PosterLayout; value: string; label: string }) {
  const { width: W, height: H } = layout;
  return (
    <div
      role="img"
      aria-label={label}
      dir="ltr"
      className={cn(PRINT_CLASS, "relative w-full overflow-hidden rounded-lg border border-[var(--border-subtle)] shadow-sm")}
      style={{ aspectRatio: `${W} / ${H}`, containerType: "inline-size" }}
    >
      {layout.elements.map((el) => {
        if (el.kind === "rect") {
          return (
            <div
              key={el.id}
              aria-hidden="true"
              className="absolute"
              style={{
                insetInlineStart: toPercent(el.x, W),
                insetBlockStart: toPercent(el.y, H),
                width: toPercent(el.w, W),
                height: toPercent(el.h, H),
                background: el.fill,
                borderRadius: el.radius ? `${el.radius / 10}cqw` : undefined,
                border: el.stroke && el.strokeWidth ? `${el.strokeWidth / 10}cqw solid ${el.stroke}` : undefined,
                boxSizing: "border-box",
              }}
            />
          );
        }
        if (el.kind === "qr") {
          return (
            <div
              key={el.id}
              aria-hidden="true"
              className="absolute"
              style={{
                insetInlineStart: toPercent(el.x, W),
                insetBlockStart: toPercent(el.y, H),
                width: toPercent(el.size, W),
                aspectRatio: "1 / 1",
              }}
            >
              <QRCodeSVG value={value} size={512} level="Q" marginSize={0} bgColor="#ffffff" fgColor="#1c1611"
                style={{ width: "100%", height: "100%", display: "block" }} />
            </div>
          );
        }
        return (
          <p
            key={el.id}
            aria-hidden="true"
            dir={el.dir}
            className="absolute m-0 overflow-hidden text-ellipsis whitespace-nowrap text-center"
            style={{
              insetInline: 0,
              marginInline: "auto",
              insetBlockStart: toPercent(el.y, H),
              transform: "translateY(-50%)",
              maxWidth: toPercent(el.maxWidth, W),
              fontSize: `${el.size / 10}cqw`,
              lineHeight: 1.2,
              fontWeight: el.weight,
              color: el.color,
              fontFamily: el.font === "ar" ? "var(--font-cairo), sans-serif" : "var(--font-bdo-grotesk), sans-serif",
            }}
          >
            {el.text}
          </p>
        );
      })}
    </div>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm font-semibold text-[var(--text-primary)]">{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--bg-secondary)] p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "relative inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent-brass)]",
              value === o.value
                ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            )}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              value={o.value}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export interface QrPosterProps {
  /** Full tagged link encoded in the QR (…/b/{slug}?src=qr&entry=link). */
  url: string;
  shopName: string;
  shopNameAr: string | null;
  slug: string;
}

/** Printable QR posters (A4/A5, Arabic/English/bilingual) as PNG and print/PDF. */
export function QrPoster({ url, shopName, shopNameAr, slug }: QrPosterProps) {
  const { t } = useTranslation();
  const tp = t.links.poster;
  const [size, setSize] = useState<PosterSize>("a5");
  const [lang, setLang] = useState<PosterLang>("both");
  const [busy, setBusy] = useState(false);
  const qrRef = useRef<HTMLCanvasElement | null>(null);

  const input: PosterInput = useMemo(
    () => ({
      size,
      lang,
      shopName: lang === "en" ? shopName || shopNameAr || "" : shopNameAr || shopName,
      url: displayUrl(url),
      // Posters print both languages whatever the dashboard locale is.
      en: { headline: en.links.poster.headline, sub: en.links.poster.sub, footer: en.links.poster.footer },
      ar: { headline: ar.links.poster.headline, sub: ar.links.poster.sub, footer: ar.links.poster.footer },
    }),
    [size, lang, shopName, shopNameAr, url],
  );
  const layout = useMemo(() => posterLayout(input), [input]);
  const px = posterPixels(size);

  async function downloadPng() {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await renderPosterPng(layout, px.w, qrRef.current);
      downloadBlob(blob, posterFileName(slug, size, lang));
      toast.success(tp.downloaded);
    } catch {
      toast.error(tp.downloadFailed);
    } finally {
      setBusy(false);
    }
  }

  const sizeLabel = (s: PosterSize) => (s === "a4" ? tp.sizeA4 : tp.sizeA5);
  const langLabel = (l: PosterLang) => (l === "both" ? tp.langBoth : l === "ar" ? tp.langAr : tp.langEn);

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)] md:items-start">
      <style>{printCss(size)}</style>
      <div className="flex flex-col gap-4">
        <Segmented label={tp.size} value={size} onChange={setSize}
          options={POSTER_SIZES.map((s) => ({ value: s, label: sizeLabel(s) }))} />
        <Segmented label={tp.language} value={lang} onChange={setLang}
          options={POSTER_LANGS.map((l) => ({ value: l, label: langLabel(l) }))} />
        <p className="m-0 text-xs text-[var(--text-muted)]">{size === "a4" ? tp.sizeA4Hint : tp.sizeA5Hint}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className={BUTTON_PRIMARY} onClick={downloadPng} disabled={busy} aria-busy={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
            <span>{tp.downloadPng}</span>
          </button>
          <button type="button" className={BUTTON_SECONDARY} onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" />
            <span>{tp.printPdf}</span>
          </button>
        </div>
        <p className="m-0 text-xs text-[var(--text-muted)]">{tp.printHint}</p>
      </div>

      <div className="mx-auto w-full max-w-[260px]">
        <PosterPreview layout={layout} value={url} label={tp.previewLabel} />
      </div>

      {/* High-resolution QR source for the PNG export. */}
      <div aria-hidden="true" className="hidden">
        <QRCodeCanvas ref={qrRef} value={url} size={1024} level="Q" marginSize={0} bgColor="#ffffff" fgColor="#1c1611" />
      </div>
    </div>
  );
}
