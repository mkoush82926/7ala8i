import type { SupabaseClient } from "@supabase/supabase-js";

// The new WS-1A tables are not in the generated Database types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyClient = SupabaseClient<any, any, any>;

export type UploadErrorCode = "type" | "size" | "decode" | "upload" | "too_large";
