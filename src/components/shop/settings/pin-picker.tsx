"use client";

import React, { useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/recipes";
import { LocateFixed, MapPin, Minus, Plus } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import {
  AMMAN_CENTER,
  clampZoom,
  isValidLatLng,
  panBy,
  pixelToLatLng,
  project,
  roundCoord,
  tileSource,
  tilesForViewport,
  TILE_SIZE,
  type LatLng,
} from "../lib/map";
import { TextField } from "./ui";

const HEIGHT = 300;
const PAN_STEP = 80;

/**
 * Pin picker on raster tiles: tap/click to drop the pin, drag to pan, +/- to
 * zoom, arrow keys pan and Enter drops the pin at the centre, "Use my
 * location" asks the browser. Numeric fields keep it usable without a map.
 */
export function PinPicker({ value, onChange }: { value: LatLng | null; onChange: (value: LatLng | null) => void }) {
  // Controls sit on the inline-end side (left in Arabic); the tiles never mirror.
  const { t, isRTL } = useTranslation();
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [center, setCenter] = useState<LatLng>(value ?? AMMAN_CENTER);
  const [zoom, setZoom] = useState(value ? 17 : 12);
  const [locating, setLocating] = useState(false);
  const drag = useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null);
  const [latText, setLatText] = useState(value ? String(value.lat) : "");
  const [lngText, setLngText] = useState(value ? String(value.lng) : "");

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const setPin = (p: LatLng) => {
    const next = { lat: roundCoord(p.lat), lng: roundCoord(p.lng) };
    onChange(next);
    setLatText(String(next.lat));
    setLngText(String(next.lng));
  };

  const source = tileSource(process.env.NEXT_PUBLIC_MAPTILER_KEY);
  const tiles = tilesForViewport(center, zoom, width, HEIGHT);
  // Pin position inside the viewport.
  let pin: { x: number; y: number } | null = null;
  if (value) {
    const z = clampZoom(zoom);
    const pv = project(value, z);
    const pc = project(center, z);
    pin = { x: pv.x - pc.x + width / 2, y: pv.y - pc.y + HEIGHT / 2 };
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    setCenter((c) => panBy(c, zoom, dx, dy));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setPin(pixelToLatLng(center, zoom, width, HEIGHT, e.clientX - rect.left, e.clientY - rect.top));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, PAN_STEP],
      ArrowDown: [0, -PAN_STEP],
      ArrowLeft: [PAN_STEP, 0],
      ArrowRight: [-PAN_STEP, 0],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setCenter((c) => panBy(c, zoom, dx, dy));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setPin(center);
    } else if (e.key === "+" || e.key === "=") {
      setZoom((z) => clampZoom(z + 1));
    } else if (e.key === "-") {
      setZoom((z) => clampZoom(z - 1));
    }
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(p);
        setZoom(17);
        setPin(p);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const commitText = () => {
    const lat = Number(latText);
    const lng = Number(lngText);
    if (latText.trim() === "" && lngText.trim() === "") {
      onChange(null);
      return;
    }
    if (isValidLatLng(lat, lng)) {
      const p = { lat: roundCoord(lat), lng: roundCoord(lng) };
      onChange(p);
      setCenter(p);
    }
  };
  const textInvalid =
    (latText.trim() !== "" || lngText.trim() !== "") && !isValidLatLng(Number(latText), Number(lngText));

  return (
    <div className="space-y-3">
      <div
        ref={boxRef}
        role="application"
        aria-label={t.publicProfile.mapPickerLabel}
        aria-describedby="pin-picker-help"
        tabIndex={0}
        dir="ltr"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={onKeyDown}
        className="focus-ring relative overflow-hidden rounded-xl bg-sunken touch-none select-none cursor-crosshair"
        style={{ height: HEIGHT }}
      >
        {tiles.map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={tile.key}
            src={source.url(tile)}
            alt=""
            draggable={false}
            className="absolute max-w-none pointer-events-none"
            style={{ left: tile.left, top: tile.top, width: TILE_SIZE, height: TILE_SIZE }}
          />
        ))}
        {pin && pin.x > -20 && pin.x < width + 20 && pin.y > -40 && pin.y < HEIGHT + 40 && (
          <span aria-hidden="true" className="absolute pointer-events-none -translate-x-1/2 -translate-y-full" style={{ left: pin.x, top: pin.y }}>
            <MapPin size={36} strokeWidth={2} className="fill-card text-brand drop-shadow-md" />
          </span>
        )}
        {/* Centre cross for keyboard placement */}
        <span aria-hidden="true" className="absolute pointer-events-none w-3 h-3 border-2 border-ink/50 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ left: "50%", top: "50%" }} />
        <div className="absolute top-2 flex flex-col gap-1" style={isRTL ? { left: 8 } : { right: 8 }} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => setZoom((z) => clampZoom(z + 1))} aria-label={t.publicProfile.zoomIn} className="focus-ring w-9 h-9 rounded-lg bg-card border border-line flex items-center justify-center">
            <Plus size={16} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setZoom((z) => clampZoom(z - 1))} aria-label={t.publicProfile.zoomOut} className="focus-ring w-9 h-9 rounded-lg bg-card border border-line flex items-center justify-center">
            <Minus size={16} aria-hidden="true" />
          </button>
        </div>
        <a
          href={source.attributionUrl}
          target="_blank"
          rel="noopener noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="absolute bottom-0 bg-white/85 px-1.5 py-0.5 text-[10px] text-[#334155]"
          style={{ right: 0 }}
        >
          {source.attribution}
        </a>
      </div>
      <p id="pin-picker-help" className="text-xs text-ink-muted">
        {t.publicProfile.mapPickerHelp}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <button type="button" onClick={locate} disabled={locating} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          <LocateFixed size={16} aria-hidden="true" />
          {locating ? t.publicProfile.locating : t.publicProfile.useMyLocation}
        </button>
        {value && (
          <button type="button" onClick={() => { onChange(null); setLatText(""); setLngText(""); }} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            {t.publicProfile.clearPin}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label={t.publicProfile.latitude} value={latText} onChange={setLatText} onBlur={commitText} inputMode="decimal" dir="ltr" error={textInvalid ? t.publicProfile.coordsInvalid : null} />
        <TextField label={t.publicProfile.longitude} value={lngText} onChange={setLngText} onBlur={commitText} inputMode="decimal" dir="ltr" />
      </div>
    </div>
  );
}

export default PinPicker;
