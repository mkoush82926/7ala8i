"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Phone,
  Mail,
  Star,
  Calendar,
  DollarSign,
  User,
  X,
  MessageCircle,
  Scissors,
} from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useThemeStore } from "@/store/theme-store";

// ─── Mock client data ───
const mockClients = [
  {
    id: 1,
    name: "Tariq Mansour",
    phone: "+962791234567",
    email: "tariq@email.com",
    visits: 24,
    totalSpend: 312,
    rating: 5,
    lastVisit: "2 days ago",
    preferredBarber: "Ahmad",
    avatar: "TM",
  },
  {
    id: 2,
    name: "Sami Khalil",
    phone: "+962791234568",
    email: "sami@email.com",
    visits: 18,
    totalSpend: 245,
    rating: 4,
    lastVisit: "5 days ago",
    preferredBarber: "Khalid",
    avatar: "SK",
  },
  {
    id: 3,
    name: "Rami Abu-Said",
    phone: "+962791234569",
    email: "rami@email.com",
    visits: 31,
    totalSpend: 420,
    rating: 5,
    lastVisit: "1 day ago",
    preferredBarber: "Omar",
    avatar: "RA",
  },
  {
    id: 4,
    name: "Nabil Darwish",
    phone: "+962791234570",
    email: "nabil@email.com",
    visits: 12,
    totalSpend: 168,
    rating: 4,
    lastVisit: "1 week ago",
    preferredBarber: "Faris",
    avatar: "ND",
  },
  {
    id: 5,
    name: "Walid Khoury",
    phone: "+962791234571",
    email: "walid@email.com",
    visits: 8,
    totalSpend: 96,
    rating: 5,
    lastVisit: "3 days ago",
    preferredBarber: "Ahmad",
    avatar: "WK",
  },
  {
    id: 6,
    name: "Bassem Hani",
    phone: "+962791234572",
    email: "bassem@email.com",
    visits: 15,
    totalSpend: 198,
    rating: 4,
    lastVisit: "4 days ago",
    preferredBarber: "Yousef",
    avatar: "BH",
  },
  {
    id: 7,
    name: "Mazen Sabbagh",
    phone: "+962791234573",
    email: "mazen@email.com",
    visits: 42,
    totalSpend: 580,
    rating: 5,
    lastVisit: "Today",
    preferredBarber: "Omar",
    avatar: "MS",
  },
  {
    id: 8,
    name: "Fadi Nassar",
    phone: "+962791234574",
    email: "fadi@email.com",
    visits: 6,
    totalSpend: 78,
    rating: 3,
    lastVisit: "2 weeks ago",
    preferredBarber: "Khalid",
    avatar: "FN",
  },
];

const accentColors = [
  "var(--accent-mint)",
  "var(--accent-lavender)",
  "var(--accent-blue)",
  "var(--accent-amber)",
  "var(--accent-rose)",
];

export default function ClientsPage() {
  const t = useTranslation();
  const { direction } = useThemeStore();
  const isRTL = direction === "rtl";
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<
    (typeof mockClients)[0] | null
  >(null);

  const filtered = mockClients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 1, 0.4, 1] }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] tracking-tight text-[var(--text-primary)] font-light">
            {t.sidebar.clients}
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] font-light mt-1">
            {filtered.length} {isRTL ? "عميل نشط" : "active clients"}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search
            size={14}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <input
            type="text"
            placeholder={t.common.search}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 ps-9 pe-4 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-transparent focus:outline-none focus:border-[var(--border-primary)] focus:bg-[var(--bg-primary)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all"
          />
        </div>
      </div>

      {/* Client Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((client, i) => {
          const color = accentColors[i % accentColors.length];
          return (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedClient(client)}
              className="glass-card-premium p-4 cursor-pointer group"
            >
              <div className="flex items-center gap-3 mb-3 relative z-10">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-[12px] font-medium"
                  style={{
                    background: `color-mix(in srgb, ${color} 15%, transparent)`,
                    color: color,
                  }}
                >
                  {client.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[var(--text-primary)] font-light truncate">
                    {client.name}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] font-light">
                    {client.lastVisit}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, si) => (
                    <Star
                      key={si}
                      size={10}
                      className={
                        si < client.rating
                          ? "text-[var(--accent-amber)]"
                          : "text-[var(--text-muted)]"
                      }
                      fill={si < client.rating ? "var(--accent-amber)" : "none"}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 relative z-10">
                <div className="text-center p-2 rounded-lg bg-[var(--bg-surface)]">
                  <p className="text-[10px] text-[var(--text-muted)] font-light">
                    {isRTL ? "زيارات" : "Visits"}
                  </p>
                  <p className="text-[14px] text-[var(--text-primary)] font-light">
                    {client.visits}
                  </p>
                </div>
                <div className="text-center p-2 rounded-lg bg-[var(--bg-surface)]">
                  <p className="text-[10px] text-[var(--text-muted)] font-light">
                    {isRTL ? "إنفاق" : "Spent"}
                  </p>
                  <p className="text-[14px] text-[var(--text-primary)] font-light">
                    {client.totalSpend}
                  </p>
                </div>
                <div className="text-center p-2 rounded-lg bg-[var(--bg-surface)]">
                  <p className="text-[10px] text-[var(--text-muted)] font-light">
                    {isRTL ? "الحلاق" : "Barber"}
                  </p>
                  <p className="text-[12px] text-[var(--text-primary)] font-light truncate">
                    {client.preferredBarber}
                  </p>
                </div>
              </div>

              {/* Hover actions */}
              <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                <button className="flex-1 h-7 rounded-lg bg-[var(--accent-mint-muted)] text-[var(--accent-mint)] text-[11px] flex items-center justify-center gap-1 hover:opacity-80 transition-opacity cursor-pointer">
                  <MessageCircle size={11} />
                  WhatsApp
                </button>
                <button className="flex-1 h-7 rounded-lg bg-[var(--bg-surface)] text-[var(--text-tertiary)] text-[11px] flex items-center justify-center gap-1 hover:text-[var(--text-secondary)] transition-colors cursor-pointer">
                  <Phone size={11} />
                  {isRTL ? "اتصال" : "Call"}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Client Detail Drawer */}
      <AnimatePresence>
        {selectedClient && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
              onClick={() => setSelectedClient(null)}
            />
            <motion.div
              initial={{ x: isRTL ? -400 : 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: isRTL ? -400 : 400, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`fixed top-0 ${isRTL ? "start-0" : "end-0"} w-full sm:w-[380px] h-full bg-[var(--bg-secondary)] border-s border-[var(--border-primary)] z-[60] overflow-y-auto`}
            >
              <div className="p-6">
                {/* Close */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[15px] text-[var(--text-primary)] font-light">
                    {isRTL ? "ملف العميل" : "Client Profile"}
                  </h3>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Avatar */}
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent-mint)] to-[var(--accent-lavender)] flex items-center justify-center text-[20px] font-light text-[#0A0A0A] mx-auto mb-3">
                    {selectedClient.avatar}
                  </div>
                  <h4 className="text-[16px] text-[var(--text-primary)] font-light">
                    {selectedClient.name}
                  </h4>
                  <div className="flex items-center justify-center gap-0.5 mt-1">
                    {[...Array(5)].map((_, si) => (
                      <Star
                        key={si}
                        size={12}
                        className={
                          si < selectedClient.rating
                            ? "text-[var(--accent-amber)]"
                            : "text-[var(--text-muted)]"
                        }
                        fill={
                          si < selectedClient.rating
                            ? "var(--accent-amber)"
                            : "none"
                        }
                      />
                    ))}
                  </div>
                </div>

                {/* Info fields */}
                <div className="space-y-4">
                  {[
                    {
                      icon: Phone,
                      label: t.leads.phone,
                      value: selectedClient.phone,
                    },
                    {
                      icon: Mail,
                      label: t.leads.email,
                      value: selectedClient.email,
                    },
                    {
                      icon: Scissors,
                      label: isRTL ? "الحلاق المفضل" : "Preferred Barber",
                      value: selectedClient.preferredBarber,
                    },
                    {
                      icon: Calendar,
                      label: isRTL ? "آخر زيارة" : "Last Visit",
                      value: selectedClient.lastVisit,
                    },
                    {
                      icon: User,
                      label: isRTL ? "إجمالي الزيارات" : "Total Visits",
                      value: selectedClient.visits.toString(),
                    },
                    {
                      icon: DollarSign,
                      label: isRTL ? "إجمالي الإنفاق" : "Total Spend",
                      value: `${selectedClient.totalSpend} JOD`,
                    },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-light flex items-center gap-1.5 mb-1">
                        <field.icon size={12} />
                        {field.label}
                      </label>
                      <div className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-primary)] flex items-center">
                        <span className="text-[13px] text-[var(--text-primary)] font-light">
                          {field.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-6">
                  <button className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[var(--accent-mint)] to-[var(--accent-lavender)] text-[#0A0A0A] text-[13px] font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity cursor-pointer">
                    <MessageCircle size={14} />
                    WhatsApp
                  </button>
                  <button className="flex-1 h-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[var(--text-secondary)] text-[13px] font-light flex items-center justify-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all cursor-pointer">
                    <Calendar size={14} />
                    {isRTL ? "حجز جديد" : "New Booking"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
