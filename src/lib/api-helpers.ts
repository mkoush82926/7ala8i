import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// ─── Standard API Response Shape ───
interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export function apiResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data } satisfies ApiSuccessResponse<T>,
    { status },
  );
}

export function apiError(message: string, status = 400, details?: unknown) {
  const body: ApiErrorResponse = { success: false, error: message };
  if (details) body.details = details;
  console.error(`[API Error ${status}]`, message, details ?? "");
  return NextResponse.json(body, { status });
}

// ─── Auth wrapper for protected API routes ───
type AuthenticatedHandler = (
  req: Request,
  context: {
    user: { id: string; email?: string };
    shopId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any;
  },
) => Promise<NextResponse>;

export function withAuth(handler: AuthenticatedHandler) {
  return async (req: Request) => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return apiError("Unauthorized", 401);
      }

      // Get user's shop_id from their profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile, error: profileError } = await (supabase
        .from("profiles") as any)
        .select("shop_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        return apiError("User profile not found", 403);
      }

      return handler(req, {
        user: { id: user.id, email: user.email },
        shopId: profile.shop_id,
        supabase,
      });
    } catch (err) {
      console.error("[API] Unexpected error:", err);
      return apiError("Internal server error", 500);
    }
  };
}
