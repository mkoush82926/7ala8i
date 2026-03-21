"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useWorkspaceStore } from "@/store/workspace-store";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/hooks/use-translation";
import { useThemeStore } from "@/store/theme-store";

type SettingsTab = "general" | "team" | "booking" | "billing";

// ── Explicit colors — bypassing Tailwind token resolution ──
const C = {
  dark: "#191c1e",
  mid: "#45464c",
  muted: "#76777d",
  outline: "#c6c6cc",
  surfaceLow: "#f2f4f6",
  surface: "#eceef0",
  white: "#ffffff",
  black: "#000000",
  amber: "#ffdea5",
};

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const { shopName, barbers } = useWorkspaceStore();
  const [copied, setCopied] = useState(false);
  const bookingLink = `halaqy.booking/${shopName.toLowerCase().replace(/\s+/g, "-")}`;
  const t = useTranslation();
  const { direction } = useThemeStore();
  const isRTL = direction === "rtl";

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "general", label: t.settings.general },
    { id: "team", label: t.settings.team },
    { id: "booking", label: t.settings.bookingLink },
    { id: "billing", label: t.settings.billing },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://${bookingLink}`);
    setCopied(true);
    toast("success", "Booking link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: C.surfaceLow,
    border: `1px solid ${C.outline}40`,
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 14,
    color: C.dark,
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: "Manrope, Inter, system-ui, sans-serif",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: C.mid,
    display: "block",
    marginBottom: 6,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 1, 0.4, 1] }}
      style={{ display: "flex", flexDirection: "column", gap: 32 }}
    >
      {/* ── Page Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontFamily: "Manrope, sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: C.dark, margin: 0 }}>
            {t.settings.title}
          </h2>
          <p style={{ fontSize: 14, color: C.mid, marginTop: 4 }}>
            {isRTL ? "إدارة إعدادات المشغل والتفضيلات" : "Manage your atelier settings and preferences"}
          </p>
        </div>
        {activeTab === "general" && (
          <button className="btn btn-primary">
            {isRTL ? "حفظ التغييرات" : "Save Changes"}
          </button>
        )}
      </div>

      {/* ── Tab Navigation ── */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.surface}` }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn btn-ghost`}
            style={{
              borderRadius: 0,
              padding: "10px 24px",
              color: activeTab === tab.id ? C.black : C.mid,
              borderBottom: activeTab === tab.id ? `2px solid ${C.black}` : "2px solid transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── GENERAL TAB ── */}
      {activeTab === "general" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div>
            <h2 style={{ fontFamily: "Manrope, sans-serif", fontSize: 20, fontWeight: 800, color: C.dark, margin: 0 }}>
              {isRTL ? "معلومات المتجر" : "Shop Information"}
            </h2>
            <p style={{ fontSize: 14, color: C.mid, marginTop: 4 }}>
              {isRTL ? "تحديث ملفك الشخصي العام والتفضيلات العامة." : "Update your public profile and global preferences."}
            </p>
          </div>
          <div style={{ background: C.white, padding: 32, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px 48px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Shop Name</label>
                <input style={inputStyle} defaultValue={shopName} type="text" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Description</label>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
                  rows={3}
                  defaultValue={isRTL ? "حلاقة فاخرة وتصفيف حديث في قلب المدينة." : "Luxury barbering and modern grooming located in the heart of the city."}
                />
              </div>
              <div>
                <label style={labelStyle}>Contact Email</label>
                <input style={inputStyle} type="email" defaultValue="hello@halaqy.com" />
              </div>
              <div>
                <label style={labelStyle}>WhatsApp Number</label>
                <input style={inputStyle} type="tel" defaultValue="+962 7 9000 0000" />
              </div>
              <div>
                <label style={labelStyle}>Currency</label>
                <select style={inputStyle}>
                  <option>JOD (Jordanian Dinar)</option>
                  <option>USD ($)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Timezone</label>
                <select style={inputStyle}>
                  <option>(GMT+03:00) Amman</option>
                  <option>(GMT+00:00) London</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TEAM TAB ── */}
      {activeTab === "team" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <h2 style={{ fontFamily: "Manrope, sans-serif", fontSize: 20, fontWeight: 800, color: C.dark, margin: 0 }}>
              {isRTL ? "إدارة الفريق" : "Team Management"}
            </h2>
            <p style={{ fontSize: 14, color: C.mid, marginTop: 4 }}>
              {isRTL ? "تنظيم الحلاقين والموظفين الإداريين." : "Organize your barbers and administrative staff."}
            </p>
          </div>
          <div style={{ background: C.white, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.surface}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            {(barbers.length > 0 ? barbers : [
              { id: "1", name: "Omar Al-Fayez" },
              { id: "2", name: "Sara Jenkins" },
            ]).map((member, i) => (
              <div key={member.id || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: i < 1 ? `1px solid ${C.surface}` : undefined }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.surfaceLow, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: C.mid }}>
                    {(member.name || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: C.dark, margin: 0 }}>{member.name || "Team Member"}</p>
                    <p style={{ fontSize: 12, color: C.mid, margin: 0 }}>Barber · Active</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ padding: "4px 10px", background: `${C.surface}`, color: C.dark, fontSize: 10, fontWeight: 700, textTransform: "uppercase", borderRadius: 99, letterSpacing: "0.05em" }}>
                    {i === 0 ? "Admin" : "Staff"}
                  </span>
                </div>
              </div>
            ))}
            {/* Invite form */}
            <div style={{ background: C.surfaceLow, padding: 24, borderTop: `1px solid ${C.surface}` }}>
              <div style={{ display: "flex", gap: 12 }}>
                <input
                  style={{ ...inputStyle, flex: 1, background: C.white }}
                  placeholder="New staff email address"
                  type="email"
                />
                <button className="btn btn-primary">
                  {isRTL ? "دعوة عضو" : "Invite Member"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BOOKING LINK TAB ── */}
      {activeTab === "booking" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <h2 style={{ fontFamily: "Manrope, sans-serif", fontSize: 20, fontWeight: 800, color: C.dark, margin: 0 }}>
              {isRTL ? "بوابة الحجز" : "Booking Portal"}
            </h2>
            <p style={{ fontSize: 14, color: C.mid, marginTop: 4 }}>
              {isRTL ? "واجهتك العامة لحجوزات العملاء." : "Your public facing interface for client bookings."}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
            {/* Live Link Card */}
            <div style={{ background: C.black, color: C.white, padding: 40, borderRadius: 16, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 280, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "relative", zIndex: 1 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 99, background: "rgba(255,255,255,0.1)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 24 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }} />
                  {isRTL ? "صفحة حجز مباشرة" : "Live Booking Page"}
                </span>
                <h3 style={{ fontFamily: "Manrope, sans-serif", fontSize: 28, fontWeight: 900, letterSpacing: "-0.03em", color: C.white, margin: 0 }}>
                  {bookingLink}
                </h3>
              </div>
              <div style={{ display: "flex", gap: 12, position: "relative", zIndex: 1 }}>
                <button
                  onClick={handleCopy}
                  className="btn btn-secondary"
                  style={{ border: "none" }}
                >
                  {copied ? "✓ Copied!" : (isRTL ? "نسخ الرابط" : "Copy Public URL")}
                </button>
                <a
                  href={`https://${bookingLink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                  style={{ color: "rgba(255,255,255,0.8)" }}
                >
                  {isRTL ? "عرض الصفحة" : "View Page"} ↗
                </a>
              </div>
            </div>
            {/* QR Card */}
            <div style={{ background: C.white, border: `1px solid ${C.surface}`, padding: 32, borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <div style={{ marginBottom: 24, padding: 16, background: C.surfaceLow, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 128, height: 128, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: `2px dashed ${C.surface}`, borderRadius: 8 }}>
                  <span style={{ fontSize: 48, color: C.outline }}>▦</span>
                  <span style={{ fontSize: 10, color: C.mid, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>STUDIO QR</span>
                </div>
              </div>
              <p style={{ fontWeight: 700, fontSize: 14, color: C.dark, margin: "0 0 4px" }}>{isRTL ? "رمز QR للحجز" : "Booking QR Code"}</p>
              <p style={{ fontSize: 11, color: C.mid, margin: "0 0 16px" }}>{isRTL ? "ضعه على مكتب الاستقبال" : "Place this at your reception desk"}</p>
              <button className="btn btn-secondary" style={{ width: "100%" }}>
                {isRTL ? "تنزيل بدقة عالية" : "Download High-Res"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BILLING TAB ── */}
      {activeTab === "billing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <h2 style={{ fontFamily: "Manrope, sans-serif", fontSize: 20, fontWeight: 800, color: C.dark, margin: 0 }}>
              {isRTL ? "الفوترة والخطة" : "Billing & Plan"}
            </h2>
            <p style={{ fontSize: 14, color: C.mid, marginTop: 4 }}>
              {isRTL ? "إدارة اشتراكك وعرض التاريخ." : "Manage your atelier subscription and view history."}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Active Plan */}
            <div style={{ background: C.white, padding: 32, borderRadius: 16, border: `1px solid ${C.surface}`, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 220 }}>
              <div>
                <span style={{ display: "inline-block", padding: "3px 10px", background: C.amber, color: "#92400e", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", borderRadius: 6, marginBottom: 16 }}>
                  {isRTL ? "الخطة النشطة" : "Active Plan"}
                </span>
                <h3 style={{ fontFamily: "Manrope, sans-serif", fontSize: 24, fontWeight: 900, color: C.dark, margin: "0 0 8px" }}>Pro Atelier</h3>
                <p style={{ fontSize: 14, color: C.mid, display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                  <span style={{ color: "#059669", fontSize: 12 }}>✓</span>
                  {isRTL ? "حتى 5 حلاقين وحجوزات غير محدودة" : "Up to 5 barbers & unlimited bookings"}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 32 }}>
                <div>
                  <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 32, fontWeight: 900, color: C.dark }}>25.00 JOD</span>
                  <span style={{ fontSize: 12, color: C.mid }}>/month</span>
                </div>
                <button className="btn btn-secondary" style={{ minHeight: "36px", padding: "0 16px" }}>
                  {isRTL ? "تغيير الخطة" : "Change Plan"}
                </button>
              </div>
            </div>
            {/* Payment */}
            <div style={{ background: C.surfaceLow, padding: 32, borderRadius: 16, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 220 }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.mid, textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 16 }}>
                  {isRTL ? "الدفعة القادمة" : "Next Payment"}
                </span>
                <p style={{ fontWeight: 700, fontSize: 14, color: C.dark, margin: "0 0 4px" }}>Dec 01, 2025</p>
                <p style={{ fontSize: 12, color: C.mid, margin: 0 }}>{isRTL ? "التجديد التلقائي مُفعّل" : "Automatic renewal enabled"}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, background: "rgba(255,255,255,0.6)", borderRadius: 12, border: `1px solid ${C.surface}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 32, height: 20, background: C.black, borderRadius: 4 }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: C.dark }}>Mastercard •••• 8829</span>
                </div>
                <button className="btn btn-secondary" style={{ minHeight: "28px", padding: "0 12px", fontSize: 10, textTransform: "uppercase" }}>
                  {isRTL ? "تحديث" : "Update"}
                </button>
              </div>
            </div>
          </div>
          {/* Invoice Table */}
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.surface}`, overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.surface}` }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: C.mid, margin: 0 }}>
                {isRTL ? "الفواتير الأخيرة" : "Recent Invoices"}
              </h3>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ color: C.mid, borderBottom: `1px solid ${C.surface}`, background: `${C.surfaceLow}80` }}>
                  <th style={{ padding: "12px 24px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left" }}>{isRTL ? "التاريخ" : "Date"}</th>
                  <th style={{ padding: "12px 24px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left" }}>{isRTL ? "المبلغ" : "Amount"}</th>
                  <th style={{ padding: "12px 24px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left" }}>{isRTL ? "الحالة" : "Status"}</th>
                  <th style={{ padding: "12px 24px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>{isRTL ? "الإيصال" : "Receipt"}</th>
                </tr>
              </thead>
              <tbody>
                {[{ date: "Nov 01, 2025", amount: "25.00 JOD" }, { date: "Oct 01, 2025", amount: "25.00 JOD" }].map((inv, i) => (
                  <tr key={i} style={{ borderBottom: i < 1 ? `1px solid ${C.surface}` : undefined, color: C.dark }}>
                    <td style={{ padding: "16px 24px", fontWeight: 500 }}>{inv.date}</td>
                    <td style={{ padding: "16px 24px" }}>{inv.amount}</td>
                    <td style={{ padding: "16px 24px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 99, background: "#d1fae5", color: "#065f46", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                        {isRTL ? "مدفوع" : "Paid"}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "right" }}>
                      <button style={{ color: C.mid, background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>
                        ↓
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
