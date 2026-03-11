import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "Invite token is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Look up the invite
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invite, error: inviteErr } = await (supabase.from("invites") as any)
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (inviteErr || !invite) {
      return NextResponse.json(
        { error: "Invalid or expired invite" },
        { status: 404 },
      );
    }

    // Mark invite as accepted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("invites") as any)
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", invite.id);

    return NextResponse.json({
      shopId: invite.shop_id,
      role: invite.role,
      message: "Invite accepted successfully",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 },
    );
  }
}
