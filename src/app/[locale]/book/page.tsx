"use client";

import { BookingEngine } from "@/components/booking/booking-engine";
import Link from "next/link";
import { useTranslation } from "@/hooks/use-translation";

export default function BookingPage() {
  const { t, dir, isRTL } = useTranslation();

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface" dir={dir}>
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-surface-container">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/explore" className="flex items-center gap-2 text-on-surface hover:opacity-70 transition-opacity">
            <span className="material-symbols-outlined">{isRTL ? "arrow_forward" : "arrow_back"}</span>
            <span className="font-headline font-bold text-sm tracking-tight">{t.common.back}</span>
          </Link>
          <div className="flex flex-col items-center">
            <span className="font-headline font-extrabold text-xl tracking-tighter">Halaqy</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              {isRTL ? "منصة الحجز" : "Booking Atelier"}
            </span>
          </div>
          <div className="w-16"></div>
        </div>
      </header>
      <main className="pt-24 pb-16 min-h-screen flex items-center justify-center">
        <div className="max-w-5xl mx-auto px-6 w-full">
          <BookingEngine />
        </div>
      </main>
    </div>
  );
}
