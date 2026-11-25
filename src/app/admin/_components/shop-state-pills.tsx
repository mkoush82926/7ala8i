import { Pill } from "@/components/ui/pill";
import { ADMIN_COPY } from "@/lib/admin/dictionary";
import { num, type AdminShopRow } from "@/lib/admin/types";

/** Live / link-only / draft / suspended, plus open-report count. Colour always pairs with a label. */
export function ShopStatePills({ shop }: { shop: Pick<AdminShopRow, "is_published" | "marketplace_visible" | "suspended_at" | "open_reports"> }) {
  const c = ADMIN_COPY.shops;
  return (
    <span className="flex flex-wrap gap-1">
      {shop.suspended_at ? (
        <Pill tone="danger" size="sm">
          {c.suspended}
        </Pill>
      ) : shop.is_published ? (
        <Pill tone="success" size="sm">
          {shop.marketplace_visible ? c.live : c.linkOnly}
        </Pill>
      ) : (
        <Pill tone="neutral" size="sm">
          {c.draft}
        </Pill>
      )}
      {num(shop.open_reports) > 0 && (
        <Pill tone="warning" size="sm">
          {c.openReports(num(shop.open_reports))}
        </Pill>
      )}
    </span>
  );
}
