import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;

const bookingSchema = z.object({
  shopId: z.string().uuid("Invalid shop ID"),
  serviceIds: z.array(z.string().uuid("Invalid service ID")).optional(),
  barberId: z.string().nullable().optional(),
  clientName: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  clientPhone: z.string().trim().regex(phoneRegex, "Invalid phone number format"),
  startTime: z.string().datetime("Start time must be a valid ISO date string"),
  endTime: z.string().datetime("End time must be a valid ISO date string"),
  totalPrice: z.number().nonnegative("Price cannot be negative").max(100000, "Price exceeds maximum allowed limit").optional(),
  source: z.string().trim().max(50).nullable().optional(),
}).refine(data => new Date(data.endTime) > new Date(data.startTime), {
  message: "End time must be after start time",
  path: ["endTime"],
});

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

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
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Please log in to book." }, { status: 401 });
  }

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
      const firstError = Object.values(errors).flat()[0] || "Invalid input data";
      console.warn("[Booking API] Validation failed:", errors);
      return NextResponse.json({ error: firstError, details: errors }, { status: 400 });
    }

    const { shopId, serviceIds, barberId, clientName, clientPhone, startTime, endTime, totalPrice, source } = parsed.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: appointmentId, error: rpcErr } = await (supabase.rpc as any)("create_public_booking", {
      p_shop_id: shopId,
      p_client_name: clientName,
      p_client_phone: clientPhone,
      p_service_ids: serviceIds || [],
      p_barber_id: barberId === "any" ? null : (barberId || null),
      p_start_time: startTime,
      p_end_time: endTime,
      p_total_price: totalPrice || 0,
      p_source: source || "online",
    });

    if (rpcErr || !appointmentId) {
      console.error("[Booking API] RPC failed:", rpcErr);
      return NextResponse.json({ error: "Failed to schedule appointment", details: rpcErr }, { status: 500 });
    }

    if (user?.email && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Link the client record to the user by setting the email, bypassing RLS using service role
      const adminSupabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { cookies: { getAll() { return [] } } }
      );
      const { data: appt } = await adminSupabase.from('appointments').select('client_id').eq('id', appointmentId).single();
      if (appt?.client_id) {
        await adminSupabase.from('clients').update({ email: user.email }).eq('id', appt.client_id);
      }
    }

    return NextResponse.json({ success: true, appointment_id: appointmentId });
  } catch (err) {
    console.error("[Booking API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
