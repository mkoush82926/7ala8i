"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { cn } from "@/lib/utils";
import {
    MapPin,
    Users,
    Plus,
    Link as LinkIcon,
    Copy,
    Check,
    Share2,
    BarChart3,
    CreditCard,
    Mail,
    Trash2,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/hooks/use-translation";

type SettingsTab = "general" | "team" | "location" | "booking" | "billing";

export function SettingsPage() {
    const [activeTab, setActiveTab] = useState<SettingsTab>("general");
    const { shopName, barbers, teamSize } = useWorkspaceStore();
    const [copied, setCopied] = useState(false);
    const bookingLink = `lumina.barber/${shopName.toLowerCase().replace(/\s+/g, "-")}`;
    const t = useTranslation();

    const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
        { id: "general", label: t.settings.general, icon: <BarChart3 size={15} /> },
        { id: "team", label: t.settings.team, icon: <Users size={15} /> },
        { id: "location", label: t.settings.location, icon: <MapPin size={15} /> },
        { id: "booking", label: t.settings.bookingLink, icon: <LinkIcon size={15} /> },
        { id: "billing", label: t.settings.billing, icon: <CreditCard size={15} /> },
    ];

    const handleCopy = () => {
        navigator.clipboard.writeText(`https://${bookingLink}`);
        setCopied(true);
        toast("success", "Booking link copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-8">
            <h2 className="text-[20px] tracking-tight text-[var(--text-primary)] font-light">{t.settings.title}</h2>

            {/* Tab Navigation */}
            <div className="flex flex-wrap items-center gap-1 bg-[var(--bg-surface)] rounded-[var(--radius-md)] p-1 w-fit">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "relative flex items-center gap-2 px-4 py-2 rounded-[var(--radius-sm)] text-[12px] font-medium transition-colors cursor-pointer z-10",
                            activeTab === tab.id
                                ? "text-[var(--text-primary)] shadow-sm"
                                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
                        )}
                    >
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="settings-tab-pill"
                                className="absolute inset-0 bg-[var(--bg-surface-active)] rounded-[var(--radius-sm)] border border-[var(--border-primary)]"
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10">{tab.icon}</span>
                        <span className="relative z-10">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
            >
                {activeTab === "general" && (
                    <div className="grid gap-6 max-w-2xl">
                        <GlassCard hoverable={false} padding="lg">
                            <h3 className="text-[13px] text-[var(--text-primary)] mb-4">Shop Information</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[11px] text-[var(--text-tertiary)] font-light mb-1.5 uppercase tracking-wider">
                                        {t.settings.shopName}
                                    </label>
                                    <input
                                        type="text"
                                        defaultValue={shopName}
                                        className="w-full h-9 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[13px] text-[var(--text-primary)] font-light focus:border-[var(--accent-mint)] focus:outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-[var(--text-tertiary)] font-light mb-1.5 uppercase tracking-wider">
                                        Contact Email
                                    </label>
                                    <input
                                        type="email"
                                        defaultValue="info@gentlemensden.com"
                                        className="w-full h-9 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[13px] text-[var(--text-primary)] font-light focus:border-[var(--accent-mint)] focus:outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-[var(--text-tertiary)] font-light mb-1.5 uppercase tracking-wider">
                                        {t.leads.phone}
                                    </label>
                                    <input
                                        type="tel"
                                        defaultValue="+962791234567"
                                        className="w-full h-9 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[13px] text-[var(--text-primary)] font-light focus:border-[var(--accent-mint)] focus:outline-none transition-colors"
                                    />
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                    <div>
                                        <p className="text-[13px] text-[var(--text-primary)]">{t.settings.acquisitionChannel}</p>
                                        <p className="text-[11px] text-[var(--text-tertiary)]">{t.settings.acquisitionDesc}</p>
                                    </div>
                                    <button className="relative w-10 h-5 rounded-full bg-[var(--accent-mint)] cursor-pointer transition-colors">
                                        <motion.div
                                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                                            animate={{ left: 20 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    </button>
                                </div>
                            </div>
                        </GlassCard>

                        <GlassCard hoverable={false} padding="lg">
                            <h3 className="text-[13px] text-[var(--text-primary)] mb-4">Social Media</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[11px] text-[var(--text-tertiary)] font-light mb-1.5 uppercase tracking-wider">
                                        Instagram
                                    </label>
                                    <input
                                        type="text"
                                        defaultValue="@gentlemensden_amman"
                                        className="w-full h-9 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[13px] text-[var(--text-primary)] font-light focus:border-[var(--accent-mint)] focus:outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-[var(--text-tertiary)] font-light mb-1.5 uppercase tracking-wider">
                                        Google Maps URL
                                    </label>
                                    <input
                                        type="text"
                                        defaultValue="https://maps.google.com/..."
                                        className="w-full h-9 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[13px] text-[var(--text-primary)] font-light focus:border-[var(--accent-mint)] focus:outline-none transition-colors"
                                    />
                                </div>
                            </div>
                        </GlassCard>
                    </div>
                )}

                {activeTab === "team" && (
                    <div className="max-w-2xl space-y-6">
                        <GlassCard hoverable={false} padding="lg">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-[13px] text-[var(--text-primary)]">{t.settings.teamMembers}</h3>
                                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                                        {barbers.length} of {teamSize} {t.settings.barbersActive} · {(barbers.length * 1.5).toFixed(1)} {t.common.jod}{t.common.perMonth}
                                    </p>
                                </div>
                                <GlassButton variant="primary" size="sm" icon={<Plus size={14} />}>
                                    {t.settings.inviteBarber}
                                </GlassButton>
                            </div>

                            <div className="space-y-0">
                                {barbers.map((barber, i) => (
                                    <motion.div
                                        key={barber.id}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className={cn(
                                            "flex items-center justify-between py-3",
                                            i < barbers.length - 1 && "border-b border-[var(--border-primary)]"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent-lavender)] to-[var(--accent-blue)] flex items-center justify-center">
                                                <span className="text-[10px] font-medium text-[#0A0A0A]">
                                                    {barber.name.split(" ").map((n) => n[0]).join("")}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-[13px] text-[var(--text-primary)] font-light">
                                                    {barber.name}
                                                </p>
                                                <p className="text-[11px] text-[var(--text-tertiary)]">
                                                    {t.common.active} · 1.5 {t.common.jod}{t.common.perMonth}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <GlassButton size="sm" icon={<Mail size={12} />}>
                                                {t.common.resend}
                                            </GlassButton>
                                            <button className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-rose)] transition-colors cursor-pointer">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </GlassCard>
                    </div>
                )}

                {activeTab === "location" && (
                    <div className="max-w-2xl space-y-6">
                        <GlassCard hoverable={false} padding="lg">
                            <h3 className="text-[13px] text-[var(--text-primary)] mb-4">{t.settings.venueLocation}</h3>
                            <p className="text-[11px] text-[var(--text-tertiary)] mb-4">
                                Drop a pin so clients know exactly where to find you.
                            </p>
                            {/* Map placeholder — will be replaced with Mapbox in a later phase */}
                            <div className="w-full h-64 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-primary)] flex items-center justify-center">
                                <div className="text-center">
                                    <MapPin size={32} className="text-[var(--text-muted)] mx-auto mb-2" />
                                    <p className="text-[12px] text-[var(--text-tertiary)]">
                                        Interactive map (powered by Mapbox)
                                    </p>
                                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                                        Amman, Jordan — 31.9539° N, 35.9106° E
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4">
                                <label className="block text-[11px] text-[var(--text-tertiary)] font-light mb-1.5 uppercase tracking-wider">
                                    {t.settings.address}
                                </label>
                                <input
                                    type="text"
                                    defaultValue="Rainbow St, Amman, Jordan"
                                    className="w-full h-9 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] text-[13px] text-[var(--text-primary)] font-light focus:border-[var(--accent-mint)] focus:outline-none transition-colors"
                                />
                            </div>
                        </GlassCard>
                    </div>
                )}

                {activeTab === "booking" && (
                    <div className="max-w-2xl space-y-6">
                        <GlassCard hoverable={false} padding="lg">
                            <h3 className="text-[13px] text-[var(--text-primary)] mb-1">{t.settings.onlineBookingLink}</h3>
                            <p className="text-[11px] text-[var(--text-tertiary)] mb-6">
                                {t.settings.bookingLinkDesc}
                            </p>

                            {/* Link display */}
                            <div className="flex items-center gap-2 mb-6">
                                <div className="flex-1 h-10 px-4 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-primary)] flex items-center">
                                    <span className="text-[13px] text-[var(--accent-mint)] font-light">
                                        {bookingLink}
                                    </span>
                                </div>
                                <GlassButton
                                    variant={copied ? "primary" : "secondary"}
                                    size="md"
                                    onClick={handleCopy}
                                    icon={
                                        copied ? <Check size={14} /> : <Copy size={14} />
                                    }
                                >
                                    {copied ? "✓" : t.common.copy}
                                </GlassButton>
                                <GlassButton variant="secondary" size="md" icon={<Share2 size={14} />}>
                                    {t.common.share}
                                </GlassButton>
                            </div>

                            {/* QR Code placeholder */}
                            <div className="flex items-center gap-6 p-4 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-primary)]">
                                <div className="w-28 h-28 rounded-[var(--radius-sm)] bg-white flex items-center justify-center flex-shrink-0">
                                    <div className="w-24 h-24 border-2 border-[#0A0A0A] rounded grid grid-cols-3 grid-rows-3 gap-0.5 p-1">
                                        {Array.from({ length: 9 }).map((_, i) => (
                                            <div
                                                key={i}
                                                className={cn(
                                                    "rounded-sm",
                                                    [0, 2, 3, 5, 6, 8].includes(i)
                                                        ? "bg-[#0A0A0A]"
                                                        : "bg-transparent"
                                                )}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[13px] text-[var(--text-primary)] mb-1">{t.settings.qrCode}</p>
                                    <p className="text-[11px] text-[var(--text-tertiary)] mb-3">
                                        {t.settings.qrDesc}
                                    </p>
                                    <GlassButton size="sm">{t.settings.downloadQr}</GlassButton>
                                </div>
                            </div>
                        </GlassCard>
                    </div>
                )}

                {activeTab === "billing" && (
                    <div className="max-w-2xl space-y-6">
                        <GlassCard hoverable={false} padding="lg">
                            <h3 className="text-[13px] text-[var(--text-primary)] mb-4">{t.settings.currentPlan}</h3>

                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-primary)]">
                                    <p className="text-[11px] text-[var(--text-tertiary)] font-light uppercase tracking-wider mb-1">
                                        Active Staff
                                    </p>
                                    <p className="text-xl text-[var(--text-primary)] font-light">{barbers.length}</p>
                                </div>
                                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-primary)]">
                                    <p className="text-[11px] text-[var(--text-tertiary)] font-light uppercase tracking-wider mb-1">
                                        Rate
                                    </p>
                                    <p className="text-xl text-[var(--text-primary)] font-light">1.5 {t.common.jod}</p>
                                    <p className="text-[10px] text-[var(--text-muted)]">{t.settings.perBarber}</p>
                                </div>
                                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--accent-mint-muted)] border border-[var(--accent-mint)]/20">
                                    <p className="text-[11px] text-[var(--accent-mint)] font-light uppercase tracking-wider mb-1">
                                        {t.settings.nextInvoice}
                                    </p>
                                    <p className="text-xl text-[var(--accent-mint)] font-light">
                                        {(barbers.length * 1.5).toFixed(1)}
                                    </p>
                                    <p className="text-[10px] text-[var(--accent-mint)]/60">{t.common.jod} — April 1</p>
                                </div>
                            </div>

                            <h4 className="text-[12px] text-[var(--text-tertiary)] font-light uppercase tracking-wider mb-3">
                                {t.settings.invoiceHistory}
                            </h4>
                            <div className="space-y-0">
                                {["March 2026", "February 2026", "January 2026"].map((month, i) => (
                                    <div
                                        key={month}
                                        className={cn(
                                            "flex items-center justify-between py-3",
                                            i < 2 && "border-b border-[var(--border-primary)]"
                                        )}
                                    >
                                        <div>
                                            <p className="text-[13px] text-[var(--text-primary)] font-light">{month}</p>
                                            <p className="text-[11px] text-[var(--text-tertiary)]">
                                                {barbers.length} barbers · {t.settings.paid}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[13px] text-[var(--text-primary)] font-medium tabular-nums">
                                                {(barbers.length * 1.5).toFixed(1)} {t.common.jod}
                                            </span>
                                            <GlassButton size="sm">PDF</GlassButton>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </GlassCard>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
