"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation, headingTracking } from "@/hooks/use-translation";

interface ShopRow {
  id: string;
  name: string;
  address: string;
  google_maps_url: string | null;
}

// Per-shop cover tile: deterministic accent + initials instead of a handful
// of stock photos cycling round-robin across unrelated shops.
const COVER_PALETTE = [
  { bg: "#1c1611", fg: "#f7f1e4" },
  { bg: "#a67c3d", fg: "#ffffff" },
  { bg: "#5a5147", fg: "#f7f1e4" },
];

function coverForShop(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COVER_PALETTE[hash % COVER_PALETTE.length];
}

function shopInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase();
}

// FF is direction-aware — set per render from useTranslation hook
const FF_DEFAULT = "var(--font-jakarta),'Segoe UI',system-ui,sans-serif";

// Inline container style — guaranteed to work regardless of Tailwind purging
const containerStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "0 32px",
  width: "100%",
  boxSizing: "border-box",
};

function SkeletonCard() {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #ede3cd",
      }}
    >
      <div
        style={{
          aspectRatio: "4/3",
          background: "#f7f1e4",
          animation: "shimmerMove 1.6s ease-in-out infinite",
        }}
      />
      <div style={{ padding: 20 }}>
        <div style={{ height: 10, width: "30%", background: "#f7f1e4", borderRadius: 8, marginBottom: 10 }} />
        <div style={{ height: 20, width: "70%", background: "#f7f1e4", borderRadius: 8, marginBottom: 8 }} />
        <div style={{ height: 14, width: "50%", background: "#f7f1e4", borderRadius: 8 }} />
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [cheapestService, setCheapestService] = useState<Record<string, { price: number; duration: number }>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { FF, dir, t, isRTL } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
      const { data } = await supabase
        .from("shops")
        .select("id, name, address, google_maps_url")
        .order("name");
      if (data) {
        setShops(data as ShopRow[]);
        const shopIds = (data as ShopRow[]).map(s => s.id);
        if (shopIds.length > 0) {
          const { data: reviewRows } = await supabase
            .from("reviews")
            .select("shop_id, rating")
            .in("shop_id", shopIds);
          if (reviewRows) {
            const totals: Record<string, { sum: number; count: number }> = {};
            for (const r of reviewRows as { shop_id: string; rating: number }[]) {
              const bucket = totals[r.shop_id] || { sum: 0, count: 0 };
              bucket.sum += r.rating;
              bucket.count += 1;
              totals[r.shop_id] = bucket;
            }
            const computed: Record<string, { avg: number; count: number }> = {};
            Object.entries(totals).forEach(([shopId, v]) => {
              computed[shopId] = { avg: v.sum / v.count, count: v.count };
            });
            setRatings(computed);
          }

          // Real per-shop "from" price + duration, computed from each shop's
          // actual services (cheapest service wins) — mirrors the field
          // selection used by getPublicServices() in lib/queries/services.ts,
          // fetched in bulk here (one query for all shops on this listing)
          // rather than one getPublicServices() call per shop.
          const { data: serviceRows } = await supabase
            .from("services")
            .select("shop_id, duration, price")
            .in("shop_id", shopIds)
            .order("price", { ascending: true });
          if (serviceRows) {
            const cheapest: Record<string, { price: number; duration: number }> = {};
            for (const svc of serviceRows as { shop_id: string; duration: number; price: number }[]) {
              if (!(svc.shop_id in cheapest)) {
                cheapest[svc.shop_id] = { price: svc.price, duration: svc.duration };
              }
            }
            setCheapestService(cheapest);
          }
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const filtered = shops.filter(s => {
    const q = searchTerm.trim().toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || (s.address || "").toLowerCase().includes(q);
  });

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", fontFamily: FF, color: "#1c1611", direction: dir }}>

      {/* ── Global shimmer keyframes ── */}
      <style>{`
        @keyframes shimmerMove {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.5); }
        }
        * { box-sizing: border-box; }
      `}</style>

      {/* ════════════════════════════════════
          STICKY NAVBAR
      ════════════════════════════════════ */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "#ffffff",
          borderBottom: `1px solid ${scrolled ? "#ede3cd" : "transparent"}`,
          transition: "all 280ms ease",
        }}
      >
        <div style={{ ...containerStyle, height: 64, display: "flex", alignItems: "center", gap: 24 }}>

          {/* Logo */}
          <Link
            href={isLoggedIn ? "/customer" : "/landing"}
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: "#1c1611",
              textDecoration: "none",
              letterSpacing: "0.01em",
              fontFamily: "var(--font-intervar), sans-serif",
              flexShrink: 0,
            }}
          >
            Halaqy.
          </Link>

          {/* Search — shrinks to fit on mobile now that Sign In/Get Started
              are hidden below md (the bottom tab bar covers account access there) */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              maxWidth: 440,
              display: "flex",
              alignItems: "center",
              height: 40,
              gap: 10,
              paddingInlineStart: 14,
              paddingInlineEnd: 12,
              background: "#f7f1e4",
              borderRadius: 8,
              border: "1.5px solid #ede3cd",
              transition: "all 150ms ease",
              cursor: "text",
            }}
            onClick={() => inputRef.current?.focus()}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17, color: "#5a5147", flexShrink: 0 }}>search</span>
            <input
              ref={inputRef}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t.explore.searchPlaceholder}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                fontSize: 13,
                fontWeight: 500,
                color: "#1c1611",
                fontFamily: FF,
                minWidth: 0,
              }}
              onFocus={e => {
                const p = e.currentTarget.parentElement!;
                p.style.borderColor = "#a67c3d";
                p.style.background = "#fff";
                p.style.boxShadow = "var(--shadow-focus)";
              }}
              onBlur={e => {
                const p = e.currentTarget.parentElement!;
                p.style.borderColor = "#ede3cd";
                p.style.background = "#f7f1e4";
                p.style.boxShadow = "none";
              }}
            />
            {searchTerm && (
              <button
                onClick={e => { e.stopPropagation(); setSearchTerm(""); }}
                aria-label={t.explore.clearSearch}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "#5a5147", padding: 0, flexShrink: 0 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            )}
          </div>

          {/* Nav actions — hidden on mobile; the bottom tab bar's Account
              link covers sign-in there, and there's no room for both. */}
          <div className="hidden md:flex" style={{ alignItems: "center", gap: 8, marginInlineStart: "auto", flexShrink: 0 }}>
            {isLoggedIn ? (
              <Link
                href="/customer"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 13, fontWeight: 600, color: "#5a5147",
                  textDecoration: "none", padding: "6px 12px", borderRadius: 8,
                  transition: "background 120ms",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f7f1e4")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>event_note</span>
                {t.explore.myBookings}
              </Link>
            ) : (
              <Link
                href="/auth/login"
                style={{ fontSize: 13, fontWeight: 600, color: "#5a5147", textDecoration: "none", padding: "6px 12px" }}
              >
                {t.explore.signIn}
              </Link>
            )}
            <Link
              href={isLoggedIn ? "/customer" : "/auth/login"}
              style={{
                display: "flex", alignItems: "center",
                fontSize: 13, fontWeight: 700,
                background: "#7c4a1e", color: "#fff",
                textDecoration: "none",
                padding: "9px 20px", borderRadius: 8,
                transition: "all 150ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#a67c3d"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#7c4a1e"; e.currentTarget.style.transform = "none"; }}
            >
              {isLoggedIn ? t.explore.dashboard : t.explore.getStarted}
            </Link>
          </div>
        </div>
      </header>

      <main style={{ paddingTop: 64 }}>

        {/* ════════════════════════════════════
            HERO SECTION
        ════════════════════════════════════ */}
        <section
          style={{
            background: "#fff",
            borderBottom: "1px solid #ede3cd",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ ...containerStyle, position: "relative", zIndex: 1 }}>
            <div style={{ padding: "72px 0 64px" }}>
              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
              >
                {/* Label chip */}
                <div
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: 9999,
                    background: "#f7f1e4", marginBottom: 28,
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: headingTracking(isRTL, "0.1em"), color: "#5a5147",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1", color: "#a67c3d" }}>location_city</span>
                  {t.explore.premierDir}
                </div>

                {/* Headline */}
                <h1
                  style={{
                    fontSize: "clamp(40px, 5.5vw, 68px)",
                    fontWeight: 900,
                    fontFamily: FF,
                    letterSpacing: headingTracking(isRTL, "0.018em"),
                    lineHeight: 1.04,
                    color: "#1c1611",
                    margin: "0 0 20px",
                  }}
                >
                  {t.explore.findNext}<br />
                  <span style={{ color: "#5a5147" }}>{t.explore.perfectCut}</span>
                </h1>

                <p
                  style={{
                    fontSize: 17,
                    color: "#5a5147",
                    lineHeight: 1.65,
                    maxWidth: 520,
                    margin: "0 0 36px",
                    fontWeight: 400,
                  }}
                >
                  {t.explore.subtitle}
                </p>

                {/* Trust pills */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {[
                    { icon: "storefront",       text: t.explore.shopsInfo.replace('{count}', loading ? "—" : shops.length.toString()) },
                    { icon: "star",             text: t.explore.avgRating },
                    { icon: "event_available",  text: t.explore.freeCancel },
                    { icon: "payments",         text: t.explore.payInShop },
                  ].map(t => (
                    <span
                      key={t.text}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 7,
                        padding: "8px 16px",
                        background: "#fff",
                        border: "1.5px solid #ede3cd",
                        borderRadius: 9999,
                        fontSize: 13, fontWeight: 600, color: "#5a5147",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: "'FILL' 1", color: "#a67c3d" }}>{t.icon}</span>
                      {t.text}
                    </span>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════
            RESULTS BAR
        ════════════════════════════════════ */}
        <div
          style={{
            position: "sticky",
            top: 64,
            zIndex: 50,
            background: "#fff",
            borderBottom: "1px solid #ede3cd",
          }}
        >
          <div style={{ ...containerStyle, display: "flex", alignItems: "center", paddingTop: 12, paddingBottom: 12 }}>
            {!loading && (
              <span style={{ fontSize: 12, fontWeight: 600, color: "#5a5147", whiteSpace: "nowrap" }}>
                {t.explore.found.replace('{count}', filtered.length.toString())}
              </span>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════
            SHOP GRID
        ════════════════════════════════════ */}
        <div style={{ ...containerStyle, paddingTop: 40, paddingBottom: 80 }}>
          {loading ? (
            <div
              className="explore-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 20,
              }}
            >
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                textAlign: "center", padding: "80px 20px",
              }}
            >
              <div
                style={{
                  width: 72, height: 72, borderRadius: "50%", background: "#f7f1e4",
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: "#5a5147" }}>search_off</span>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1c1611", marginBottom: 8 }}>{t.explore.noResults}</h3>
              <p style={{ fontSize: 14, color: "#5a5147", marginBottom: 24, maxWidth: 320 }}>
                {t.explore.tryDifferent}
              </p>
              <button
                onClick={() => setSearchTerm("")}
                style={{
                  background: "#1c1611", color: "#fff",
                  padding: "10px 28px", borderRadius: 9999,
                  fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", fontFamily: FF,
                }}
              >
                {t.explore.clearSearch}
              </button>
            </div>
          ) : (
            <div
              className="explore-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 20,
              }}
            >
              <AnimatePresence>
                {filtered.map((shop, idx) => {
                  const cover = coverForShop(shop.id);
                  const cheapest = cheapestService[shop.id];

                  return (
                    <motion.div
                      key={shop.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: idx * 0.05, ease: [0.25, 1, 0.5, 1] }}
                      style={{
                        background: "#fff",
                        borderRadius: 12,
                        overflow: "hidden",
                        border: "1px solid #ede3cd",
                        transition: "transform 150ms ease",
                        cursor: "pointer",
                      }}
                      whileHover={{ y: -4 }}
                    >
                      {/* Cover tile — per-shop accent + initials (no stock photos) */}
                      <div
                        style={{
                          position: "relative",
                          overflow: "hidden",
                          aspectRatio: "4/3",
                          background: cover.bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ position: "absolute", fontSize: 120, color: cover.fg, opacity: 0.12 }}
                          aria-hidden="true"
                        >content_cut</span>
                        <span
                          style={{
                            fontSize: 40, fontWeight: 900, color: cover.fg,
                            fontFamily: "var(--font-intervar), sans-serif",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {shopInitials(shop.name)}
                        </span>
                      </div>

                      {/* Card body */}
                      <div style={{ padding: "18px 20px 20px" }}>
                        <Link href={`/shop/${shop.id}`} style={{ textDecoration: "none" }}>
                          <h3
                            style={{
                              fontSize: 16,
                              fontWeight: 900,
                              color: "#1c1611",
                              letterSpacing: "0.012em",
                              fontFamily: "var(--font-intervar), sans-serif",
                              margin: "0 0 5px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {shop.name}
                          </h3>
                        </Link>
                        {ratings[shop.id] && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: 14, color: "#a67c3d", fontVariationSettings: "'FILL' 1" }}
                            >star</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#1c1611" }}>
                              {ratings[shop.id].avg.toFixed(1)}
                            </span>
                            <span style={{ fontSize: 12, color: "#5a5147", fontWeight: 500 }}>
                              ({ratings[shop.id].count})
                            </span>
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 13, color: "#5a5147" }}>location_on</span>
                          <span style={{ fontSize: 13, color: "#5a5147", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {shop.address || t.explore.locationUnavailable}
                          </span>
                        </div>

                        {/* Footer */}
                        <div
                          style={{
                            display: "flex", alignItems: "center",
                            justifyContent: cheapest ? "space-between" : "flex-end",
                            paddingTop: 14, borderTop: "1px solid #ede3cd",
                          }}
                        >
                          {cheapest && (
                            <div>
                              <span style={{ fontSize: 15, fontWeight: 800, color: "#1c1611" }}>
                                {t.explore.fromPrice.replace("{price}", cheapest.price.toString())}
                              </span>
                              <span style={{ fontSize: 12, color: "#5a5147", marginInlineStart: 6 }}>
                                · {t.explore.serviceDuration.replace("{duration}", cheapest.duration.toString())}
                              </span>
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 8 }}>
                            <Link
                              href={`/shop/${shop.id}`}
                              style={{
                                padding: "7px 14px", borderRadius: 9999,
                                fontSize: 12, fontWeight: 700,
                                background: "#f7f1e4", color: "#5a5147",
                                textDecoration: "none", border: "none",
                                transition: "all 120ms ease",
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = "#ede3cd")}
                              onMouseLeave={e => (e.currentTarget.style.background = "#f7f1e4")}
                            >
                              {t.explore.view}
                            </Link>
                            <Link
                              href={`/book/${shop.id}`}
                              style={{
                                padding: "7px 16px", borderRadius: 9999,
                                fontSize: 12, fontWeight: 700,
                                background: "#1c1611", color: "#fff",
                                textDecoration: "none",
                                transition: "all 120ms ease",
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = "#5a5147"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "#1c1611"; e.currentTarget.style.transform = "none"; }}
                            >
                              {t.explore.bookNow}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════
            BOTTOM CTA
        ════════════════════════════════════ */}
        <div style={{ ...containerStyle, paddingBottom: 80 }}>
          <div
            style={{
              borderRadius: 12,
              padding: "56px 48px",
              textAlign: "center",
              background: "#1c1611",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "relative", zIndex: 1 }}>
              <h2
                style={{
                  fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 900,
                  color: "#fff", letterSpacing: headingTracking(isRTL, "0.014em"),
                  fontFamily: FF,
                  margin: "0 0 12px",
                }}
              >
                {t.explore.readyToLook}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 15, margin: "0 0 32px" }}>
                {isLoggedIn ? t.explore.bookNextInSeconds : t.explore.createFreeAccount}
              </p>
              <Link
                href={isLoggedIn ? "/customer" : "/auth/signup"}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "14px 36px", borderRadius: 9999,
                  background: "#fff", color: "#1c1611",
                  fontWeight: 700, fontSize: 15, textDecoration: "none",
                  transition: "all 150ms ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
              >
                {isLoggedIn ? t.explore.goToDashboard : t.explore.getStartedFree}
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ════════════════════════════════════
          MOBILE BOTTOM NAV
      ════════════════════════════════════ */}
      <nav
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
          background: "#ffffff",
          borderTop: "1px solid #ede3cd",
          padding: "12px 16px max(16px, env(safe-area-inset-bottom))",
        }}
        className="md:hidden flex justify-around items-center"
      >
        <Link href="/explore" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, textDecoration: "none" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f7f1e4", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#1c1611" }}>search</span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#1c1611" }}>{t.explore.navExplore}</span>
        </Link>
        <Link href="/customer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, textDecoration: "none" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#5a5147" }}>event_note</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#5a5147" }}>{t.explore.navBookings}</span>
        </Link>
        <Link href={isLoggedIn ? "/customer" : "/auth/login"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, textDecoration: "none" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#5a5147" }}>person</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#5a5147" }}>{t.explore.navAccount}</span>
        </Link>
      </nav>

      {/* responsive grid breakpoints */}
      <style>{`
        @media (max-width: 900px) {
          .explore-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 560px) {
          .explore-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
