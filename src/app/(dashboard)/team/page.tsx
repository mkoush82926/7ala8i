"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  UserPlus, Search, MoreVertical, 
  Mail, Phone, ShieldCheck, Clock,
  X, Check
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
  barber_services?: { service_id: string }[];
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

  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
        setCurrentUserRole(profile?.role || null);
      }
    });
  }, [supabase]);

  const fetchTeam = useCallback(async () => {
    if (!shopId) return { data: null, error: null };
    const res = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at, barber_services(service_id)")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: true });
    return res;
  }, [shopId, supabase]);

  const fetchServices = useCallback(async () => {
    if (!shopId) return { data: null, error: null };
    return await supabase.from("services").select("id, name, name_ar").eq("shop_id", shopId).eq("is_active", true);
  }, [shopId, supabase]);

  const { data, loading, refetch: refetchTeam } = useSupabaseQuery(
    fetchTeam,
    [shopId],
    { enabled: !!shopId },
  );

  const { data: servicesData } = useSupabaseQuery(
    fetchServices,
    [shopId],
    { enabled: !!shopId },
  );

  const teamMembers = (data as unknown as TeamMember[]) ?? [];
  const shopServices = (servicesData as unknown as {id: string, name: string, name_ar: string | null}[]) ?? [];

  const [editingBarber, setEditingBarber] = useState<TeamMember | null>(null);

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
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
              <input
                type="text"
                placeholder={isRTL ? "ابحث عن موظف..." : "Search staff..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 h-10 ps-10 pe-4 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20 transition-all"
              />
            </div>
            {currentUserRole === 'shop_admin' && (
              <button className="btn btn-primary" onClick={handleInvite} style={{ minHeight: "40px", padding: "0 20px" }}>
                <UserPlus size={16} />
                <span className="hidden sm:inline">{isRTL ? "دعوة عضو" : "Invite Staff"}</span>
              </button>
            )}
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
              {currentUserRole === 'shop_admin' && (
                <button 
                  onClick={() => setEditingBarber(member)}
                  className="absolute top-4 end-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors opacity-0 group-hover:opacity-100"
                >
                  <MoreVertical size={18} />
                </button>
              )}
              
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

      {/* Editing Modal */}
      {editingBarber && (
        <BarberSettingsModal 
          editingBarber={editingBarber} 
          shopServices={shopServices} 
          setEditingBarber={setEditingBarber} 
          refetchTeam={refetchTeam} 
          isRTL={isRTL} 
        />
      )}
    </motion.div>
  );
}

function BarberSettingsModal({ editingBarber, shopServices, setEditingBarber, refetchTeam, isRTL }: any) {
  const [activeTab, setActiveTab] = useState<"services" | "hours">("services");
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="w-full max-w-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-xl)] shadow-xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            {editingBarber.full_name} {isRTL ? "- الإعدادات" : "- Settings"}
          </h3>
          <button 
            onClick={() => setEditingBarber(null)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex items-center px-4 border-b border-[var(--border-primary)]">
          <button 
            onClick={() => setActiveTab("services")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "services" ? "border-[var(--text-primary)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
          >
            {isRTL ? "الخدمات (القدرات)" : "Services"}
          </button>
          <button 
            onClick={() => setActiveTab("hours")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "hours" ? "border-[var(--text-primary)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
          >
            {isRTL ? "أوقات العمل" : "Working Hours"}
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {activeTab === "services" ? (
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                {isRTL 
                  ? "قم بتحديد الخدمات التي يمكن لهذا الحلاق تقديمها في المتجر:"
                  : "Select the services this staff member is capable of performing:"}
              </p>
              
              {shopServices.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] py-4 text-center">
                  {isRTL ? "لا توجد خدمات متاحة." : "No active services found."}
                </p>
              ) : (
                <BarberServicesChecklist 
                  barber={editingBarber} 
                  services={shopServices} 
                  onClose={() => setEditingBarber(null)}
                  onSaveSuccess={() => {
                    refetchTeam();
                    setEditingBarber(null);
                  }}
                  isRTL={isRTL}
                />
              )}
            </div>
          ) : (
            <BarberWorkingHoursManager barber={editingBarber} onClose={() => setEditingBarber(null)} isRTL={isRTL} />
          )}
        </div>
      </motion.div>
    </div>
  );
}

function BarberWorkingHoursManager({ barber, onClose, isRTL }: { barber: TeamMember, onClose: () => void, isRTL: boolean }) {
  const [schedule, setSchedule] = useState<{ day_of_week: number; start_time: string; end_time: string; is_working: boolean; id?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const daysLabels = isRTL 
    ? ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  React.useEffect(() => {
    supabase.from("working_hours").select("*").eq("barber_id", barber.id).order("day_of_week", { ascending: true })
      .then(({ data }) => {
        const fullSchedule = Array.from({ length: 7 }).map((_, i) => {
          const existing = data?.find(d => d.day_of_week === i);
          return existing || { day_of_week: i, start_time: "09:00:00", end_time: "18:00:00", is_working: true };
        });
        setSchedule(fullSchedule);
        setLoading(false);
      });
  }, [barber.id, supabase]);

  const updateDay = (dayIndex: number, field: string, value: any) => {
    setSchedule(prev => prev.map(d => d.day_of_week === dayIndex ? { ...d, [field]: value } : d));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const inserts = schedule.map(d => ({
        barber_id: barber.id,
        day_of_week: d.day_of_week,
        start_time: d.start_time,
        end_time: d.end_time,
        is_working: d.is_working
      }));
      const { error } = await supabase.from("working_hours").upsert(inserts, { onConflict: "barber_id, day_of_week" });
      if (error) throw error;
      toast("success", isRTL ? "تم حفظ أوقات العمل" : "Working hours saved successfully");
      onClose();
    } catch (e: any) {
      toast("error", e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-8 text-center flex justify-center"><DashboardSkeleton /></div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {schedule.map((day, i) => (
          <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${day.is_working ? "border-[var(--border-primary)] bg-[var(--bg-secondary)]" : "border-[var(--border-primary)] bg-[var(--bg-primary)] opacity-60"}`}>
            <div className="flex items-center gap-2 w-32">
              <input 
                type="checkbox" 
                checked={day.is_working} 
                onChange={(e) => updateDay(i, "is_working", e.target.checked)}
                className="w-4 h-4 rounded appearance-none border border-[var(--border-primary)] checked:bg-[var(--accent-mint)] checked:border-[var(--accent-mint)] outline-none cursor-pointer transition-colors relative"
              />
              <span className={`text-sm font-medium ${!day.is_working ? "line-through text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}>
                {daysLabels[i]}
              </span>
            </div>
            
            <div className={`flex items-center gap-2 flex-1 ${!day.is_working ? "pointer-events-none" : ""}`}>
              <input 
                type="time" 
                value={day.start_time.substring(0, 5)} 
                onChange={(e) => updateDay(i, "start_time", e.target.value + ":00")}
                className="h-8 px-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm w-full md:w-28 text-center outline-none focus:border-[var(--text-primary)]"
              />
              <span className="text-[var(--text-muted)]">-</span>
              <input 
                type="time" 
                value={day.end_time.substring(0, 5)} 
                onChange={(e) => updateDay(i, "end_time", e.target.value + ":00")}
                className="h-8 px-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm w-full md:w-28 text-center outline-none focus:border-[var(--text-primary)]"
              />
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-[var(--border-primary)]">
        <button onClick={onClose} className="btn text-sm px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          {isRTL ? "إلغاء" : "Cancel"}
        </button>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary text-sm px-6 py-2">
          {saving ? <span className="animate-pulse">{isRTL ? "جاري الحفظ..." : "Saving..."}</span> : (isRTL ? "حفظ الأوقات" : "Save Hours")}
        </button>
      </div>
    </div>
  );
}

function BarberServicesChecklist({ barber, services, onClose, onSaveSuccess, isRTL }: { barber: TeamMember, services: {id: string, name: string, name_ar: string | null}[], onClose: () => void, onSaveSuccess: () => void, isRTL: boolean }) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    barber.barber_services?.map(bs => bs.service_id) || []
  );
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const toggleService = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete old mappings
      await supabase.from("barber_services").delete().eq("barber_id", barber.id);
      
      // Insert new mappings
      if (selectedIds.length > 0) {
        const inserts = selectedIds.map(sid => ({ barber_id: barber.id, service_id: sid }));
        const { error } = await supabase.from("barber_services").insert(inserts);
        if (error) throw error;
      }
      
      toast("success", isRTL ? "تم تحديث قدرات الحلاق بنجاح" : "Capabilities updated successfully");
      onSaveSuccess();
    } catch (e: any) {
      toast("error", e.message || "Failed to update capabilities");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2">
        {services.map(s => {
          const isSelected = selectedIds.includes(s.id);
          return (
            <div 
              key={s.id} 
              onClick={() => toggleService(s.id)}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                isSelected 
                  ? "border-[var(--accent-mint)] bg-[var(--accent-mint-muted)]" 
                  : "border-[var(--border-primary)] hover:border-[var(--border-hover)]"
              }`}
            >
              <div className={`w-5 h-5 rounded-sm flex items-center justify-center border ${
                isSelected ? "border-[var(--accent-mint)] bg-[var(--accent-mint)]" : "border-[var(--border-primary)]"
              }`}>
                {isSelected && <Check size={14} className="text-[#0A0A0A]" />}
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {isRTL && s.name_ar ? s.name_ar : s.name}
              </span>
            </div>
          );
        })}
      </div>
      
      <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-[var(--border-primary)]">
        <button 
          onClick={onClose}
          className="btn text-sm px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          {isRTL ? "إلغاء" : "Cancel"}
        </button>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary text-sm px-6 py-2"
        >
          {saving ? (isRTL ? "تحديث..." : "Saving...") : (isRTL ? "حفظ القدرات" : "Save Capabilities")}
        </button>
      </div>
    </div>
  );
}
