import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";
import { ADMIN_COPY } from "@/lib/admin/dictionary";

export default function AdminLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{ADMIN_COPY.common.loading}</span>
      <Skeleton className="mb-2 h-7 w-48" />
      <Skeleton className="mb-6 h-4 w-72 max-w-full" />
      <ListSkeleton rows={6} />
    </div>
  );
}
