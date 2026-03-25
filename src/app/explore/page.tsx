"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface ShopRow {
  id: string;
  name: string;
  address: string;
  google_maps_url: string | null;
}

const SHOP_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA7Bsh2lEbD6ZTy5h9T1ZG2MfsCUuywaaZd_nDq-ITBCub76GRU6XIlZTHFIOusrp-JJ09EY9hZIjSKHLqnLzJfWCNu69nSF9e1itU_wlbDpZS5P3oKnHge0HXclB_FldVVgc0CztwnMJvSXaFvlCVR-NgFXTd--q1AfHMIHEy0DUze4UyYtmmM0GoN-gVDSNGchj-GxzY4-HtCnSHTY5Qs2s-4Tfv3m3YaHGC1dWQF9kDDUDLMwPV5_NaI5cgUrBO8y0bjvwJEh01V",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDSCFMQFuOkdgX7Yi5aFyGJXWyFRL_0nsmIzQuSp9pTlpt0Jvzq7s8XQDRzmyMREhhu_R0pMPnXp1r9E7-w7Sl1lcker-7vzu2GkfOzpBimNcBYFpgelUb0ov4bh9zAzfSXHDJpnrLD7ON1LD3w9DS08fanZhKmjYKr_ovtIKPYVWSWY3XKrJhIm-fJ4XGFofFMjZ5sfasoDqch4mdVsdubVvgiVb50yUWBFIPtQpctKjRGuCABoP2bWgRF2sLf3Pwz3dLtvd9JKI-9",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCi3P0YWjSoB1W30rvVp7iaIzU52UVcRYzlZZxCqyS8oPQZgIcGRE80gF7jJr9736TXDTpefv_eH6Jj-o_jvyvFoaJTYsXFeqa1Nj7vvzJeaDpsdgYgGPSz-Ud7vQBfK1UfnpoqHsW6y-bi3x7Ot7yQNiG0k43hkr9-aJDf066iT8l3se2D1p2FzMq-EjLBHitsEEEFNc1PmwlmGN-v4Wv0dZM0hNSgH_BhbqAMPJUsrSM8BRn36lR5KOeGjmVfX05fJUrqZ6jDzwnY",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDL395efcii6egq6DbxYxfSxw9lPtASWvr9nyiIX3PDRD5DPM2aqD-bM24z4nlQJNFIo6duutRJce1FKomv5xJynkuGaW0lIyG9K81I9sKdFbDMa4ZlJBaVyqTtLKGyHgdrvugCLceYGsmCazNcaFoKYgZVmVbd0X-4DWwtJ5e_2xrcb-S5B2FuUTH6MxUgF-0fhNjhhQAleMA_50MfPbTo3QOjn5ysqxr19Eq5CPPMcDcTBff8hfbQCevSW-MLwmXp7v4SCUrkGcw7",
];

const RATINGS = [4.9, 4.7, 4.8, 4.6, 4.9, 4.7];
const REVIEW_COUNTS = [127, 89, 204, 56, 341, 78];
const CATEGORIES = ["All", "Classic Cuts", "Luxury Grooming", "Beard Studio", "Kids Friendly"];

const FF = "'Cairo','Segoe UI',Tahoma,Arial,sans-serif";

// Inline container style — guaranteed to work regardless of Tailwind purging
const containerStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "0 32px",
  width: "100%",
  boxSizing: "border-box",
};

function SkeletonCard({ wide = false }: { wide?: boolean }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid #f0f0f0",
        boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
        gridColumn: wide ? "span 2" : undefined,
      }}
    >
      <div
        style={{
          aspectRatio: wide ? "2/1" : "4/3",
          background: "linear-gradient(90deg,#f0f0f0 25%,#fafafa 50%,#f0f0f0 75%)",
          backgroundSize: "800px 100%",
          animation: "shimmerMove 1.6s ease-in-out infinite",
        }}
      />
      <div style={{ padding: 20 }}>
        <div style={{ height: 10, width: "30%", background: "#f0f0f0", borderRadius: 6, marginBottom: 10 }} />
        <div style={{ height: 20, width: "70%", background: "#f0f0f0", borderRadius: 8, marginBottom: 8 }} />
        <div style={{ height: 14, width: "50%", background: "#f0f0f0", borderRadius: 6 }} />
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
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
      if (data) setShops(data as ShopRow[]);
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
    <div style={{ background: "#f9fafb", minHeight: "100vh", fontFamily: FF, color: "#111827" }}>

      {/* ── Global shimmer keyframes ── */}
      <style>{`
        @keyframes shimmerMove {
          0%   { background-position: -800px 0; }
          100% { background-position:  800px 0; }
        }
        @keyframes orbFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50%       { transform: translateY(-24px) scale(1.04); }
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
          background: scrolled ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: `1px solid ${scrolled ? "#ebebeb" : "transparent"}`,
          boxShadow: scrolled ? "0 1px 24px rgba(0,0,0,0.06)" : "none",
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
              color: "#111827",
              textDecoration: "none",
              letterSpacing: "-0.045em",
              fontFamily: "'Manrope', system-ui, sans-serif",
              flexShrink: 0,
            }}
          >
            Halaqy.
          </Link>

          {/* Desktop Search */}
          <div
            style={{
              flex: 1,
              maxWidth: 440,
              display: "flex",
              alignItems: "center",
              height: 40,
              gap: 10,
              paddingLeft: 14,
              paddingRight: 12,
              background: "#f3f4f6",
              borderRadius: 12,
              border: "1.5px solid #e5e7eb",
              transition: "all 150ms ease",
              cursor: "text",
            }}
            onClick={() => inputRef.current?.focus()}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17, color: "#9ca3af", flexShrink: 0 }}>search</span>
            <input
              ref={inputRef}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search shops, services or area…"
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                fontSize: 13,
                fontWeight: 500,
                color: "#111827",
                fontFamily: FF,
                minWidth: 0,
              }}
              onFocus={e => {
                const p = e.currentTarget.parentElement!;
                p.style.borderColor = "#111827";
                p.style.background = "#fff";
                p.style.boxShadow = "0 0 0 3px rgba(0,0,0,0.06)";
              }}
              onBlur={e => {
                const p = e.currentTarget.parentElement!;
                p.style.borderColor = "#e5e7eb";
                p.style.background = "#f3f4f6";
                p.style.boxShadow = "none";
              }}
            />
            {searchTerm && (
              <button
                onClick={e => { e.stopPropagation(); setSearchTerm(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "#9ca3af", padding: 0, flexShrink: 0 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            )}
          </div>

          {/* Nav actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
            {isLoggedIn ? (
              <Link
                href="/customer"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 13, fontWeight: 600, color: "#6b7280",
                  textDecoration: "none", padding: "6px 12px", borderRadius: 10,
                  transition: "background 120ms",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>event_note</span>
                My Bookings
              </Link>
            ) : (
              <Link
                href="/auth/login"
                style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", textDecoration: "none", padding: "6px 12px" }}
              >
                Sign In
              </Link>
            )}
            <Link
              href={isLoggedIn ? "/customer" : "/auth/login"}
              style={{
                display: "flex", alignItems: "center",
                fontSize: 13, fontWeight: 700,
                background: "#111827", color: "#fff",
                textDecoration: "none",
                padding: "9px 20px", borderRadius: 10,
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                transition: "all 150ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#1f2937"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#111827"; e.currentTarget.style.transform = "none"; }}
            >
              {isLoggedIn ? "Dashboard" : "Get Started"}
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
            borderBottom: "1px solid #f0f0f0",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative orbs */}
          <div style={{
            width: 600, height: 600,
            borderRadius: "50%",
            background: "rgba(213,227,252,0.4)",
            filter: "blur(80px)",
            position: "absolute",
            top: -200, right: -100,
            pointerEvents: "none",
            animation: "orbFloat 10s ease-in-out infinite",
          }} />
          <div style={{
            width: 350, height: 350,
            borderRadius: "50%",
            background: "rgba(16,185,129,0.08)",
            filter: "blur(60px)",
            position: "absolute",
            bottom: -80, left: 60,
            pointerEvents: "none",
            animation: "orbFloat 14s ease-in-out infinite reverse",
          }} />

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
                    background: "#f3f4f6", marginBottom: 28,
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1", color: "#10b981" }}>location_city</span>
                  Jordan&apos;s Premier Grooming Directory
                </div>

                {/* Headline */}
                <h1
                  style={{
                    fontSize: "clamp(40px, 5.5vw, 68px)",
                    fontWeight: 900,
                    fontFamily: "'Manrope', system-ui, sans-serif",
                    letterSpacing: "-0.04em",
                    lineHeight: 1.04,
                    color: "#111827",
                    margin: "0 0 20px",
                  }}
                >
                  Find your next<br />
                  <span style={{ color: "#9ca3af" }}>perfect cut.</span>
                </h1>

                <p
                  style={{
                    fontSize: 17,
                    color: "#6b7280",
                    lineHeight: 1.65,
                    maxWidth: 520,
                    margin: "0 0 36px",
                    fontWeight: 400,
                  }}
                >
                  Curated barbershops and master barbers across Jordan — book your appointment in under a minute.
                </p>

                {/* Trust pills */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {[
                    { icon: "storefront",       text: `${loading ? "—" : shops.length}+ Shops` },
                    { icon: "star",             text: "4.8 Avg Rating" },
                    { icon: "event_available",  text: "Free Cancellation" },
                    { icon: "payments",         text: "Pay In Shop" },
                  ].map(t => (
                    <span
                      key={t.text}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 7,
                        padding: "8px 16px",
                        background: "#fff",
                        border: "1.5px solid #e5e7eb",
                        borderRadius: 9999,
                        fontSize: 13, fontWeight: 600, color: "#374151",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: "'FILL' 1", color: "#10b981" }}>{t.icon}</span>
                      {t.text}
                    </span>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════
            FILTER BAR
        ════════════════════════════════════ */}
        <div
          style={{
            position: "sticky",
            top: 64,
            zIndex: 50,
            background: "#fff",
            borderBottom: "1px solid #f0f0f0",
            boxShadow: "0 1px 0 #f0f0f0",
          }}
        >
          <div style={{ ...containerStyle, display: "flex", alignItems: "center", gap: 8, paddingTop: 12, paddingBottom: 12, overflowX: "auto" }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 9999,
                  fontSize: 13,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  flexShrink: 0,
                  border: "1.5px solid",
                  background: activeCategory === cat ? "#111827" : "#fff",
                  color: activeCategory === cat ? "#fff" : "#6b7280",
                  borderColor: activeCategory === cat ? "#111827" : "#e5e7eb",
                  transition: "all 120ms ease",
                  fontFamily: FF,
                }}
              >
                {cat}
              </button>
            ))}
            {!loading && (
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "#d1d5db", whiteSpace: "nowrap", flexShrink: 0 }}>
                {filtered.length} found
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
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 20,
              }}
            >
              <SkeletonCard wide />
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
                  width: 72, height: 72, borderRadius: "50%", background: "#f3f4f6",
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: "#9ca3af" }}>search_off</span>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 8 }}>No results found</h3>
              <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 24, maxWidth: 320 }}>
                Try a different search term or browse all shops.
              </p>
              <button
                onClick={() => setSearchTerm("")}
                style={{
                  background: "#111827", color: "#fff",
                  padding: "10px 28px", borderRadius: 9999,
                  fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", fontFamily: FF,
                }}
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 20,
              }}
            >
              <AnimatePresence>
                {filtered.map((shop, idx) => {
                  const img     = SHOP_IMAGES[idx % SHOP_IMAGES.length];
                  const rating  = RATINGS[idx % RATINGS.length];
                  const reviews = REVIEW_COUNTS[idx % REVIEW_COUNTS.length];
                  const isFeatured = idx === 0;
                  const isOpen  = idx % 3 !== 2;

                  return (
                    <motion.div
                      key={shop.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: idx * 0.05, ease: [0.25, 1, 0.5, 1] }}
                      style={{
                        background: "#fff",
                        borderRadius: 20,
                        overflow: "hidden",
                        border: "1px solid #f0f0f0",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        transition: "transform 150ms ease, box-shadow 150ms ease",
                        cursor: "pointer",
                        gridColumn: isFeatured ? "1 / span 2" : undefined,
                      }}
                      whileHover={{ y: -4, boxShadow: "0 16px 48px rgba(0,0,0,0.10)" }}
                    >
                      {/* Cover image */}
                      <div
                        style={{
                          position: "relative",
                          overflow: "hidden",
                          aspectRatio: isFeatured ? "2.4/1" : "4/3",
                          background: "#e5e7eb",
                        }}
                      >
                        <img
                          src={img}
                          alt={shop.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 500ms ease" }}
                          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.06)"; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                        />
                        {/* Gradient overlay */}
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)" }} />

                        {/* Top-left badges */}
                        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6, alignItems: "center" }}>
                          {isFeatured && (
                            <span
                              style={{
                                background: "#f59e0b", color: "#111827",
                                padding: "3px 10px", borderRadius: 9999,
                                fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                              }}
                            >
                              ★ Featured
                            </span>
                          )}
                          {isOpen && (
                            <span
                              style={{
                                background: "rgba(16,185,129,0.92)",
                                color: "#fff", padding: "3px 10px",
                                borderRadius: 9999, fontSize: 11, fontWeight: 700,
                                display: "flex", alignItems: "center", gap: 5,
                              }}
                            >
                              <span
                                style={{
                                  width: 6, height: 6, borderRadius: "50%", background: "#fff",
                                  animation: "pulseDot 2s ease-in-out infinite",
                                  flexShrink: 0,
                                }}
                              />
                              Open Now
                            </span>
                          )}
                        </div>

                        {/* Bottom-left rating */}
                        <div
                          style={{
                            position: "absolute", bottom: 12, left: 12,
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "5px 10px", borderRadius: 9999,
                            background: "rgba(255,255,255,0.94)",
                            backdropFilter: "blur(6px)",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 13, color: "#f59e0b", fontVariationSettings: "'FILL' 1" }}>star</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: "#111827" }}>{rating}</span>
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>({reviews})</span>
                        </div>
                      </div>

                      {/* Card body */}
                      <div style={{ padding: "18px 20px 20px" }}>
                        <Link href={`/shop/${shop.id}`} style={{ textDecoration: "none" }}>
                          <h3
                            style={{
                              fontSize: isFeatured ? 20 : 16,
                              fontWeight: 900,
                              color: "#111827",
                              letterSpacing: "-0.025em",
                              fontFamily: "'Manrope', system-ui, sans-serif",
                              margin: "0 0 5px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {shop.name}
                          </h3>
                        </Link>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 13, color: "#9ca3af" }}>location_on</span>
                          <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {shop.address || "Amman, Jordan"}
                          </span>
                        </div>

                        {/* Footer */}
                        <div
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            paddingTop: 14, borderTop: "1px solid #f4f4f5",
                          }}
                        >
                          <div>
                            <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>From 8 JOD</span>
                            <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 6 }}>· 30 min</span>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <Link
                              href={`/shop/${shop.id}`}
                              style={{
                                padding: "7px 14px", borderRadius: 9999,
                                fontSize: 12, fontWeight: 700,
                                background: "#f3f4f6", color: "#374151",
                                textDecoration: "none", border: "none",
                                transition: "all 120ms ease",
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = "#e5e7eb")}
                              onMouseLeave={e => (e.currentTarget.style.background = "#f3f4f6")}
                            >
                              View
                            </Link>
                            <Link
                              href={`/book/${shop.id}`}
                              style={{
                                padding: "7px 16px", borderRadius: 9999,
                                fontSize: 12, fontWeight: 700,
                                background: "#111827", color: "#fff",
                                textDecoration: "none",
                                transition: "all 120ms ease",
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = "#1f2937"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "#111827"; e.currentTarget.style.transform = "none"; }}
                            >
                              Book Now
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
              borderRadius: 28,
              padding: "56px 48px",
              textAlign: "center",
              background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", inset: 0, opacity: 0.07, backgroundImage: "radial-gradient(circle at 70% 30%, white 0%, transparent 55%)" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <h2
                style={{
                  fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 900,
                  color: "#fff", letterSpacing: "-0.03em",
                  fontFamily: "'Manrope', system-ui, sans-serif",
                  margin: "0 0 12px",
                }}
              >
                Ready to look your best?
              </h2>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 15, margin: "0 0 32px" }}>
                {isLoggedIn ? "Book your next appointment in seconds." : "Create a free account and start booking today."}
              </p>
              <Link
                href={isLoggedIn ? "/customer" : "/auth/signup"}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "14px 36px", borderRadius: 9999,
                  background: "#fff", color: "#111827",
                  fontWeight: 700, fontSize: 15, textDecoration: "none",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                  transition: "all 150ms ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 32px rgba(0,0,0,0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.25)"; }}
              >
                {isLoggedIn ? "Go to Dashboard →" : "Get Started — Free →"}
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
          display: "flex", justifyContent: "space-around", alignItems: "center",
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid #f0f0f0",
          padding: "12px 16px max(16px, env(safe-area-inset-bottom))",
        }}
        className="md:hidden"
      >
        <Link href="/explore" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, textDecoration: "none" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#111827", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#fff" }}>search</span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#111827" }}>Explore</span>
        </Link>
        <Link href="/customer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, textDecoration: "none" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#9ca3af" }}>event_note</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af" }}>Bookings</span>
        </Link>
        <Link href={isLoggedIn ? "/customer" : "/auth/login"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, textDecoration: "none" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: "#9ca3af" }}>person</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af" }}>Account</span>
        </Link>
      </nav>

      {/* responsive grid breakpoints */}
      <style>{`
        @media (max-width: 900px) {
          .explore-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .explore-grid > :first-child { grid-column: 1 / -1 !important; }
        }
        @media (max-width: 560px) {
          .explore-grid { grid-template-columns: 1fr !important; }
          .explore-grid > :first-child { grid-column: 1 !important; }
        }
      `}</style>
    </div>
  );
}
