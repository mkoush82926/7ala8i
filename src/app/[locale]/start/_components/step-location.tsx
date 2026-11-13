"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { LocateFixed, MapPin } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { inJordan } from "../_lib/wizard";
import type { AreaOption, CityOption } from "./start-wizard";
import type { StepProps } from "./step-shop";
import { Notice, SelectField, StepHeader, TextField } from "./ui";

const LocationMap = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => <Skeleton variant="card" className="h-[260px] w-full sm:h-[320px]" />,
});

const AMMAN = { lat: 31.9539, lng: 35.9106, zoom: 12 };

export function StepLocation({
  draft,
  update,
  errors,
  cities,
  areas,
}: StepProps & { cities: CityOption[]; areas: AreaOption[] }) {
  const { t, locale } = useTranslation();
  const s = t.start;
  const [mapDown, setMapDown] = useState(false);
  const [locating, setLocating] = useState(false);
  const loc = draft.location;
  const err = (k: string) => (errors[k] ? s.errors[errors[k] as keyof typeof s.errors] : null);
  const label = (x: { name_en: string; name_ar: string }) => (locale === "ar" ? x.name_ar : x.name_en);

  const cityAreas = useMemo(() => areas.filter((a) => a.city_id === loc.cityId), [areas, loc.cityId]);
  const city = cities.find((c) => c.id === loc.cityId) ?? null;
  const area = areas.find((a) => a.id === loc.areaId) ?? null;

  const fallback = useMemo(() => {
    if (area?.lat != null && area?.lng != null) return { lat: area.lat, lng: area.lng, zoom: 15 };
    if (city?.lat != null && city?.lng != null) return { lat: city.lat, lng: city.lng, zoom: 12 };
    return AMMAN;
  }, [area, city]);

  function setLoc(patch: Partial<typeof loc>) {
    update((d) => ({ ...d, location: { ...d.location, ...patch } }));
  }

  function pickCity(id: string) {
    const c = cities.find((x) => x.id === id);
    setLoc({ cityId: id || null, areaId: null, lat: c?.lat ?? null, lng: c?.lng ?? null });
  }

  function pickArea(id: string) {
    const a = areas.find((x) => x.id === id);
    setLoc({ areaId: id || null, ...(a?.lat != null && a?.lng != null ? { lat: a.lat, lng: a.lng } : {}) });
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      toast.error(s.location.geoUnavailable);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        if (!inJordan(latitude, longitude)) {
          toast.error(s.errors.pinOutside);
          return;
        }
        // Also pick the nearest known area/city so search pages list the shop.
        let best: AreaOption | null = null;
        let bestD = Infinity;
        for (const a of areas) {
          if (a.lat == null || a.lng == null) continue;
          const dd = (a.lat - latitude) ** 2 + (a.lng - longitude) ** 2;
          if (dd < bestD) {
            bestD = dd;
            best = a;
          }
        }
        const near = best && bestD < 0.0009; // ≈ 3 km
        setLoc({
          lat: Math.round(latitude * 1e6) / 1e6,
          lng: Math.round(longitude * 1e6) / 1e6,
          ...(near && best ? { cityId: best.city_id, areaId: best.id } : {}),
        });
        toast.success(s.location.geoFound);
      },
      () => {
        setLocating(false);
        toast.error(s.location.geoDenied);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <div>
      <StepHeader title={s.location.title} subtitle={s.location.subtitle} />
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label={s.location.cityLabel}
            value={loc.cityId ?? ""}
            onChange={(e) => pickCity(e.target.value)}
            error={err("cityId")}
          >
            <option value="">{s.location.cityPlaceholder}</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {label(c)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={s.location.areaLabel}
            value={loc.areaId ?? ""}
            onChange={(e) => pickArea(e.target.value)}
            disabled={!loc.cityId || cityAreas.length === 0}
          >
            <option value="">{cityAreas.length ? s.location.areaPlaceholder : s.location.areaNone}</option>
            {cityAreas.map((a) => (
              <option key={a.id} value={a.id}>
                {label(a)}
              </option>
            ))}
          </SelectField>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="field-label !mb-0">{s.location.pinTitle}</span>
            <button
              type="button"
              onClick={locateMe}
              disabled={locating}
              aria-busy={locating || undefined}
              className="btn btn-ghost !min-h-[40px] !px-3 text-[14px]"
            >
              <LocateFixed size={16} aria-hidden />
              {locating ? s.location.locating : s.location.useMyLocation}
            </button>
          </div>
          {mapDown ? (
            <Notice>
              <span className="inline-flex items-start gap-2">
                <MapPin size={16} aria-hidden className="mt-0.5 shrink-0" />
                {s.location.mapUnavailable}
              </span>
            </Notice>
          ) : (
            <>
              <LocationMap
                lat={loc.lat}
                lng={loc.lng}
                fallback={fallback}
                onChange={(lat, lng) => setLoc({ lat, lng })}
                onUnavailable={() => setMapDown(true)}
              />
              <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
                {s.location.pinHint}
              </p>
            </>
          )}
          {err("pin") && (
            <p className="field-error" role="alert">
              {err("pin")}
            </p>
          )}
        </div>

        <TextField
          label={s.location.landmarkLabel}
          placeholder={s.location.landmarkPlaceholder}
          value={loc.landmark}
          maxLength={200}
          onChange={(e) => setLoc({ landmark: e.target.value })}
          hint={s.location.landmarkHint}
        />
      </div>
    </div>
  );
}
