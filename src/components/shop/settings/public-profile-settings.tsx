"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/hooks/use-translation";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton, ListSkeleton } from "@/components/ui/skeleton";
import { PhotosManager } from "./photos-manager";
import { PortfolioManager } from "./portfolio-manager";
import { PublishPanel } from "./publish-panel";
import { AmenitiesSection, DetailsSection, LocationSection } from "./shop-sections";
import { TeamProfiles } from "./team-profiles";
import type { AnyClient } from "./types";
import { usePublicProfile } from "./use-public-profile";

const SECTIONS = ["publish", "photos", "details", "location", "team", "portfolio", "amenities"] as const;

/** Settings › Public profile: everything that shapes /shop/[slug] and /barber/[handle]. */
export function PublicProfileSettings() {
  const { t, href, isRTL } = useTranslation();
  const pp = t.publicProfile;
  const shopId = useWorkspaceStore((s) => s.shopId);
  const role = useWorkspaceStore((s) => s.role);
  const userId = useWorkspaceStore((s) => s.userId);
  const hydrated = useWorkspaceStore((s) => s.hydrated);
  const isAdmin = role === "shop_admin";
  const [supabase] = useState<AnyClient>(() => createClient() as unknown as AnyClient);
  const { status, state, reload, patch } = usePublicProfile(supabase, hydrated && shopId ? shopId : null);
  const refresh = useCallback(() => void reload(true), [reload]);

  if (hydrated && !shopId) {
    return <EmptyState icon={Store} size="lg" title={pp.noShopTitle} description={pp.noShopDesc} />;
  }

  const sectionLabel: Record<(typeof SECTIONS)[number], string> = {
    publish: pp.navPublish,
    photos: pp.photosTitle,
    details: pp.detailsTitle,
    location: pp.locationTitle,
    team: pp.teamTitle,
    portfolio: pp.portfolioTitle,
    amenities: pp.amenitiesTitle,
  };

  return (
    <div className="mx-auto max-w-5xl pb-24">
      <header className="mb-5">
        <Link href={href("/settings")} className="focus-ring mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" className={isRTL ? "rotate-180" : undefined} />
          {pp.backToSettings}
        </Link>
        <h1 className="text-h1 text-ink">{pp.pageTitle}</h1>
        <p className="mt-1 text-sm text-ink-muted">{pp.pageDesc}</p>
      </header>

      <nav aria-label={pp.sectionsLabel} className="sticky top-0 z-10 -mx-4 mb-5 overflow-x-auto border-b border-line bg-card px-4">
        <ul className="flex gap-1 whitespace-nowrap py-2">
          {SECTIONS.map((id) => (
            <li key={id}>
              <a href={`#${id}`} className="focus-ring inline-flex min-h-[40px] items-center rounded-full px-3 text-sm font-semibold text-ink-muted hover:bg-sunken hover:text-ink">
                {sectionLabel[id]}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {status === "loading" || !hydrated ? (
        <div className="grid gap-4" aria-busy="true" aria-label={t.common.loading}>
          <CardSkeleton />
          <ListSkeleton rows={4} />
        </div>
      ) : status === "error" || !state ? (
        <EmptyState
          tone="error"
          title={pp.loadErrorTitle}
          description={pp.loadErrorDesc}
          action={{ label: t.common.retry, onClick: () => void reload() }}
        />
      ) : (
        <div className="grid gap-5">
          {!isAdmin && (
            <p role="note" className="rounded-lg bg-sunken px-4 py-3 text-sm text-ink-muted">
              {pp.barberNote}
            </p>
          )}
          <PublishPanel
            supabase={supabase}
            shopId={state.shop.id}
            slugAr={state.shop.slug_ar}
            state={{
              items: state.checklist,
              is_published: state.shop.is_published,
              marketplace_visible: state.shop.marketplace_visible,
              slug: state.shop.slug,
            }}
            canEdit={isAdmin}
            onChanged={refresh}
          />
          <PhotosManager
            supabase={supabase}
            shopId={state.shop.id}
            photos={state.photos}
            canEdit={isAdmin}
            onPhotos={(photos) => patch((s) => ({ ...s, photos }))}
            onChanged={refresh}
          />
          <DetailsSection supabase={supabase} shop={state.shop} canEdit={isAdmin} onSaved={refresh} />
          <LocationSection supabase={supabase} shop={state.shop} cities={state.cities} areas={state.areas} canEdit={isAdmin} onSaved={refresh} />
          <TeamProfiles
            supabase={supabase}
            shopId={state.shop.id}
            team={state.team}
            userId={userId}
            isAdmin={isAdmin}
            onTeam={(team) => patch((s) => ({ ...s, team }))}
            onChanged={refresh}
          />
          <PortfolioManager
            supabase={supabase}
            shopId={state.shop.id}
            items={state.portfolio}
            team={state.team}
            services={state.services}
            userId={userId}
            isAdmin={isAdmin}
            onItems={(portfolio) => patch((s) => ({ ...s, portfolio }))}
            onChanged={refresh}
          />
          <AmenitiesSection
            supabase={supabase}
            shopId={state.shop.id}
            amenities={state.amenities}
            selected={state.selectedAmenities}
            canEdit={isAdmin}
            onSelected={(selectedAmenities) => patch((s) => ({ ...s, selectedAmenities }))}
            onChanged={refresh}
          />
        </div>
      )}
    </div>
  );
}

export default PublicProfileSettings;
