"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  UserPlus, Search, MoreVertical, 
  Mail, Phone, ShieldCheck, Clock
} from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useThemeStore } from "@/store/theme-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { createClient } from "@/lib/supabase/client";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";

interface TeamMember {
  id: string;
  full_name: string;
  role: string | null;
  email?: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
}

const avatarColors = [
  { bg: "#dde2f6", text: "#151b29" },
  { bg: "#d5e3fc", text: "#0d1c2e" },
  { bg: "#ffdea5", text: "#261900" },
  { bg: "#e0e3e5", text: "#191c1e" },
  { bg: "#151b29", text: "#ffffff" },
];

export default function TeamPage() {
  const t = useTranslation();
  const { direction } = useThemeStore();
  const { shopId } = useWorkspaceStore();
  const isRTL = direction === "rtl";
  const [searchTerm, setSearchTerm] = useState("");

  const supabase = createClient();

  const fetchTeam = useCallback(async () => {
    if (!shopId) return { data: null, error: null };
    const res = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: true });
    return res;
  }, [shopId, supabase]);

  const { data, loading } = useSupabaseQuery(
    fetchTeam,
    [shopId],
    { enabled: !!shopId },
  );

  const teamMembers = (data as unknown as TeamMember[]) ?? [];

  const filtered = teamMembers.filter((member) => 
    member.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInvite = () => {
    toast("success", isRTL ? "تم إرسال دعوة جديدة للفريق!" : "New team invite sent!");
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 1, 0.4, 1] }}
      style={{ display: "flex", flexDirection: "column", gap: 32 }}
    >
      {/* ── Page Header ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 style={{ fontFamily: "Manrope, sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", margin: 0 }}>
              {isRTL ? "فريق العمل" : "Team & Staff"}
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6, fontWeight: 400 }}>
              {isRTL ? "إدارة جداول الحلاقين والموظفين." : "Manage your barbers, schedules, and permissions."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, width: "100%" }} className="sm:w-auto">
            {/* Search */}
            <div style={{ position: "relative", flex: 1 }}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
              <input
                type="text"
                placeholder={isRTL ? "ابحث عن موظف..." : "Search staff..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 h-10 pl-10 pr-4 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20 transition-all"
              />
            </div>
            <button className="btn btn-primary" onClick={handleInvite} style={{ minHeight: "40px", padding: "0 20px" }}>
              <UserPlus size={16} />
              <span className="hidden sm:inline">{isRTL ? "دعوة عضو" : "Invite Staff"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Team Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((member, i) => {
          const color = avatarColors[i % avatarColors.length];
          const initials = member.full_name
            ? member.full_name.substring(0, 2).toUpperCase()
            : "?";
          
          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-lg)] p-6 shadow-sm hover:shadow-md transition-shadow relative group"
            >
              <button className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors opacity-0 group-hover:opacity-100">
                <MoreVertical size={18} />
              </button>
              
              <div className="flex flex-col items-center text-center">
                {/* Avatar */}
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold mb-4 shadow-sm"
                  style={{ background: color.bg, color: color.text }}
                >
                  {initials}
                </div>
                
                {/* Info */}
                <h3 className="text-lg font-bold text-[var(--text-primary)] tracking-tight mb-1">
                  {member.full_name || "Unnamed"}
                </h3>
                <div className="flex items-center gap-1 text-[13px] font-medium px-3 py-1 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-full mb-6">
                  <ShieldCheck size={14} />
                  {member.role === 'owner' ? (isRTL ? "مالك" : "Owner") : (member.role === 'professional' ? (isRTL ? "حلاق" : "Barber") : (member.role || "Staff"))}
                </div>
                
                {/* Quick Stats / Contacts */}
                <div className="w-full flex justify-between items-center pt-4 border-t border-[var(--border-primary)]">
                  <div className="flex items-center gap-4 text-[var(--text-muted)]">
                    <button className="hover:text-[var(--text-primary)] transition-colors"><Mail size={16} /></button>
                    <button className="hover:text-[var(--text-primary)] transition-colors"><Phone size={16} /></button>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-tertiary)]">
                    <Clock size={14} />
                    {isRTL ? "متاح" : "Active"}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full py-20 text-center text-[var(--text-muted)]">
            <UserPlus size={48} className="mx-auto mb-4 opacity-20" />
            <p>{isRTL ? "لا يوجد أعضاء هنا بعد." : "No team members found."}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
