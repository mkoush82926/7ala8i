"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useWorkspaceStore } from "@/store/workspace-store";
import { toast } from "@/components/ui/toast";
import { useTranslation, headingTracking } from "@/hooks/use-translation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

type SettingsTab = "general" | "team" | "billing" | "booking";

// ── Explicit colors — bypassing Tailwind token resolution ──
const C = {
  dark: "#1c1611",
  mid: "#5a5147",
  muted: "#5a5147",
  outline: "#ede3cd",
  surfaceLow: "#ede3cd",
  surface: "#ede3cd",
  white: "#ffffff",
  black: "#1c1611",
  amber: "#f7f1e4",
};

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const { shopName, barbers, shopId } = useWorkspaceStore();
  const [copied, setCopied] = useState(false);
  const { t, locale, isRTL, FF, FFD } = useTranslation();
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const posterQrCanvasRef = useRef<HTMLCanvasElement>(null);
  const bookingLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/${locale}/shop/${shopId}`
      : `/${locale}/shop/${shopId}`;

  // General tab form state
  const [formShopName, setFormShopName] = useState(shopName);
  const [formEmail, setFormEmail] = useState("");
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDailyGoal, setFormDailyGoal] = useState("120");
  const [loadingShop, setLoadingShop] = useState(() => !!shopId);
  const [saving, setSaving] = useState(false);

  const fetchShopSettings = useCallback(async () => {
    if (!shopId) {
      setLoadingShop(false);
      return;
    }
    setLoadingShop(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("shops")
      .select("name, description, email, whatsapp, daily_goal")
      .eq("id", shopId)
      .single();
    if (data) {
      setFormShopName(data.name ?? shopName);
      setFormDescription(data.description ?? "");
      setFormEmail(data.email ?? "");
      setFormWhatsapp(data.whatsapp ?? "");
      setFormDailyGoal(String(data.daily_goal ?? 120));
    }
    setLoadingShop(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  useEffect(() => {
    fetchShopSettings();
  }, [fetchShopSettings]);

  async function handleSave() {
    if (!shopId) {
      toast("success", "Settings saved locally!");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("shops")
      .update({
        name: formShopName,
        description: formDescription,
        email: formEmail,
        whatsapp: formWhatsapp,
        daily_goal: Number(formDailyGoal) || 0,
      } as Record<string, unknown>)
      .eq("id", shopId);

    setSaving(false);
    if (error) {
      toast("error", "Failed to save: " + error.message);
    } else {
      toast("success", isRTL ? "تم حفظ الإعدادات بنجاح!" : "Settings saved successfully!");
    }
  }

  function handleDownloadQr() {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = "booking-qr-code.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function roundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fitFontSize(
    ctx: CanvasRenderingContext2D,
    text: string,
    weight: number,
    maxWidth: number,
    startSize: number,
    minSize: number,
  ) {
    let size = startSize;
    while (size > minSize) {
      ctx.font = `${weight} ${size}px sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 1;
    }
    return size;
  }

  function handleDownloadPosterKit() {
    const qrSource = posterQrCanvasRef.current;
    if (!qrSource) return;

    const W = 600;
    const H = 900;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const shopDisplayName = (formShopName || shopName || "Halaqy").trim();
    const tagline = isRTL
      ? "امسح رمز QR لحجز موعدك القادم"
      : "Scan to book your next appointment";
    const instruction = isRTL
      ? "لا حاجة لتطبيق — يعمل بكاميرا أي هاتف"
      : "No app needed — works with any phone camera";

    // Background
    ctx.fillStyle = C.white;
    ctx.fillRect(0, 0, W, H);

    // Outer border (print/cut guide)
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    // Header bar
    ctx.fillStyle = C.black;
    ctx.fillRect(0, 0, W, 110);
    ctx.fillStyle = C.white;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 28px sans-serif";
    ctx.fillText("Halaqy", W / 2, 55);

    // Shop name (auto-fit width)
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C.dark;
    const shopFontSize = fitFontSize(ctx, shopDisplayName, 800, 500, 34, 20);
    ctx.font = `800 ${shopFontSize}px sans-serif`;
    ctx.fillText(shopDisplayName, W / 2, 178);

    // Tagline
    ctx.fillStyle = C.mid;
    ctx.font = "600 17px sans-serif";
    ctx.fillText(tagline, W / 2, 212);

    // QR container
    const boxSize = 420;
    const boxX = (W - boxSize) / 2;
    const boxY = 250;
    roundedRectPath(ctx, boxX, boxY, boxSize, boxSize, 16);
    ctx.fillStyle = C.amber;
    ctx.fill();
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = 1;
    ctx.stroke();

    const qrSize = 360;
    const qrX = boxX + (boxSize - qrSize) / 2;
    const qrY = boxY + (boxSize - qrSize) / 2;
    ctx.drawImage(qrSource, qrX, qrY, qrSize, qrSize);

    // Booking link
    const linkFontSize = fitFontSize(ctx, bookingLink, 600, 500, 16, 11);
    ctx.fillStyle = "#a67c3d";
    ctx.font = `600 ${linkFontSize}px sans-serif`;
    ctx.fillText(bookingLink, W / 2, 710);

    // Divider
    ctx.strokeStyle = C.outline;
    ctx.beginPath();
    ctx.moveTo(80, 750);
    ctx.lineTo(W - 80, 750);
    ctx.stroke();

    // Instruction
    ctx.fillStyle = C.mid;
    ctx.font = "500 14px sans-serif";
    ctx.fillText(instruction, W / 2, 792);

    // Footer
    ctx.fillStyle = "#a89e8c";
    ctx.font = "700 11px sans-serif";
    ctx.fillText("© 2026 HALAQY DIGITAL", W / 2, 856);

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    const safeName = shopDisplayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    link.download = `${safeName || "booking"}-print-kit.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "general", label: t.settings.general },
    { id: "team", label: t.settings.team },
    { id: "booking", label: t.settings.bookingLink },
    { id: "billing", label: t.settings.billing },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    toast("success", "Booking link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#ffffff",
    border: "1px solid #ede3cd",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 14,
    color: C.dark,
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: FF,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: headingTracking(isRTL, "0.1em"),
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
          <h2 style={{ fontFamily: FFD, fontSize: 28, fontWeight: 800, letterSpacing: headingTracking(isRTL, "0.014em"), color: C.dark, margin: 0 }}>
            {t.settings.title}
          </h2>
          <p style={{ fontSize: 14, color: C.mid, marginTop: 4 }}>
            {isRTL ? "إدارة إعدادات المشغل والتفضيلات" : "Manage your atelier settings and preferences"}
          </p>
        </div>
        {activeTab === "general" && (
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ minHeight: 40, padding: "0 20px" }}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
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
            <h2 style={{ fontFamily: FFD, fontSize: 20, fontWeight: 800, color: C.dark, margin: 0 }}>
              {isRTL ? "معلومات المتجر" : "Shop Information"}
            </h2>
            <p style={{ fontSize: 14, color: C.mid, marginTop: 4 }}>
              {isRTL ? "تحديث ملفك الشخصي العام والتفضيلات العامة." : "Update your public profile and global preferences."}
            </p>
          </div>
          <div style={{ background: C.white, padding: 32, borderRadius: 12, border: "1px solid #ede3cd" }}>
            {loadingShop ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.mid, fontSize: 14 }}>
                <Loader2 size={16} className="animate-spin" />
                {isRTL ? "جاري تحميل بيانات المتجر..." : "Loading shop details..."}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px 48px" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>{t.settings.shopName}</label>
                  <input
                    style={inputStyle}
                    type="text"
                    value={formShopName}
                    onChange={(e) => setFormShopName(e.target.value)}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>{t.settings.shopDescription}</label>
                  <textarea
                    style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t.settings.contactEmail}</label>
                  <input
                    style={inputStyle}
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>WhatsApp Number</label>
                  <input
                    style={inputStyle}
                    type="tel"
                    value={formWhatsapp}
                    onChange={(e) => setFormWhatsapp(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{isRTL ? "الهدف اليومي للمبيعات (دينار)" : "Daily Sales Goal (JOD)"}</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    step="1"
                    value={formDailyGoal}
                    onChange={(e) => setFormDailyGoal(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TEAM TAB ── */}
      {activeTab === "team" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <h2 style={{ fontFamily: FFD, fontSize: 20, fontWeight: 800, color: C.dark, margin: 0 }}>
              {t.settings.teamMembers}
            </h2>
            <p style={{ fontSize: 14, color: C.mid, marginTop: 4 }}>
              {isRTL ? "تنظيم الحلاقين والموظفين الإداريين." : "Organize your barbers and administrative staff."}
            </p>
          </div>
          <div style={{ background: C.white, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.surface}` }}>
            {barbers.length === 0 ? (
              <div style={{ padding: "40px 24px", textAlign: "center", color: C.mid, fontSize: 14 }}>
                {isRTL ? "لا يوجد أعضاء فريق بعد — ادعُ أول حلاق لك." : "No team members yet — invite your first barber."}
              </div>
            ) : (
              barbers.map((member, i) => (
                <div key={member.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: i < barbers.length - 1 ? `1px solid ${C.surface}` : undefined }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.surfaceLow, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: C.mid }}>
                      {(member.name || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 14, color: C.dark, margin: 0 }}>{member.name || "Team Member"}</p>
                      <p style={{ fontSize: 12, color: C.mid, margin: 0 }}>Barber · Active</p>
                    </div>
                  </div>
                </div>
              ))
            )}
            {/* Invite — pipeline not built yet */}
            <div style={{ background: "#f7f1e4", padding: 24, borderTop: `1px solid ${C.surface}` }}>
              <div style={{ display: "flex", gap: 12 }}>
                <input
                  style={{ ...inputStyle, flex: 1, background: C.surfaceLow, cursor: "not-allowed" }}
                  placeholder={isRTL ? "دعوات الفريق قريبًا" : "Team invites — coming soon"}
                  type="email"
                  disabled
                />
                <button className="btn btn-primary" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
                  {t.settings.inviteBarber}
                </button>
              </div>
              <p style={{ fontSize: 12, color: C.mid, marginTop: 8, marginBottom: 0 }}>
                {isRTL ? "دعوات الفريق عبر البريد الإلكتروني قيد التطوير." : "Email invites for new staff are still in development."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── BOOKING LINK TAB ── */}
      {activeTab === "booking" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <h2 style={{ fontFamily: FFD, fontSize: 20, fontWeight: 800, color: C.dark, margin: 0 }}>
              {t.settings.bookingLink}
            </h2>
            <p style={{ fontSize: 14, color: C.mid, marginTop: 4 }}>
              {isRTL ? "واجهتك العامة لحجوزات العملاء." : "Your public facing interface for client bookings."}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
            {/* Live Link Card */}
            <div style={{ background: C.black, color: C.white, padding: 40, borderRadius: 12, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 280, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "relative", zIndex: 1 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 9999, background: "rgba(255,255,255,0.1)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: headingTracking(isRTL, "0.1em"), marginBottom: 24 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a67c3d", animation: "pulse 2s infinite" }} />
                  {t.settings.onlineBookingLink}
                </span>
                <h3 style={{ fontFamily: "var(--font-intervar), sans-serif", fontSize: 28, fontWeight: 900, letterSpacing: "0.016em", color: C.white, margin: 0 }}>
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
                  href={bookingLink}
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
            <div style={{ background: C.white, border: `1px solid ${C.surface}`, padding: 32, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <div style={{ marginBottom: 24, padding: 16, background: C.surfaceLow, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <QRCodeCanvas ref={qrCanvasRef} value={bookingLink} size={128} />
              </div>
              {/* Hidden higher-res QR source used only to compose the printable poster */}
              <div style={{ display: "none" }}>
                <QRCodeCanvas ref={posterQrCanvasRef} value={bookingLink} size={480} />
              </div>
              <p style={{ fontWeight: 700, fontSize: 14, color: C.dark, margin: "0 0 4px" }}>{isRTL ? "رمز QR للحجز" : "Booking QR Code"}</p>
              <p style={{ fontSize: 11, color: C.mid, margin: "0 0 16px" }}>{isRTL ? "ضعه على مكتب الاستقبال" : "Place this at your reception desk"}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                <button className="btn btn-secondary" style={{ width: "100%" }} onClick={handleDownloadQr}>
                  {isRTL ? "تنزيل بدقة عالية" : "Download High-Res"}
                </button>
                <button className="btn btn-secondary" style={{ width: "100%" }} onClick={handleDownloadPosterKit}>
                  {isRTL ? "تنزيل ملصق للطباعة" : "Download Print Kit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BILLING TAB ── */}
      {activeTab === "billing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <h2 style={{ fontFamily: FFD, fontSize: 20, fontWeight: 800, color: C.dark, margin: 0 }}>
              {isRTL ? "الفوترة والخطة" : "Billing & Plan"}
            </h2>
            <p style={{ fontSize: 14, color: C.mid, marginTop: 4 }}>
              {isRTL ? "إدارة اشتراكك وعرض التاريخ." : "Manage your atelier subscription and view history."}
            </p>
          </div>
          <div style={{ background: C.white, padding: 48, borderRadius: 12, border: `1px solid ${C.surface}`, textAlign: "center" }}>
            <h3 style={{ fontFamily: FFD, fontSize: 20, fontWeight: 800, color: C.dark, margin: "0 0 8px" }}>
              {isRTL ? "الفوترة — قريبًا" : "Billing — Coming Soon"}
            </h3>
            <p style={{ fontSize: 14, color: C.mid, margin: 0, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
              {isRTL
                ? "إدارة الاشتراكات والفواتير قيد التطوير حاليًا وستتوفر قريبًا."
                : "Subscription plans, payment methods, and invoices are still being built and will be available soon."}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
