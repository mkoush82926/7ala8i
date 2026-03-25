"use client";

import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell, Check, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  useEffect(() => {
    async function loadNotifications() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) setNotifications(data);
      setLoading(false);
    }

    loadNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel("public:notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  async function markAsRead(id: string, link: string | null) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (link) {
      setOpen(false);
      router.push(link);
    }
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
  }

  return (
    <div className="relative z-[100]">
      <button 
        onClick={() => setOpen(!open)}
        className="relative w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--accent-rose)] border-2 border-[var(--bg-primary)]"></span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-80 sm:w-80 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-primary)] shadow-2xl z-50 overflow-hidden" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="p-4 border-b border-[var(--border-primary)] flex justify-between items-center bg-[var(--bg-surface)]">
              <h3 className="font-semibold text-[14px] text-[var(--text-primary)]">Notifications</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[11px] text-[var(--accent-mint)] hover:underline font-medium cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <Check size={12} /> Mark all read
                </button>
              )}
            </div>
            
            <div className="overflow-y-auto flex-1 p-2">
              {loading ? (
                <div className="py-8 flex justify-center"><Loader2 size={20} className="animate-spin text-[var(--text-muted)]" /></div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center text-[var(--text-tertiary)] text-[13px]">
                  No notifications yet.
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => markAsRead(n.id, n.link)}
                      className={`text-left p-3 rounded-xl transition-colors cursor-pointer ${
                        n.is_read ? "hover:bg-[var(--bg-surface-hover)] opacity-70" : "bg-[var(--accent-mint-muted)] hover:brightness-95"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className={`text-[13px] ${n.is_read ? "font-medium text-[var(--text-secondary)]" : "font-bold text-[var(--text-primary)]"}`}>
                          {n.title}
                        </h4>
                        {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-mint)] flex-shrink-0 mt-1.5"></span>}
                      </div>
                      <p className="text-[12px] text-[var(--text-tertiary)] line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      <span className="text-[10px] text-[var(--text-muted)] mt-2 block">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
