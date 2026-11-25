"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { reportError } from "@/lib/error-reporting";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void reportError(error, { tags: { area: "admin" }, level: "error" }).catch(() => {});
  }, [error]);

  return (
    <EmptyState
      tone="error"
      icon={AlertTriangle}
      title={ADMIN_COPY.common.errorTitle}
      description={ADMIN_COPY.common.errorBody}
      action={{ label: ADMIN_COPY.common.retry, onClick: reset }}
      headingLevel={2}
    />
  );
}
