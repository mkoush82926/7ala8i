"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Check, Loader2, LogOut, Users } from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { buttonClasses, focusRing } from "@/components/ui/recipes";
import { cn } from "@/lib/utils";
import { AuthCard, AuthHeader, AuthShell } from "../auth/_components/auth-shell";

type JoinStatus = "loading" | "auth_required" | "ready" | "accepting" | "success" | "already_member" | "error";

interface InviteLookup {
  shop_id: string;
  role: string;
  status: string;
  expires_at: string | null;
}

type ErrorCodeMap = Record<string, string | undefined>;

function JoinContent() {
  const { t, href } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() || null;
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const [status, setStatus] = useState<JoinStatus>("loading");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const codes = ((t.error as unknown as { codes?: ErrorCodeMap }).codes ?? {}) as ErrorCodeMap;
  const errorText = (code: string | null) => (code && codes[code]) || t.error.message;
  const roleLabel = (r: string | null) =>
    r === "shop_admin" ? t.auth.roleShopAdmin : r === "barber" ? t.auth.roleBarber : r || "";

  const fail = (code: string) => {
    setErrorCode(code);
    setStatus("error");
  };

  const loadShopName = useCallback(
    async (shopId: string, isCancelled: () => boolean) => {
      const { data: shop } = await supabase.from("shops").select("name").eq("id", shopId).maybeSingle();
      const name = (shop as { name?: string } | null)?.name;
      if (!isCancelled() && name) setShopName(name);
    },
    [supabase],
  );

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    async function run() {
      // Tokens are 16–500 chars (InviteAcceptSchema / get_invite_by_token).
      if (!token || token.length < 16 || token.length > 500) return fail("INVITE_INVALID");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setStatus("auth_required");
          return;
        }
        setEmail(user.email ?? null);

        // Token-scoped peek (never a broad table read).
        const { data: lookup } = await supabase.rpc("get_invite_by_token", { p_token: token });
        if (cancelled) return;
        const invite = (Array.isArray(lookup) ? lookup[0] : lookup) as InviteLookup | null;
        if (!invite) return fail("INVITE_INVALID");

        setRole(invite.role);

        const { data: myProfile } = await supabase
          .from("profiles")
          .select("shop_id, role")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        const profile = myProfile as { shop_id: string | null; role: string } | null;

        if (profile?.shop_id && profile.shop_id === invite.shop_id) {
          setRole(profile.role);
          setStatus("already_member");
          void loadShopName(invite.shop_id, isCancelled);
          return;
        }

        if (invite.status === "accepted") return fail("INVITE_USED");
        if (invite.status && invite.status !== "pending") return fail("INVITE_INVALID");
        if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) return fail("INVITE_EXPIRED");

        // Joining changes the account's role, so ask before doing it.
        setStatus("ready");
        void loadShopName(invite.shop_id, isCancelled);
      } catch {
        if (!cancelled) fail("INTERNAL");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setStatus("accepting");
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        fail(typeof body?.code === "string" ? body.code : "INTERNAL");
        return;
      }
      const result = body.data as { shopId?: string; role?: string } | undefined;
      if (result?.role) setRole(result.role);
      setStatus("success");
      toast.success(t.auth.inviteJoined);
      router.refresh();
    } catch {
      fail("INTERNAL");
    }
  }

  async function handleSwitchAccount() {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    setEmail(null);
    setStatus("auth_required");
  }

  const nextPath = token ? `/join?token=${encodeURIComponent(token)}` : "/join";
  const roleText = roleLabel(role);

  return (
    <AuthShell>
      <AuthCard>
        <div aria-live="polite">
          {status === "loading" && (
            <div role="status" className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={28} className="animate-spin text-brand-text motion-reduce:animate-none" aria-hidden="true" />
              <p className="m-0 text-sm text-ink-muted">{t.auth.inviteChecking}</p>
            </div>
          )}

          {status === "auth_required" && (
            <>
              <AuthHeader icon={Users} align="center" title={t.auth.inviteTitle} subtitle={t.auth.inviteSubtitle} />
              <div className="flex flex-col gap-3">
                <Link
                  href={href(`/auth/signup?next=${encodeURIComponent(nextPath)}`)}
                  className={buttonClasses({ variant: "primary", size: "xl", fullWidth: true })}
                >
                  {t.auth.createAccount}
                </Link>
                <Link
                  href={href(`/auth/login?next=${encodeURIComponent(nextPath)}`)}
                  className={buttonClasses({ variant: "secondary", size: "lg", fullWidth: true })}
                >
                  {t.auth.inviteHaveAccount}
                </Link>
              </div>
            </>
          )}

          {(status === "ready" || status === "accepting") && (
            <>
              <AuthHeader
                icon={Users}
                align="center"
                title={shopName ? interpolate(t.auth.inviteReadyTitle, { shop: shopName }) : t.auth.inviteTitle}
                subtitle={interpolate(t.auth.inviteReadyBody, { role: roleText })}
              />
              <Button
                size="xl"
                fullWidth
                onClick={handleAccept}
                loading={status === "accepting"}
              >
                {status === "accepting" ? t.auth.inviteAccepting : t.auth.inviteAccept}
              </Button>
              {email && (
                <p className="mt-4 text-center text-[13px] text-ink-muted">
                  {interpolate(t.auth.inviteSignedInAs, { email })}{" "}
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    disabled={status === "accepting"}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1 rounded-sm border-0 bg-transparent p-0 text-[13px] font-bold text-ink-soft underline underline-offset-2 hover:text-ink disabled:opacity-45",
                      focusRing,
                    )}
                  >
                    <LogOut size={13} aria-hidden="true" />
                    {t.auth.inviteSwitchAccount}
                  </button>
                </p>
              )}
            </>
          )}

          {(status === "success" || status === "already_member") && (
            <>
              <AuthHeader
                icon={Check}
                tone="success"
                align="center"
                title={status === "already_member" ? t.auth.inviteAlreadyMember : t.auth.inviteJoined}
                subtitle={
                  shopName
                    ? interpolate(t.auth.inviteJoinedAt, { role: roleText, shop: shopName })
                    : interpolate(t.auth.inviteJoinedTeam, { role: roleText })
                }
              />
              <a href={href("/")} className={buttonClasses({ variant: "primary", size: "xl", fullWidth: true })}>
                {t.auth.inviteGoDashboard}
              </a>
            </>
          )}

          {status === "error" && (
            <>
              <AuthHeader icon={AlertCircle} tone="error" align="center" title={t.auth.inviteErrorTitle} subtitle={errorText(errorCode)} />
              <Link href={href("/for-business")} className={buttonClasses({ variant: "secondary", size: "lg", fullWidth: true })}>
                {t.auth.backHome}
              </Link>
            </>
          )}
        </div>
      </AuthCard>
    </AuthShell>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinContent />
    </Suspense>
  );
}
