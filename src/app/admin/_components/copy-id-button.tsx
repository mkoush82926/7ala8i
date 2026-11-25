"use client";

import { Copy } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { ADMIN_COPY } from "@/lib/admin/dictionary";

/** Copies a record ID (used when recording a claim dispute or filtering the audit log). */
export function CopyIdButton({ value }: { value: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(ADMIN_COPY.common.copied);
    } catch {
      toast.error(ADMIN_COPY.errors.UNKNOWN);
    }
  };
  return (
    <button type="button" onClick={copy} className="btn btn-ghost" title={value}>
      <Copy size={16} aria-hidden />
      {ADMIN_COPY.common.copyId}
    </button>
  );
}
