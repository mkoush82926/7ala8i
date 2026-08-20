"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, AlertCircle, Clock, Loader2 } from "lucide-react";
import { useTranslation, FONT_EN_DISPLAY } from "@/hooks/use-translation";
import { createClient } from "@/lib/supabase/client";

type JoinStatus = "loading" | "auth_required" | "success" | "already_member" | "error";

interface InviteLookup {
  shop_id: string;
  role: string;
  status: string;
  expires_at: string | null;
}

function roleLabel(role: string | null, isRTL: boolean) {
  if (role === "shop_admin") return isRTL ? "مدير المحل" : "Shop Admin";
  if (role === "barber") return isRTL ? "حلاق" : "Barber";
  return role || "";
}

function JoinContent() {
  const { isRTL } = useTranslation();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const supabase = createClient();

  const [status, setStatus] = useState<JoinStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setStatus("error");
        setErrorMessage(isRTL ? "رابط الدعوة غير صالح." : "This invite link is missing a token.");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        setStatus("auth_required");
        return;
      }

      // Safe, token-scoped peek (never a broad table read) — lets us show a
      // graceful "already a member" state on a re-click without treating a
      // once-used invite as an error.
      const { data: lookup } = await supabase.rpc("get_invite_by_token", { p_token: token });
      if (cancelled) return;
      const invite = (Array.isArray(lookup) ? lookup[0] : lookup) as InviteLookup | null;

      if (!invite) {
        setStatus("error");
        setErrorMessage(isRTL ? "الدعوة غير صالحة أو منتهية الصلاحية." : "This invite is invalid or has expired.");
        return;
      }

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("shop_id, role")
        .eq("id", user.id)
        .single();
      if (cancelled) return;

      if (myProfile?.shop_id === invite.shop_id) {
        setRole(myProfile.role);
        setStatus("already_member");
        const { data: shop } = await supabase.from("shops").select("name").eq("id", invite.shop_id).single();
        if (!cancelled && shop?.name) setShopName(shop.name);
        return;
      }

      try {
        const res = await fetch("/api/invite/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const body = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setStatus("error");
          setErrorMessage(
            body?.error ||
              (isRTL ? "الدعوة غير صالحة أو منتهية الصلاحية." : "This invite is invalid or has expired."),
          );
          return;
        }

        setRole(body.role);
        setStatus("success");

        // Best-effort — a nicer confirmation, not required for success.
        const { data: shop } = await supabase.from("shops").select("name").eq("id", body.shopId).single();
        if (!cancelled && shop?.name) setShopName(shop.name);
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(isRTL ? "حدث خطأ غير متوقع." : "Something went wrong. Please try again.");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const nextPath = token ? `/join?token=${encodeURIComponent(token)}` : "/join";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg-secondary)" }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/landing"
            dir="ltr"
            style={{ fontFamily: FONT_EN_DISPLAY }}
            className="text-3xl font-black tracking-wide text-[var(--text-primary)] no-underline"
          >
            Halaqy.
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
          className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-[var(--radius-xl)] p-8 text-center"
        >
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 size={32} className="animate-spin text-[var(--accent-mint)]" />
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                {isRTL ? "جارٍ التحقق من رابط الدعوة..." : "Checking your invite..."}
              </p>
            </div>
          )}

          {status === "auth_required" && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[var(--accent-blue-muted)] flex items-center justify-center">
                <Clock size={24} className="text-[var(--accent-blue)]" />
              </div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                {isRTL ? "دعوة للانضمام إلى الفريق" : "You've been invited to join a team"}
              </h1>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {isRTL
                  ? "أنشئ حساباً أو سجّل الدخول لإكمال الانضمام."
                  : "Create an account or log in to finish joining."}
              </p>
              <div className="flex flex-col w-full gap-3 mt-2">
                <Link
                  href={`/auth/signup?next=${encodeURIComponent(nextPath)}`}
                  className="btn btn-primary w-full justify-center"
                >
                  {isRTL ? "إنشاء حساب" : "Create an account"}
                </Link>
                <Link
                  href={`/auth/login?next=${encodeURIComponent(nextPath)}`}
                  className="w-full text-center text-sm font-semibold py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {isRTL ? "لدي حساب بالفعل — تسجيل الدخول" : "I already have an account — log in"}
                </Link>
              </div>
            </div>
          )}

          {(status === "success" || status === "already_member") && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[var(--accent-mint-muted)] flex items-center justify-center">
                <Check size={24} className="text-[var(--accent-mint)]" />
              </div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                {status === "already_member"
                  ? isRTL
                    ? "أنت عضو بالفعل"
                    : "You're already a member"
                  : isRTL
                    ? "تم الانضمام بنجاح!"
                    : "You're in!"}
              </h1>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {shopName
                  ? isRTL
                    ? `أنت الآن ${roleLabel(role, isRTL)} في ${shopName}.`
                    : `You're now a ${roleLabel(role, isRTL)} at ${shopName}.`
                  : isRTL
                    ? `أنت الآن ${roleLabel(role, isRTL)} في هذا المحل.`
                    : `You're now a ${roleLabel(role, isRTL)} on this team.`}
              </p>
              <Link href="/" className="btn btn-primary w-full justify-center mt-2">
                {isRTL ? "الذهاب إلى لوحة التحكم" : "Go to dashboard"}
              </Link>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[var(--accent-rose-muted)] flex items-center justify-center">
                <AlertCircle size={24} className="text-[var(--accent-rose)]" />
              </div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                {isRTL ? "تعذر إكمال الدعوة" : "This invite can't be completed"}
              </h1>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{errorMessage}</p>
              <Link
                href="/landing"
                className="w-full text-center text-sm font-semibold py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mt-2"
              >
                {isRTL ? "العودة إلى الصفحة الرئيسية" : "Back to the homepage"}
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinContent />
    </Suspense>
  );
}
