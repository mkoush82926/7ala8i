"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { CalendarDays, Check, ChevronRight, Copy, Download, ExternalLink, ImagePlus, MessageCircle, Share2 } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { Confetti } from "@/components/ui/confetti";
import { Button } from "@/components/ui/button";
import { buttonClasses, focusRing, labelClasses } from "@/components/ui/recipes";
import { cn } from "@/lib/utils";
import { bookingLink, qrFileName, whatsappShareUrl } from "../_lib/wizard";
import { StepHeader, cardClass } from "./ui";

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

  const nextLinks = [
    { href: `${href("/settings/profile")}#photos`, icon: ImagePlus, title: s.share.nextPhotos, body: s.share.nextPhotosBody },
    { href: href("/calendar"), icon: CalendarDays, title: s.share.nextCalendar, body: s.share.nextCalendarBody },
  ];

  return (
    <div>
      {celebrate && <Confetti trigger />}
      <div className="mb-2 flex justify-center sm:justify-start">
        <span
          aria-hidden
          className="grid size-16 place-items-center rounded-full bg-success-soft text-success-text"
        >
          <Check size={30} strokeWidth={2.5} />
        </span>
      </div>
      <div className="text-center sm:text-start">
        <StepHeader
          eyebrow={s.share.eyebrow}
          title={interpolate(s.share.title, { name: shopName })}
          subtitle={marketplaceVisible ? s.share.subtitleMarketplace : s.share.subtitleLinkOnly}
        />
      </div>

      <div className={cn(cardClass, "p-4 shadow-card sm:p-5")}>
        <p className={labelClasses}>{s.share.linkLabel}</p>
        <div className="flex items-stretch gap-2">
          <output
            dir="ltr"
            className="flex h-12 min-w-0 flex-1 items-center truncate rounded-lg border border-line bg-sunken px-4 text-[15px] font-medium text-ink"
            aria-label={s.share.linkLabel}
          >
            {link || "…"}
          </output>
          <Button
            variant="secondary"
            className="h-12 shrink-0 px-4"
            onClick={copy}
            disabled={!link}
            icon={copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          >
            <span>{copied ? s.share.copiedShort : s.share.copy}</span>
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <a
            href={whatsappShareUrl(message)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "primary", fullWidth: true })}
            aria-disabled={!link || undefined}
          >
            <MessageCircle aria-hidden />
            {s.share.whatsapp}
          </a>
          {canShare ? (
            <Button variant="secondary" fullWidth onClick={nativeShare} disabled={!link} icon={<Share2 aria-hidden />}>
              {s.share.more}
            </Button>
          ) : (
            <a href={link || undefined} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary", fullWidth: true })}>
              <ExternalLink aria-hidden />
              {s.share.preview}
            </a>
          )}
        </div>
      </div>

      <div className={cn(cardClass, "mt-4 flex flex-col items-center gap-4 p-5 shadow-card sm:flex-row sm:items-center sm:gap-6")}>
        <div ref={qrWrap} className="rounded-xl border border-line bg-white p-3" aria-hidden={!link}>
          {link ? (
            <QRCodeCanvas
              value={link}
              size={168}
              level="M"
              marginSize={0}
              fgColor="#0F172A"
              bgColor="#ffffff"
              role="img"
              aria-label={interpolate(s.share.qrAlt, { name: shopName })}
            />
          ) : (
            <div className="size-[168px]" />
          )}
        </div>
        <div className="text-center sm:text-start">
          <p className="text-title text-ink">{s.share.qrTitle}</p>
          <p className="mt-1 text-[13px] text-ink-muted">{s.share.qrBody}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={downloadQr} disabled={!link} icon={<Download aria-hidden />}>
            {s.share.qrDownload}
          </Button>
        </div>
      </div>

      <h2 className="text-h3 mb-3 mt-10 text-ink">{s.share.nextTitle}</h2>
      <div className="flex flex-col gap-3">
        {nextLinks.map(({ href: to, icon: Icon, title, body }) => (
          <Link
            key={to}
            href={to}
            className={cn(
              cardClass,
              "group flex items-center gap-3 p-4 no-underline transition-[border-color,box-shadow] duration-150 hover:border-ink-soft hover:shadow-raised",
              focusRing,
            )}
          >
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-text">
              <Icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-title block text-ink">{title}</span>
              <span className="block text-[13px] text-ink-muted">{body}</span>
            </span>
            <ChevronRight size={18} aria-hidden className="shrink-0 text-ink-muted rtl:rotate-180" />
          </Link>
        ))}
      </div>
    </div>
  );
}
