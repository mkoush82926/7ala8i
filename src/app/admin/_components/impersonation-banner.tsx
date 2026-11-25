"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, PencilLine } from "lucide-react";
import { stopImpersonation } from "@/lib/admin/actions";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { formatExpiry, isPast } from "@/lib/admin/format";
import type { ImpersonationInfo } from "@/lib/admin/types";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Always-visible banner while a support session is live, on every back-office
 * page. Write sessions use the danger tone so nobody edits a shop unknowingly.
 */
export function ImpersonationBanner({ session }: { session: ImpersonationInfo }) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [pending, startTransition] = useTransition();
  const c = ADMIN_COPY.support;
  const write = session.mode === "write";

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // When the session times out, re-fetch so the server drops the banner.
  const expired = isPast(session.expires_at, now);
  useEffect(() => {
    if (expired) router.refresh();
  }, [expired, router]);

  const stop = () =>
    startTransition(async () => {
      const res = await stopImpersonation(session.id);
      if (res.ok || res.code === "NO_CHANGE" || res.code === "NOT_FOUND") {
        toast.success(c.stoppedToast);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });

  return (
    <div
      role="status"
      className={cn(
        "border-b",
        write
          ? "border-[var(--accent-rose)] bg-[var(--accent-rose)] text-[var(--on-accent)]"
          : "border-[var(--accent-brass)] bg-[var(--accent-blue-muted)] text-[var(--text-primary)]",
      )}
    >
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 lg:px-6">
        {write ? <PencilLine size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        <p className="min-w-0 flex-1 text-[13px] font-semibold">
          {write ? c.bannerWrite(session.shop_name) : c.bannerRead(session.shop_name)}
          <span className="ms-2 font-normal opacity-80">{c.bannerExpires(formatExpiry(session.expires_at, now))}</span>
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/support"
            className={cn(
              "inline-flex h-9 items-center rounded-[var(--radius)] px-3 text-[13px] font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2",
              write ? "focus-visible:ring-[var(--on-accent)]" : "focus-visible:ring-[var(--accent-brass)]",
            )}
          >
            {c.bannerOpen}
          </Link>
          <button
            type="button"
            onClick={stop}
            disabled={pending}
            aria-busy={pending}
            className={cn(
              "inline-flex h-9 items-center rounded-[var(--radius)] border px-3 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60",
              write
                ? "border-[var(--on-accent)] focus-visible:ring-[var(--on-accent)]"
                : "border-[var(--text-primary)] focus-visible:ring-[var(--accent-brass)]",
            )}
          >
            {pending ? c.stopping : c.stop}
          </button>
        </div>
      </div>
    </div>
  );
}
