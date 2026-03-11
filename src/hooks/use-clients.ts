"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceStore } from "@/store/workspace-store";

export interface ClientData {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  source: string;
  visits: number;
  totalSpend: number;
  lastVisit: string;
  avatar: string;
}

const MOCK_CLIENTS: ClientData[] = [
  { id: "1", name: "Tariq Mansour", phone: "+962791234567", email: "tariq@email.com", notes: "", source: "", visits: 24, totalSpend: 312, lastVisit: "2 days ago", avatar: "TM" },
  { id: "2", name: "Sami Khalil", phone: "+962791234568", email: "sami@email.com", notes: "", source: "", visits: 18, totalSpend: 245, lastVisit: "5 days ago", avatar: "SK" },
  { id: "3", name: "Rami Abu-Said", phone: "+962791234569", email: "rami@email.com", notes: "", source: "", visits: 31, totalSpend: 420, lastVisit: "1 day ago", avatar: "RA" },
  { id: "4", name: "Nabil Darwish", phone: "+962791234570", email: "nabil@email.com", notes: "", source: "", visits: 12, totalSpend: 168, lastVisit: "1 week ago", avatar: "ND" },
  { id: "5", name: "Walid Khoury", phone: "+962791234571", email: "walid@email.com", notes: "", source: "", visits: 8, totalSpend: 96, lastVisit: "3 days ago", avatar: "WK" },
  { id: "6", name: "Bassem Hani", phone: "+962791234572", email: "bassem@email.com", notes: "", source: "", visits: 15, totalSpend: 198, lastVisit: "4 days ago", avatar: "BH" },
  { id: "7", name: "Mazen Sabbagh", phone: "+962791234573", email: "mazen@email.com", notes: "", source: "", visits: 42, totalSpend: 580, lastVisit: "Today", avatar: "MS" },
  { id: "8", name: "Fadi Nassar", phone: "+962791234574", email: "fadi@email.com", notes: "", source: "", visits: 6, totalSpend: 78, lastVisit: "2 weeks ago", avatar: "FN" },
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  return `${Math.floor(days / 7)} weeks ago`;
}

export function useClients() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const shopId = useWorkspaceStore((s) => s.shopId);
  const supabase = useRef(createClient()).current;

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("shop_id", shopId)
        .order("updated_at", { ascending: false });

      if (error || !data || data.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      setClients(data.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone || "",
        email: c.email || "",
        notes: c.notes || "",
        source: c.source || "",
        visits: 0,
        totalSpend: Number(c.total_spend) || 0,
        lastVisit: c.updated_at ? timeAgo(c.updated_at) : "Unknown",
        avatar: getInitials(c.name),
      })));
    } catch {
      setClients([]);
    }
    setLoading(false);
  }, [supabase, shopId]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const addClient = useCallback(async (client: { name: string; phone: string; email: string; notes: string }) => {
    const tempId = `temp-${Date.now()}`;
    const newClient: ClientData = {
      id: tempId,
      name: client.name,
      phone: client.phone,
      email: client.email,
      notes: client.notes,
      source: "",
      visits: 0,
      totalSpend: 0,
      lastVisit: "Just now",
      avatar: getInitials(client.name),
    };

    setClients((prev) => [newClient, ...prev]);

    try {
      const { data } = await supabase
        .from("clients")
        .insert({ shop_id: shopId, name: client.name, phone: client.phone, email: client.email, notes: client.notes })
        .select()
        .single();

      if (data) {
        setClients((prev) => prev.map((c) => c.id === tempId ? { ...c, id: data.id } : c));
      }
    } catch { /* optimistic stays */ }
  }, [supabase, shopId]);

  const updateClient = useCallback(async (id: string, updates: Partial<ClientData>) => {
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, ...updates, avatar: updates.name ? getInitials(updates.name) : c.avatar } : c));

    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      await supabase.from("clients").update(dbUpdates).eq("id", id);
    } catch { /* optimistic stays */ }
  }, [supabase]);

  const deleteClient = useCallback(async (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    try {
      await supabase.from("clients").delete().eq("id", id);
    } catch { /* optimistic stays */ }
  }, [supabase]);

  return { clients, loading, addClient, updateClient, deleteClient, refetch: fetchClients };
}
