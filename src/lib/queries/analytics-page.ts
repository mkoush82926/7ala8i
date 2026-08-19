import type { SupabaseClient } from "@supabase/supabase-js";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subWeeks, subMonths, subYears, parseISO } from "date-fns";

interface AnalyticsAppointmentRow {
  id: string;
  price: number | null;
  status: string | null;
  start_time: string;
  source: string | null;
  barber_id: string | null;
  client_id: string | null;
}

interface AnalyticsClientRow {
  id: string;
}

interface AnalyticsProfileRow {
  id: string;
  full_name: string | null;
}

export async function getFullAnalytics(supabase: SupabaseClient, shopId: string, period: "week" | "month" | "year") {
  const today = new Date();
  let start: string, end: string, prevStart: string, prevEnd: string;

  if (period === "week") {
    start = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss");
    end = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss");
    prevStart = format(startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss");
    prevEnd = format(endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm:ss");
  } else if (period === "month") {
    start = format(startOfMonth(today), "yyyy-MM-dd'T'HH:mm:ss");
    end = format(endOfMonth(today), "yyyy-MM-dd'T'HH:mm:ss");
    prevStart = format(startOfMonth(subMonths(today, 1)), "yyyy-MM-dd'T'HH:mm:ss");
    prevEnd = format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd'T'HH:mm:ss");
  } else {
    start = format(startOfYear(today), "yyyy-MM-dd'T'HH:mm:ss");
    end = format(endOfYear(today), "yyyy-MM-dd'T'HH:mm:ss");
    prevStart = format(startOfYear(subYears(today, 1)), "yyyy-MM-dd'T'HH:mm:ss");
    prevEnd = format(endOfYear(subYears(today, 1)), "yyyy-MM-dd'T'HH:mm:ss");
  }

  // Fetch current period appointments
  const { data: currApptsRaw } = await supabase
    .from("appointments")
    .select("id, price, status, start_time, source, barber_id, client_id")
    .eq("shop_id", shopId)
    .gte("start_time", start)
    .lte("start_time", end);

  // Fetch previous period appointments
  const { data: prevApptsRaw } = await supabase
    .from("appointments")
    .select("id, price, status, client_id")
    .eq("shop_id", shopId)
    .gte("start_time", prevStart)
    .lte("start_time", prevEnd);
    
  // Fetch clients for new clients count
  const { data: currClientsRaw } = await supabase
    .from("clients")
    .select("id")
    .eq("shop_id", shopId)
    .gte("created_at", start)
    .lte("created_at", end);
    
  const { data: prevClientsRaw } = await supabase
    .from("clients")
    .select("id")
    .eq("shop_id", shopId)
    .gte("created_at", prevStart)
    .lte("created_at", prevEnd);

  const currAppts = (currApptsRaw || []) as AnalyticsAppointmentRow[];
  const prevAppts = (prevApptsRaw || []) as AnalyticsAppointmentRow[];
  const currClients = (currClientsRaw || []) as AnalyticsClientRow[];
  const prevClients = (prevClientsRaw || []) as AnalyticsClientRow[];

  // Helper
  const pct = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : +(((curr - prev) / prev) * 100).toFixed(1);

  // 1. Summary Metrics
  const currCompleted = currAppts.filter(a => a.status === "completed");
  const prevCompleted = prevAppts.filter(a => a.status === "completed");

  const currRevenue = currCompleted.reduce((sum, a) => sum + (a.price || 0), 0);
  const prevRevenue = prevCompleted.reduce((sum, a) => sum + (a.price || 0), 0);
  const revChange = pct(currRevenue, prevRevenue);

  const currBookings = currAppts.length;
  const prevBookings = prevAppts.length;
  const bookChange = pct(currBookings, prevBookings);

  const currNewClients = currClients.length;
  const prevNewClients = prevClients.length;
  const clientChange = pct(currNewClients, prevNewClients);

  // Retention rate is only meaningful once there's completed-appointment data
  // to compute it from — with zero completions there is nothing to divide by,
  // and the rate is "not enough data yet", not a genuine 0%.
  const hasCurrRetData = currCompleted.length > 0;
  const hasPrevRetData = prevCompleted.length > 0;
  const currRet = hasCurrRetData ? Math.max(0, Math.min(100, +((1 - currNewClients / currCompleted.length) * 100).toFixed(1))) : null;
  const prevRet = hasPrevRetData ? Math.max(0, Math.min(100, +((1 - prevNewClients / prevCompleted.length) * 100).toFixed(1))) : null;
  const retChange = hasCurrRetData && hasPrevRetData ? +(currRet! - prevRet!).toFixed(1) : null;

  const summary = [
    { id: "revenue", label: "Revenue", value: `${currRevenue.toLocaleString()} JOD`, sub: `vs. ${prevRevenue.toLocaleString()} JOD last period`, change: revChange, dir: revChange >= 0 ? "up" : "down" },
    { id: "bookings", label: "Bookings", value: `${currBookings}`, sub: "Total appointments scheduled", change: bookChange, dir: bookChange >= 0 ? "up" : "down" },
    { id: "clients", label: "New Clients", value: `${currNewClients}`, sub: "First-time visitors this period", change: clientChange, dir: clientChange >= 0 ? "up" : "down" },
    { id: "retention", label: "Retention Rate", value: hasCurrRetData ? `${currRet}%` : "—", sub: hasCurrRetData ? "Returning client frequency" : "Not enough data yet", change: retChange ?? 0, dir: retChange === null ? "flat" : (retChange >= 0 ? "up" : "down") },
  ];

  // 2. Revenue Trend (Chart)
  const groupedRev: Record<string, number> = {};
  currCompleted.forEach(a => {
    if (!a.start_time) return;
    const d = parseISO(a.start_time);
    let lbl = "";
    if (period === "week") lbl = format(d, "EEE");
    else if (period === "month") lbl = format(d, "MMM d");
    else lbl = format(d, "MMM");
    groupedRev[lbl] = (groupedRev[lbl] || 0) + (a.price || 0);
  });
  const revenueChart = Object.entries(groupedRev).map(([name, revenue]) => ({ name, revenue }));

  // 3. Barbers Performance
  const { data: profilesRaw } = await supabase.from("profiles").select("id, full_name").eq("shop_id", shopId);
  const profiles = (profilesRaw || []) as AnalyticsProfileRow[];
  const nameMap = new Map(profiles.map(p => [p.id, p.full_name]));
  
  const bMap: Record<string, number> = {};
  currCompleted.forEach(a => {
    const bId = a.barber_id || "unassigned";
    bMap[bId] = (bMap[bId] || 0) + (a.price || 0);
  });
  
  const barberChart = Object.entries(bMap).map(([id, rev]) => {
    return { name: id === "unassigned" ? "Unassigned" : nameMap.get(id) || "Unknown", revenue: rev, pct: currRevenue ? Math.round((rev / currRevenue) * 100) : 0 };
  }).sort((a,b) => b.revenue - a.revenue).slice(0, 5);

  // 4. Acquisition Sources
  const sMap: Record<string, number> = {};
  currAppts.forEach(a => {
    const src = a.source || "Walk-in";
    sMap[src] = (sMap[src] || 0) + 1;
  });
  const colors = ["#000000", "#45464c", "#76777d", "#c6c6cc", "#eceef0"];
  const totalSrc = currAppts.length || 1;
  const acquisitionChart = Object.entries(sMap).sort((a,b) => b[1] - a[1]).map(([src, count], i) => {
    const p = Math.round((count / totalSrc) * 100);
    return { name: `${src} (${p}%)`, value: p, color: colors[i % colors.length] };
  });
  if (acquisitionChart.length === 0) {
    acquisitionChart.push({ name: "Walk-in (100%)", value: 100, color: "#000000" });
  }

  // 5. Peak Hours Heatmap (Simplified mapping)
  const peakChart = [
    { hour: "09 AM", vals: [0, 0, 0, 0, 0, 0, 0] },
    { hour: "12 PM", vals: [0, 0, 0, 0, 0, 0, 0] },
    { hour: "03 PM", vals: [0, 0, 0, 0, 0, 0, 0] },
    { hour: "06 PM", vals: [0, 0, 0, 0, 0, 0, 0] },
  ];
  currAppts.forEach(a => {
    if (!a.start_time) return;
    const d = parseISO(a.start_time);
    const day = d.getDay(); // 0 = sun, 1 = mon
    const mapDay = day === 0 ? 6 : day - 1; // mon=0 ... sun=6
    const hr = d.getHours();
    
    let row = 0;
    if (hr < 12) row = 0;
    else if (hr < 15) row = 1;
    else if (hr < 18) row = 2;
    else row = 3;
    
    peakChart[row].vals[mapDay] += 1;
  });
  
  let maxPeak = 1;
  peakChart.forEach(r => r.vals.forEach(v => { if (v > maxPeak) maxPeak = v; }));
  peakChart.forEach(r => {
    r.vals = r.vals.map(v => +(v / maxPeak).toFixed(2));
  });

  return { summary, revenueChart, barberChart, acquisitionChart, peakChart };
}
