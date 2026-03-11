import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const bookingSchema = z.object({
  shopId: z.string().uuid("Invalid shop ID"),
  serviceIds: z.array(z.string()).optional(),
  barberId: z.string().nullable().optional(),
  clientName: z.string().min(2, "Name must be at least 2 characters").max(100),
  clientPhone: z.string().min(7, "Phone must be at least 7 digits").max(20),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  totalPrice: z.number().min(0).optional(),
  source: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get("shopId");
  const date = req.nextUrl.searchParams.get("date");

  if (!shopId) {
    return NextResponse.json({ error: "shopId is required" }, { status: 400 });
  }

  try {
    const [shopRes, servicesRes, barbersRes] = await Promise.all([
      supabase.from("shops").select("id, name, address, currency").eq("id", shopId).single(),
      supabase.from("services").select("*").eq("shop_id", shopId).eq("is_active", true).order("sort_order"),
      supabase.from("profiles").select("id, full_name, avatar_url").eq("shop_id", shopId),
    ]);

    let appointments: { start_time: string; end_time: string; barber_id: string | null }[] = [];
    if (date) {
      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59`;
      const apptRes = await supabase
        .from("appointments")
        .select("start_time, end_time, barber_id")
        .eq("shop_id", shopId)
        .gte("start_time", dayStart)
        .lte("start_time", dayEnd)
        .neq("status", "cancelled");
      appointments = apptRes.data || [];
    }

    return NextResponse.json({
      shop: shopRes.data,
      services: servicesRes.data || [],
      barbers: barbersRes.data || [],
      appointments,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch shop data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "anonymous";
    const { success } = rateLimit(`booking:${ip}`, 5);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const body = await req.json();

    const parsed = bookingSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(errors).flat()[0] || "Invalid input";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { shopId, serviceIds, barberId, clientName, clientPhone, startTime, endTime, totalPrice, source } = parsed.data;

    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .upsert(
        { shop_id: shopId, name: clientName, phone: clientPhone, source: source || null },
        { onConflict: "shop_id,phone", ignoreDuplicates: true },
      )
      .select("id")
      .single();

    let clientId = client?.id;
    if (clientErr || !clientId) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("shop_id", shopId)
        .eq("phone", clientPhone)
        .single();
      clientId = existing?.id || null;
    }

    const { data: appointment, error: apptErr } = await supabase
      .from("appointments")
      .insert({
        shop_id: shopId,
        client_id: clientId,
        barber_id: barberId === "any" ? null : (barberId || null),
        service_ids: serviceIds || [],
        client_name: clientName,
        start_time: startTime,
        end_time: endTime,
        status: "pending",
        price: totalPrice || 0,
        payment_status: "unpaid",
        payment_method: "cash",
        amount_total: totalPrice ?? null,
        amount_deposit: 0,
        amount_paid: 0,
        source: source || null,
      })
      .select()
      .single();

    if (apptErr) {
      return NextResponse.json({ error: apptErr.message }, { status: 500 });
    }

    return NextResponse.json({ appointment, clientId });
  } catch {
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
