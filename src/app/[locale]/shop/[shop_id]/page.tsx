"use client";

import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getPublicServices } from "@/lib/queries/services";
import { getServiceIcon } from "@/lib/service-icon";
import { motion } from "framer-motion";
import { useTranslation, headingTracking } from "@/hooks/use-translation";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

interface ShopData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  google_maps_url: string | null;
}
interface ServiceData {
  id: string;
  name: string;
  name_ar: string | null;
  duration: number;
  price: number;
  icon: string;
}
interface ReviewData {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  clients: { name: string } | null;
}
interface BarberData {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

// Fallback stock photos only — the `shops`/`services` tables have no image
// column yet (see supabase/migrations/001_initial_schema.sql), so there is no
// real per-shop or per-service photo to show. These generic placeholders fill
// in until a photo column + upload flow exists.
const FALLBACK_SHOP_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDSCFMQFuOkdgX7Yi5aFyGJXWyFRL_0nsmIzQuSp9pTlpt0Jvzq7s8XQDRzmyMREhhu_R0pMPnXp1r9E7-w7Sl1lcker-7vzu2GkfOzpBimNcBYFpgelUb0ov4bh9zAzfSXHDJpnrLD7ON1LD3w9DS08fanZhKmjYKr_ovtIKPYVWSWY3XKrJhIm-fJ4XGFofFMjZ5sfasoDqch4mdVsdubVvgiVb50yUWBFIPtQpctKjRGuCABoP2bWgRF2sLf3Pwz3dLtvd9JKI-9",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCi3P0YWjSoB1W30rvVp7iaIzU52UVcRYzlZZxCqyS8oPQZgIcGRE80gF7jJr9736TXDTpefv_eH6Jj-o_jvyvFoaJTYsXFeqa1Nj7vvzJeaDpsdgYgGPSz-Ud7vQBfK1UfnpoqHsW6y-bi3x7Ot7yQNiG0k43hkr9-aJDf066iT8l3se2D1p2FzMq-EjLBHitsEEEFNc1PmwlmGN-v4Wv0dZM0hNSgH_BhbqAMPJUsrSM8BRn36lR5KOeGjmVfX05fJUrqZ6jDzwnY",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDL395efcii6egq6DbxYxfSxw9lPtASWvr9nyiIX3PDRD5DPM2aqD-bM24z4nlQJNFIo6duutRJce1FKomv5xJynkuGaW0lIyG9K81I9sKdFbDMa4ZlJBaVyqTtLKGyHgdrvugCLceYGsmCazNcaFoKYgZVmVbd0X-4DWwtJ5e_2xrcb-S5B2FuUTH6MxUgF-0fhNjhhQAleMA_50MfPbTo3QOjn5ysqxr19Eq5CPPMcDcTBff8hfbQCevSW-MLwmXp7v4SCUrkGcw7",
];

// Best-effort "city" extraction for the breadcrumb. Shop addresses in this
// app are freeform text (see `shops.address`), but every seeded example uses
// a "City, Street/Area" convention (e.g. "Amman, Abdoun"). We only trust the
// first comma-separated segment as a city when that convention is actually
// present (2+ segments) — a single freeform segment is ambiguous, so we
// omit the city rather than guess at one.
function parseCityFromAddress(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[0] : null;
}

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <span
          key={s}
          className="material-symbols-outlined"
          style={{ fontSize: size, color: s <= Math.round(rating) ? "#a67c3d" : "#ede3cd", fontVariationSettings: s <= Math.round(rating) ? "'FILL' 1" : "'FILL' 0" }}
        >star</span>
      ))}
    </div>
  );
}

function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-xs font-semibold text-[#5a5147] w-4">{star}</span>
      <span className="material-symbols-outlined text-[#a67c3d] text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
      <div className="flex-1 h-1.5 bg-[#ede3cd] rounded-full overflow-hidden">
        <div className="h-full bg-[#a67c3d] rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[#5a5147] w-6 text-right">{count}</span>
    </div>
  );
}

export default function ShopProfilePage() {
  const params = useParams();
  const router = useRouter();
  const shopId = params.shop_id as string;
  const supabase = createClient();
  const { t, dir, isRTL, FF } = useTranslation();

  const [shop, setShop] = useState<ShopData | null>(null);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [barbers, setBarbers] = useState<BarberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stickyVisible, setStickyVisible] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  // ── Hero image carousel (existing FALLBACK_SHOP_IMAGES only — no per-shop
  // photos exist yet) ──
  const [heroIndex, setHeroIndex] = useState(0);
  const heroTouchStartX = useRef<number | null>(null);
  const goToPrevImage = () =>
    setHeroIndex((i) => (i - 1 + FALLBACK_SHOP_IMAGES.length) % FALLBACK_SHOP_IMAGES.length);
  const goToNextImage = () =>
    setHeroIndex((i) => (i + 1) % FALLBACK_SHOP_IMAGES.length);
  const handleHeroTouchStart = (e: React.TouchEvent) => {
    heroTouchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const handleHeroTouchEnd = (e: React.TouchEvent) => {
    const startX = heroTouchStartX.current;
    heroTouchStartX.current = null;
    if (startX === null) return;
    const deltaX = e.changedTouches[0]?.clientX - startX;
    const SWIPE_THRESHOLD = 40;
    if (deltaX <= -SWIPE_THRESHOLD) goToNextImage();
    else if (deltaX >= SWIPE_THRESHOLD) goToPrevImage();
  };

  // ── "Save" is local-only UI state — there is no favorites table in this
  // codebase yet (checked src/lib and src/app for "favorite"), so this does
  // NOT persist anywhere: it resets on refresh and is not synced to the
  // account. It exists purely as a harmless UI affordance.
  const [isSaved, setIsSaved] = useState(false);

  // ── Share: Web Share API where available, falling back to copying the
  // page URL to the clipboard. ──
  const [shareFeedback, setShareFeedback] = useState<null | "shared" | "copied" | "failed">(null);
  const handleShare = async () => {
    const shareData = {
      title: shop?.name,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareFeedback("shared");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url);
        setShareFeedback("copied");
      } else {
        setShareFeedback("failed");
      }
    } catch {
      // User cancelled the native share sheet, or the clipboard write was
      // blocked — either way, no error state is worth surfacing.
    }
    setTimeout(() => setShareFeedback(null), 2200);
  };

  useEffect(() => {
    async function loadData() {
      if (!shopId) return;
      const [shopRes, servicesData, reviewsRes, barbersRes] = await Promise.all([
        supabase.from("shops").select("id, name, address, phone, email, instagram, google_maps_url").eq("id", shopId).single(),
        getPublicServices(supabase, shopId),
        supabase.from("reviews").select("id, rating, comment, created_at, clients(name)").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(30),
        supabase.from("profiles").select("id, full_name, avatar_url").eq("shop_id", shopId).eq("role", "barber"),
      ]);
      if (shopRes.data) setShop(shopRes.data as ShopData);
      if (servicesData?.data) setServices(servicesData.data as ServiceData[]);
      if (reviewsRes.data) setReviews(reviewsRes.data as unknown as ReviewData[]);
      if (barbersRes.data) setBarbers(barbersRes.data as BarberData[]);
      setLoading(false);
    }
    loadData();
  }, [shopId]);

  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const heroBottom = heroRef.current.getBoundingClientRect().bottom;
        setStickyVisible(heroBottom < 0);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#1c1611] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#5a5147] font-medium">{isRTL ? "جاري تحميل المحل…" : "Loading shop…"}</p>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-[#f7f1e4] flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-[#5a5147] text-4xl">storefront</span>
        </div>
        <h2 className="text-2xl font-bold mb-2">{isRTL ? "المحل غير موجود" : "Shop Not Found"}</h2>
        <p className="text-[#5a5147] mb-8 max-w-sm">{isRTL ? "المحل الذي تبحث عنه غير موجود أو تمت إزالته." : "The shop you're looking for doesn't exist or has been removed."}</p>
        <Link href="/explore" className="btn-premium btn-premium-dark">{isRTL ? "→ العودة للاستكشاف" : "← Back to Explore"}</Link>
      </div>
    );
  }

  const avgRating = reviews.length > 0
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    : 0;
  const numReviews = reviews.length;
  const shopCity = parseCityFromAddress(shop.address);
  const startingPrice = services.length > 0 ? Math.min(...services.map((s) => s.price)) : null;

  // Rating breakdown
  const ratingCounts = [5,4,3,2,1].map(s => ({
    star: s,
    count: reviews.filter(r => r.rating === s).length,
  }));

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", fontFamily: FF, direction: dir }}>

      {/* ── Sticky booking bar (appears on scroll) ── */}
      <div className={`sticky-booking-bar ${stickyVisible ? "visible" : ""}`}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div>
            <p className="font-black text-[#1c1611] text-base" style={{ fontFamily: "var(--font-intervar),sans-serif" }}>
              {shop.name}
            </p>
            {numReviews > 0 && (
              <div className="flex items-center gap-1">
                <Stars rating={avgRating} size={12} />
                <span className="text-xs text-[#5a5147] font-semibold">{avgRating.toFixed(1)} ({numReviews})</span>
              </div>
            )}
          </div>
          <Link
            href={`/book/${shop.id}`}
            className="btn-premium btn-premium-dark"
            style={{ minHeight: 40, padding: "0 22px", fontSize: 13 }}
          >
            {t.explore.bookNow}
          </Link>
        </div>
      </div>

      {/* ── Top Bar (non-sticky) ── */}
      <header className="fixed top-0 w-full z-40 bg-transparent">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            aria-label={t.common.back}
            className="flex items-center gap-1.5 bg-white text-[#5a5147] hover:text-[#1c1611] transition-colors h-9 px-3.5 rounded-[8px] border border-[#ede3cd] text-sm font-semibold"
            style={{ cursor: "pointer" }}
          >
            <span className="material-symbols-outlined text-[18px]">{isRTL ? "arrow_forward" : "arrow_back"}</span>
            <span className="hidden sm:inline">{t.common.back}</span>
          </button>
          <Link
            href={`/book/${shop.id}`}
            className="bg-white text-[#1c1611] h-9 px-4 rounded-[8px] border border-[#ede3cd] text-sm font-bold hover:border-[#a67c3d] transition-all"
          >
            {t.explore.bookNow}
          </Link>
        </div>
      </header>

      {/* ── Breadcrumb (sits below the fixed top bar; scrolls away with the
           page, unlike the header) ── */}
      <nav aria-label={isRTL ? "مسار التنقل" : "Breadcrumb"} className="pt-16 bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3 border-b border-[#ede3cd] flex items-center gap-1.5 text-xs font-semibold text-[#5a5147] overflow-x-auto no-scrollbar whitespace-nowrap">
          <Link href="/" className="hover:text-[#1c1611] transition-colors shrink-0">
            {isRTL ? "الرئيسية" : "Home"}
          </Link>
          <span className="text-[#ede3cd] shrink-0">/</span>
          <Link href="/explore" className="hover:text-[#1c1611] transition-colors shrink-0">
            {isRTL ? "الحلاقين" : "Barbers"}
          </Link>
          {shopCity && (
            <>
              <span className="text-[#ede3cd] shrink-0">/</span>
              <span className="shrink-0">{shopCity}</span>
            </>
          )}
          <span className="text-[#ede3cd] shrink-0">/</span>
          <span className="text-[#1c1611] font-bold shrink-0" aria-current="page">{shop.name}</span>
        </div>
      </nav>

      {/* ── Hero image carousel ── */}
      <div
        ref={heroRef}
        className="relative h-72 sm:h-96 overflow-hidden bg-[#1c1611]"
        onTouchStart={handleHeroTouchStart}
        onTouchEnd={handleHeroTouchEnd}
      >
        {FALLBACK_SHOP_IMAGES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${shop.name} ${i + 1}/${FALLBACK_SHOP_IMAGES.length}`}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
            style={{ opacity: i === heroIndex ? 0.6 : 0 }}
            aria-hidden={i !== heroIndex}
          />
        ))}
        <div className="absolute inset-0 bg-[#1c1611]/60" />

        {/* Floating circular save / share buttons, overlaid on the photo —
            no back button here: the fixed top bar's own Back control sits
            in the exact same corner and duplicating it just stacked two
            identical controls on top of each other. */}
        <div className="absolute top-4 end-4 z-20 flex items-center gap-2">
          <button
            onClick={() => setIsSaved((v) => !v)}
            aria-label={isSaved ? (isRTL ? "إزالة من المحفوظات" : "Remove from saved") : (isRTL ? "حفظ" : "Save")}
            aria-pressed={isSaved}
            className="w-10 h-10 rounded-full bg-white/95 hover:bg-white flex items-center justify-center shadow-md transition-colors"
            style={{ cursor: "pointer" }}
          >
            <span
              className="material-symbols-outlined text-xl"
              style={{ color: isSaved ? "#a67c3d" : "#1c1611", fontVariationSettings: isSaved ? "'FILL' 1" : "'FILL' 0" }}
            >favorite</span>
          </button>
          <div className="relative">
            <button
              onClick={handleShare}
              aria-label={t.common.share}
              className="w-10 h-10 rounded-full bg-white/95 hover:bg-white flex items-center justify-center shadow-md transition-colors"
              style={{ cursor: "pointer" }}
            >
              <span className="material-symbols-outlined text-[#1c1611] text-xl">share</span>
            </button>
            {shareFeedback && (
              <div className="absolute top-12 end-0 z-30 whitespace-nowrap bg-[#1c1611] text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-md">
                {shareFeedback === "copied" && (isRTL ? "تم نسخ الرابط" : "Link copied")}
                {shareFeedback === "shared" && (isRTL ? "تمت المشاركة" : "Shared")}
                {shareFeedback === "failed" && (isRTL ? "تعذرت المشاركة" : "Couldn't share")}
              </div>
            )}
          </div>
        </div>

        {/* Prev / next arrows + counter — only meaningful with 2+ photos */}
        {FALLBACK_SHOP_IMAGES.length > 1 && (
          <>
            <button
              onClick={goToPrevImage}
              aria-label={isRTL ? "الصورة السابقة" : "Previous photo"}
              className="absolute start-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md transition-colors"
              style={{ cursor: "pointer" }}
            >
              <span className="material-symbols-outlined text-[#1c1611] text-lg">chevron_left</span>
            </button>
            <button
              onClick={goToNextImage}
              aria-label={isRTL ? "الصورة التالية" : "Next photo"}
              className="absolute end-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md transition-colors"
              style={{ cursor: "pointer" }}
            >
              <span className="material-symbols-outlined text-[#1c1611] text-lg">chevron_right</span>
            </button>
            <div className="absolute bottom-4 end-4 z-20 bg-black/50 text-white text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
              {heroIndex + 1}/{FALLBACK_SHOP_IMAGES.length}
            </div>
          </>
        )}

        <div className="absolute bottom-0 left-0 right-0 px-5 sm:px-8 pb-8 max-w-6xl mx-auto">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-2"
            style={{ fontFamily: "var(--font-intervar),sans-serif", letterSpacing: "0.018em" }}
          >
            {shop.name}
          </h1>
          {/* Compact info row: rating + review count, and address, in one line */}
          {(numReviews > 0 || shop.address) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
              {numReviews > 0 && (
                <div className="flex items-center gap-1.5">
                  <Stars rating={avgRating} size={14} />
                  <span className="text-white font-bold">{avgRating.toFixed(1)}</span>
                  <span className="text-white/60">({numReviews} {numReviews === 1 ? t.booking.review : t.booking.reviews})</span>
                </div>
              )}
              {shop.address && (
                <div className="flex items-center gap-1.5 text-white/70 font-medium">
                  <span className="material-symbols-outlined text-base">location_on</span>
                  {shop.address}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="pb-28 lg:pb-16">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:grid lg:grid-cols-[1fr_360px] lg:gap-10 lg:items-start">
        <div>

          {/* ── Quick Info Cards — mobile/tablet only; the sticky sidebar
               covers this job on desktop ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 -mt-6 relative z-20 mb-12 lg:hidden">
            {[
              shop.phone && {
                href: `tel:${shop.phone}`,
                icon: "call",
                label: t.leads.phone,
                value: shop.phone,
              },
              shop.instagram && {
                href: `https://instagram.com/${shop.instagram.replace("@", "")}`,
                icon: "photo_camera",
                label: t.booking.instagram,
                value: shop.instagram,
                external: true,
              },
              shop.google_maps_url && {
                href: shop.google_maps_url,
                icon: "map",
                label: t.booking.location,
                value: isRTL ? "عرض على الخريطة" : "View on Map",
                external: true,
              },
            ].filter((info): info is { href: string; icon: string; label: string; value: string; external?: boolean } => Boolean(info)).map((info, i) => (
              <motion.a
                key={i}
                href={info.href}
                target={info.external ? "_blank" : undefined}
                rel={info.external ? "noopener noreferrer" : undefined}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-[#ede3cd] hover:border-[#a67c3d] hover:-translate-y-0.5 group transition-all"
              >
                <div className="w-11 h-11 rounded-full bg-[#f7f1e4] flex items-center justify-center group-hover:bg-[#1c1611] group-hover:text-white transition-colors shrink-0">
                  <span className="material-symbols-outlined text-lg text-[#5a5147] group-hover:text-white transition-colors">{info.icon}</span>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#5a5147]">{info.label}</p>
                  <p className="font-bold text-sm text-[#1c1611]">{info.value}</p>
                </div>
              </motion.a>
            ))}
          </div>

          {/* ── Services ── */}
          {services.length > 0 && (
            <section className="mb-14">
              <div className="flex items-center gap-4 mb-7">
                <h2 className="text-xl font-black text-[#1c1611] shrink-0" style={{ fontFamily: FF }}>
                  {t.booking.services}
                </h2>
                <div className="flex-1 h-px bg-[#ede3cd]" />
                <span className="text-xs font-bold text-[#5a5147] uppercase tracking-wider shrink-0">{isRTL ? `${services.length} متاح` : `${services.length} Available`}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {services.map((service, idx) => (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className="flex items-center justify-between p-4 bg-white rounded-2xl border border-[#ede3cd] hover:border-[#a67c3d] hover:-translate-y-0.5 transition-all group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-[#f7f1e4] flex items-center justify-center shrink-0 group-hover:bg-[#1c1611] transition-colors">
                        <span className="material-symbols-outlined text-xl text-[#5a5147] group-hover:text-white transition-colors">
                          {getServiceIcon(service.name)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-bold text-[#1c1611] text-sm">{isRTL && service.name_ar ? service.name_ar : service.name}</h3>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-[#5a5147] font-medium">
                          <span className="material-symbols-outlined text-[13px]">schedule</span>
                          {service.duration} {isRTL ? "دقيقة" : "min"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="font-black text-[#1c1611] text-base">{service.price} {t.common.jod}</span>
                      <Link
                        href={`/book/${shop.id}`}
                        className="text-xs font-bold text-[#1c1611] underline underline-offset-2 hover:no-underline transition-all"
                      >
                        {isRTL ? "احجز ←" : "Book →"}
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* ── Barbers ── */}
          {barbers.length > 0 && (
            <section className="mb-14">
              <div className="flex items-center gap-4 mb-7">
                <h2 className="text-xl font-black text-[#1c1611] shrink-0" style={{ fontFamily: FF }}>
                  {isRTL ? "فريقنا" : "Our Team"}
                </h2>
                <div className="flex-1 h-px bg-[#ede3cd]" />
                <span className="text-xs font-bold text-[#5a5147] uppercase tracking-wider shrink-0">
                  {isRTL
                    ? `${barbers.length} ${barbers.length === 1 ? "حلاق" : "حلاقين"}`
                    : `${barbers.length} ${barbers.length === 1 ? "Barber" : "Barbers"}`}
                </span>
              </div>
              {/* Horizontal scroll row */}
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
                {barbers.map((barber, i) => (
                  <motion.div
                    key={barber.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.06 }}
                    className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group"
                    style={{ width: 88 }}
                  >
                    <div className="w-16 h-16 rounded-full bg-[#f7f1e4] overflow-hidden border-2 border-transparent group-hover:border-[#1c1611] transition-all">
                      {barber.avatar_url ? (
                        <img src={barber.avatar_url} alt={barber.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-black text-[#5a5147] group-hover:text-[#1c1611] transition-colors">
                          {barber.full_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-[#1c1611] line-clamp-1">{barber.full_name.split(" ")[0]}</p>
                      <p className="text-[10px] text-[#5a5147]">{t.calendar.barber}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* ── Reviews ── */}
          {reviews.length > 0 && (
            <section className="mb-14">
              <div className="flex items-center gap-4 mb-7">
                <h2 className="text-xl font-black text-[#1c1611] shrink-0" style={{ fontFamily: FF }}>
                  {isRTL ? "التقييمات" : "Reviews"}
                </h2>
                <div className="flex-1 h-px bg-[#ede3cd]" />
              </div>

              {/* Rating summary */}
              <div className="bg-white rounded-2xl border border-[#ede3cd] p-6 mb-6">
                <div className="flex gap-8 items-start">
                  {/* Big number */}
                  <div className="text-center shrink-0">
                    <div
                      className="text-5xl font-black text-[#1c1611] leading-none"
                      style={{ fontFamily: "var(--font-intervar),sans-serif", letterSpacing: "0.018em" }}
                    >
                      {avgRating.toFixed(1)}
                    </div>
                    <Stars rating={avgRating} size={16} />
                    <p className="text-xs text-[#5a5147] font-semibold mt-1">{numReviews} {numReviews === 1 ? t.booking.review : t.booking.reviews}</p>
                  </div>
                  {/* Bar chart */}
                  <div className="flex-1 space-y-2">
                    {ratingCounts.map(({ star, count }) => (
                      <RatingBar key={star} star={star} count={count} total={numReviews} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Individual reviews */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviews.slice(0, 6).map((review, i) => (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="bg-white rounded-2xl border border-[#ede3cd] p-5"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-9 h-9 rounded-full bg-[#1c1611] text-white flex items-center justify-center text-sm font-bold shrink-0"
                      >
                        {review.clients?.name?.charAt(0)?.toUpperCase() || "C"}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-[#1c1611]">{review.clients?.name || (isRTL ? "عميل" : "Customer")}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Stars rating={review.rating} size={12} />
                          <span className="text-xs text-[#5a5147]">
                            {isRTL
                              ? format(new Date(review.created_at), "d MMMM yyyy", { locale: arSA })
                              : format(new Date(review.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-[#5a5147] leading-relaxed ps-12 italic">
                        &ldquo;{review.comment}&rdquo;
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* ── Book CTA Banner — kept on all breakpoints; without it the
               page just stops dead after the reviews grid on desktop with
               nothing closing it out, even though the sidebar also has its
               own persistent Book Now button ── */}
          <section
            className="rounded-2xl p-8 md:p-12 text-center relative overflow-hidden mb-8"
            style={{ background: "#1c1611" }}
          >
            <div className="absolute inset-0 opacity-[0.06]" />
            <div className="relative z-10">
              <h2
                className="text-2xl sm:text-3xl font-black text-white mb-3"
                style={{ fontFamily: FF, letterSpacing: headingTracking(isRTL, "0.016em") }}
              >
                {isRTL ? "جاهز لقصة شعر جديدة؟" : "Ready for your next cut?"}
              </h2>
              <p className="text-white/60 mb-8 max-w-md mx-auto text-sm">
                {isRTL ? `احجز موعدك في ${shop.name} في أقل من دقيقة.` : `Book your appointment at ${shop.name} in under a minute.`}
              </p>
              <Link
                href={`/book/${shop.id}`}
                className="btn-premium btn-premium-outline inline-flex"
                style={{ minHeight: 52, padding: "0 40px" }}
              >
                {isRTL ? "احجز الآن ←" : "Book Now →"}
              </Link>
            </div>
          </section>
        </div>

        {/* ── Booking sidebar — desktop only (lg+), sticky while the left
             column scrolls. Replaces the quick-info-cards + closing CTA
             banner's job with one persistent panel instead of scattering
             "book now" prompts through the page. ── */}
        <aside className="hidden lg:block lg:sticky" style={{ top: 96 }}>
          <div className="bg-white rounded-2xl border border-[#ede3cd] p-6 shadow-[0_8px_30px_-14px_rgba(28,22,17,0.18)]">
            <h2 className="text-xl font-black text-[#1c1611] mb-1" style={{ fontFamily: FF }}>
              {shop.name}
            </h2>
            {numReviews > 0 && (
              <div className="flex items-center gap-1.5 mb-2">
                <Stars rating={avgRating} size={14} />
                <span className="text-sm font-bold text-[#1c1611]">{avgRating.toFixed(1)}</span>
                <span className="text-xs text-[#5a5147]">({numReviews} {numReviews === 1 ? t.booking.review : t.booking.reviews})</span>
              </div>
            )}
            {shop.address && (
              <div className="flex items-start gap-1.5 text-sm text-[#5a5147] font-medium mb-4">
                <span className="material-symbols-outlined text-base shrink-0">location_on</span>
                {shop.address}
              </div>
            )}

            {startingPrice !== null && (
              <div className="flex items-baseline gap-1.5 py-4 border-y border-[#ede3cd] mb-4">
                <span className="text-xs text-[#5a5147] font-semibold">{isRTL ? "يبدأ من" : "From"}</span>
                <span className="text-2xl font-black text-[#1c1611]">{startingPrice} {t.common.jod}</span>
              </div>
            )}

            <Link
              href={`/book/${shop.id}`}
              className="btn-premium btn-premium-dark w-full justify-center mb-4"
              style={{ minHeight: 52 }}
            >
              {t.explore.bookNow}
            </Link>
            <p className="text-center text-xs text-[#5a5147] mb-5">
              {isRTL ? "بدون دفع اليوم · إلغاء مجاني" : "No payment today · Free cancellation"}
            </p>

            {(shop.phone || shop.instagram || shop.google_maps_url) && (
              <div className="flex flex-col gap-1 pt-4 border-t border-[#ede3cd]">
                {shop.phone && (
                  <a href={`tel:${shop.phone}`} className="flex items-center gap-3 py-1.5 text-sm text-[#5a5147] hover:text-[#1c1611] transition-colors">
                    <span className="material-symbols-outlined text-[18px]">call</span>
                    {shop.phone}
                  </a>
                )}
                {shop.instagram && (
                  <a href={`https://instagram.com/${shop.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-1.5 text-sm text-[#5a5147] hover:text-[#1c1611] transition-colors">
                    <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                    {shop.instagram}
                  </a>
                )}
                {shop.google_maps_url && (
                  <a href={shop.google_maps_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-1.5 text-sm text-[#5a5147] hover:text-[#1c1611] transition-colors">
                    <span className="material-symbols-outlined text-[18px]">map</span>
                    {isRTL ? "عرض على الخريطة" : "View on Map"}
                  </a>
                )}
              </div>
            )}
          </div>
        </aside>
        </div>
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-5 pt-3 md:hidden bg-white"
        style={{ borderTop: "1px solid #ede3cd", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
        <button
          onClick={() => router.back()}
          className="flex flex-col items-center text-[#5a5147]"
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          <span className="material-symbols-outlined text-[22px]">{isRTL ? "arrow_forward" : "arrow_back"}</span>
          <span className="text-[10px] font-bold mt-0.5">{t.common.back}</span>
        </button>
        <Link
          href={`/book/${shop.id}`}
          className="flex items-center gap-2 bg-[#7c4a1e] text-white px-8 py-3 rounded-[8px] text-sm font-bold hover:opacity-90 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">event_available</span>
          {t.explore.bookNow}
        </Link>
        <Link className="flex flex-col items-center text-[#5a5147]" href="/customer">
          <span className="material-symbols-outlined text-[22px]">person</span>
          <span className="text-[10px] font-bold mt-0.5">{t.explore.navAccount}</span>
        </Link>
      </nav>
    </div>
  );
}
