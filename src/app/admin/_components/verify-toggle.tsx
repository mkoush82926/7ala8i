"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { setShopVerified } from "@/lib/admin/actions";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { cn } from "@/lib/utils";
import { ReasonDialog } from "./reason-dialog";

/**
 * The verified-badge switch. Turning it on is one tap (audited); turning it
 * off asks for confirmation with an optional reason. Optimistic, rolled back
 * on error.
 */
export function VerifyToggle({
  shopId,
  shopName,
  verified,
  showLabel = false,
}: {
  shopId: string;
  shopName: string;
  verified: boolean;
  showLabel?: boolean;
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState<{ value: boolean; from: boolean } | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [pending, startTransition] = useTransition();
  const c = ADMIN_COPY.shops;
  // An optimistic value only applies while the server still reports the value
  // it was made from; fresh server truth wins automatically.
  const value = optimistic && optimistic.from === verified ? optimistic.value : verified;


  const turnOn = () =>
    startTransition(async () => {
      setOptimistic({ value: true, from: verified });
      const res = await setShopVerified(shopId, true);
      if (res.ok || res.code === "NO_CHANGE") {
        toast.success(c.verifyOn);
        router.refresh();
      } else {
        setOptimistic(null);
        toast.error(res.message);
      }
    });

  const onClick = () => {
    if (pending) return;
    if (value) setConfirmOff(true);
    else turnOn();
  };

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={c.verifyToggle(shopName)}
        onClick={onClick}
        disabled={pending}
        className="inline-flex shrink-0 items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
      >
        {showLabel && (
          <span className="flex items-center gap-1 text-[13px] font-medium text-ink">
            <BadgeCheck size={16} aria-hidden className={value ? "text-brand-text" : "text-ink-muted"} />
            {c.verified}
          </span>
        )}
        <span
          aria-hidden
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full border transition-colors",
            value
              ? "border-brand bg-brand"
              : "border-line-strong bg-sunken",
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 rounded-full bg-card shadow transition-transform",
              value ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1",
            )}
          />
        </span>
      </button>
      <ReasonDialog
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        title={c.verifyConfirmOffTitle}
        description={c.verifyConfirmOffBody}
        confirmLabel={c.verifyOffAction}
        destructive
        required={false}
        successMessage={c.verifyOff}
        onSubmit={async (reason) => {
          setOptimistic({ value: false, from: verified });
          const res = await setShopVerified(shopId, false, reason);
          if (!res.ok && res.code === "NO_CHANGE") return { ok: true, data: null };
          if (!res.ok) setOptimistic(null);
          return res;
        }}
      />
    </>
  );
}
