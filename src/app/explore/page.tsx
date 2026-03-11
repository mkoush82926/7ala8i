"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Scissors, MapPin, Search, ArrowRight, ArrowLeft, Star } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useThemeStore } from "@/store/theme-store";
import { createClient } from "@/lib/supabase/client";

interface ShopRow {
  id: string;
  name: string;
  address: string;
  google_maps_url: string | null;
}

export default function ExplorePage() {
  const t = useTranslation();
  const isRTL = useThemeStore((s) => s.direction) === "rtl";
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchShops() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("shops")
        .select("id, name, address, google_maps_url")
        .order("name");

      if (data && !error) {
        setShops(data as ShopRow[]);
      }
      setLoading(false);
    }
    fetchShops();
  }, []);

  const filteredShops = shops.filter((shop) =>
    shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (shop.address && shop.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Navbar (Internal Variant) */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-[var(--bg-primary)]/80 border-b border-[var(--border-primary)]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-mint)] to-[var(--accent-lavender)] flex items-center justify-center">
              <Scissors size={16} className="text-[#0A0A0A]" />
            </div>
            <span className="text-[16px] font-medium tracking-tight">Lumina</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="h-12 px-6 rounded-full border border-[var(--border-primary)] text-[14px] font-medium flex items-center justify-center hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              {isRTL ? "العودة للرئيسية" : "Back to Home"}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero / Header */}
      <section className="pt-32 pb-12 px-6 gradient-mesh relative">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <h1 className="text-[clamp(2.5rem,4vw,3.5rem)] font-light tracking-tight mb-4 gradient-text">
              {isRTL ? "اكتشف الصالونات القريبة" : "Discover Shops Near You"}
            </h1>
            <p className="text-[16px] text-[var(--text-secondary)] font-light leading-relaxed">
              {isRTL 
                ? "تصفح أفضل صالونات الحلاقة في منطقتك، واطّلع على الخدمات، واحجز موعدك بسهولة." 
                : "Browse the best barbershops in your area, view services, and book your appointment effortlessly."}
            </p>
          </motion.div>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-xl mx-auto"
          >
            <div className="relative group">
              <div className="absolute inset-y-0 start-0 ps-5 flex items-center pointer-events-none text-[var(--text-tertiary)] group-focus-within:text-[var(--text-primary)] transition-colors">
                <Search size={20} />
              </div>
              <input
                type="text"
                placeholder={isRTL ? "ابحث عن صالون، عنوان..." : "Search for a shop, address..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-14 ps-14 pe-5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[15px] outline-none focus:border-[var(--accent-mint)] focus:ring-1 focus:ring-[var(--accent-mint)] transition-all shadow-sm"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Shop Grid */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--accent-mint)] border-t-transparent animate-spin" />
            </div>
          ) : filteredShops.length === 0 ? (
            <div className="text-center py-20 text-[var(--text-secondary)] font-light">
              {isRTL ? "لم يتم العثور على صالونات مطابقة." : "No matching shops found."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShops.map((shop, i) => (
                <motion.div
                  key={shop.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className="glass-card-premium p-8 h-full flex flex-col justify-between group"
                >
                  <div className="mb-8">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--bg-surface-hover)] to-[var(--bg-surface)] flex items-center justify-center border border-[var(--border-primary)] shadow-sm">
                        <Scissors size={20} className="text-[var(--text-primary)]" />
                      </div>
                      <div className="flex gap-1 text-[var(--accent-amber)]">
                        <Star size={14} fill="currentColor" />
                        <span className="text-[12px] font-medium text-[var(--text-primary)]">4.9</span>
                      </div>
                    </div>
                    <h3 className="text-[18px] font-medium text-[var(--text-primary)] mb-2 group-hover:text-[var(--accent-mint)] transition-colors">
                      {shop.name}
                    </h3>
                    {shop.address && (
                      <div className="flex items-start gap-2 text-[var(--text-tertiary)]">
                        <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                        <p className="text-[13px] font-light leading-relaxed">{shop.address}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-6 border-t border-[var(--border-primary)] flex items-center justify-between">
                    {shop.google_maps_url ? (
                      <a
                        href={shop.google_maps_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        {isRTL ? "عرض الخريطة" : "View Map"}
                      </a>
                    ) : (
                      <span />
                    )}
                    
                    <Link
                      href={`/book/${shop.id}`}
                      className="flex items-center gap-2 h-10 px-5 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-[13px] font-medium hover:opacity-90 transition-opacity"
                    >
                      {t.booking.bookAppointment}
                      {isRTL ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
