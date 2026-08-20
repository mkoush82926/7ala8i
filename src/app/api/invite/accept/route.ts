import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const inviteAcceptSchema = z.object({
  token: z.string().min(1, "Invite token is required").max(500, "Token is too long"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = inviteAcceptSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(errors).flat()[0] || "Invalid input data";
      return NextResponse.json({ error: firstError, details: errors }, { status: 400 });
    }

    const { token } = parsed.data;

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("accept_invite", { p_token: token });

    if (error) {
      const message = error.message || "";
      if (message.includes("Not authenticated")) {
        return NextResponse.json({ error: "Please log in to accept this invite" }, { status: 401 });
      }
      if (message.includes("already been used")) {
        return NextResponse.json({ error: "This invite has already been used" }, { status: 409 });
      }
      if (message === "This invite has expired") {
        return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
      }
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result) {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
    }

    return NextResponse.json({
      shopId: result.shop_id,
      role: result.role,
      message: "Invite accepted successfully",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 },
    );
  }
}
