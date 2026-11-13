"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { CalendarDays, Check, Copy, Download, ExternalLink, ImagePlus, MessageCircle, Share2 } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { Confetti } from "@/components/ui/confetti";
import { bookingLink, qrFileName, whatsappShareUrl } from "../_lib/wizard";
import { StepHeader, cardClass, cardStyle } from "./ui";

const noopSubscribe = () => () => {};

export function ShareScreen({
  slug,
  shopName,
  celebrate,
  marketplaceVisible,
}: {
  slug: string;
  shopName: string;
  celebrate: boolean;
  marketplaceVisible: boolean;
}) {
  const { t, locale, href } = useTranslation();
  const s = t.start;
  const qrWrap = useRef<HTMLDivElement>(null);
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";
  // Browser-only values, read without a setState-in-effect round trip.
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => configuredOrigin || window.location.origin,
    () => configuredOrigin,
  );
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const [copied, setCopied] = useState(false);

  const link = origin ? bookingLink(origin, locale, slug) : "";
  const message = interpolate(s.share.message, { name: shopName, link });

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success(s.share.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(s.share.copyFailed);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: shopName, text: message, url: link });
    } catch {
      // Cancelled by the user: nothing to do.
    }
  }

  function downloadQr() {
    const canvas = qrWrap.current?.querySelector("canvas");
    if (!canvas) return;
    try {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = qrFileName(slug);
      a.click();
      toast.success(s.share.qrDownloaded);
    } catch {
      toast.error(s.share.qrFailed);
    }
  }

  return (
    <div>
      {celebrate && <Confetti trigger />}
      <StepHeader
        eyebrow={s.share.eyebrow}
        title={interpolate(s.share.title, { name: shopName })}
        subtitle={marketplaceVisible ? s.share.subtitleMarketplace : s.share.subtitleLinkOnly}
      />

      <div className={`${cardClass} p-4`} style={cardStyle}>
        <p className="field-label">{s.share.linkLabel}</p>
        <div className="flex items-stretch gap-2">
          <output
            dir="ltr"
            className="field-input flex min-w-0 flex-1 items-center truncate !py-2 text-[15px]"
            aria-label={s.share.linkLabel}
          >
            {link || "…"}
          </output>
          <button type="button" onClick={copy} className="btn btn-secondary shrink-0 !px-3.5" disabled={!link}>
            {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
            <span>{copied ? s.share.copiedShort : s.share.copy}</span>
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <a
            href={whatsappShareUrl(message)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary w-full"
            aria-disabled={!link || undefined}
          >
            <MessageCircle size={18} aria-hidden />
            {s.share.whatsapp}
          </a>
          {canShare ? (
            <button type="button" onClick={nativeShare} className="btn btn-secondary w-full" disabled={!link}>
              <Share2 size={18} aria-hidden />
              {s.share.more}
            </button>
          ) : (
            <a href={link || undefined} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full">
              <ExternalLink size={18} aria-hidden />
              {s.share.preview}
            </a>
          )}
        </div>
      </div>

      <div className={`${cardClass} mt-4 flex flex-col items-center gap-3 p-5 sm:flex-row sm:items-center sm:gap-5`} style={cardStyle}>
        <div ref={qrWrap} className="rounded-lg bg-white p-3" aria-hidden={!link}>
          {link ? (
            <QRCodeCanvas
              value={link}
              size={168}
              level="M"
              marginSize={0}
              fgColor="#1c1611"
              bgColor="#ffffff"
              role="img"
              aria-label={interpolate(s.share.qrAlt, { name: shopName })}
            />
          ) : (
            <div className="h-[168px] w-[168px]" />
          )}
        </div>
        <div className="text-center sm:text-start">
          <p className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
            {s.share.qrTitle}
          </p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
            {s.share.qrBody}
          </p>
          <button type="button" onClick={downloadQr} className="btn btn-secondary mt-3" disabled={!link}>
            <Download size={18} aria-hidden />
            {s.share.qrDownload}
          </button>
        </div>
      </div>

      <h2 className="mb-2 mt-8 text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
        {s.share.nextTitle}
      </h2>
      <div className="flex flex-col gap-2.5">
        <Link href={`${href("/settings/profile")}#photos`} className={`${cardClass} flex items-center gap-3 p-3.5 focus-visible:outline-none focus-visible:ring-2`} style={cardStyle}>
          <ImagePlus size={20} aria-hidden style={{ color: "var(--accent-text)" }} />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
              {s.share.nextPhotos}
            </span>
            <span className="block text-[13px]" style={{ color: "var(--text-muted)" }}>
              {s.share.nextPhotosBody}
            </span>
          </span>
        </Link>
        <Link href={href("/calendar")} className={`${cardClass} flex items-center gap-3 p-3.5 focus-visible:outline-none focus-visible:ring-2`} style={cardStyle}>
          <CalendarDays size={20} aria-hidden style={{ color: "var(--accent-text)" }} />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
              {s.share.nextCalendar}
            </span>
            <span className="block text-[13px]" style={{ color: "var(--text-muted)" }}>
              {s.share.nextCalendarBody}
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
