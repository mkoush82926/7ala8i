/**
 * Static raster-tile maps without a map library: Web Mercator tile maths, a
 * tile grid for a fixed-size viewport, pixel ↔ lat/lng for the pin picker,
 * and deep links to Google Maps / Waze.
 *
 * Tiles come from MapTiler when NEXT_PUBLIC_MAPTILER_KEY is set, otherwise
 * from the public OpenStreetMap tile server (fine for low traffic; the
 * attribution is always shown).
 */

export const TILE_SIZE = 256;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 19;
/** Amman (Downtown) — default centre for the pin picker. */
export const AMMAN_CENTER = { lat: 31.9539, lng: 35.9106 } as const;

export interface LatLng {
  lat: number;
  lng: number;
}

const MAX_LAT = 85.05112878;

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return 15;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z)));
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** World pixel coordinates (at `zoom`) for a point. */
export function project({ lat, lng }: LatLng, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** Inverse of {@link project}. */
export function unproject({ x, y }: { x: number; y: number }, zoom: number): LatLng {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng: ((((lng + 180) % 360) + 360) % 360) - 180 };
}

export interface MapTile {
  key: string;
  x: number;
  y: number;
  z: number;
  /** Offset of the tile's top-left corner inside the viewport (px). */
  left: number;
  top: number;
}

/** Tiles covering a width×height viewport centred on `center`. */
export function tilesForViewport(center: LatLng, zoom: number, width: number, height: number): MapTile[] {
  const z = clampZoom(zoom);
  const c = project(center, z);
  const originX = c.x - width / 2;
  const originY = c.y - height / 2;
  const n = 2 ** z;
  const x0 = Math.floor(originX / TILE_SIZE);
  const y0 = Math.floor(originY / TILE_SIZE);
  const x1 = Math.floor((originX + width - 1) / TILE_SIZE);
  const y1 = Math.floor((originY + height - 1) / TILE_SIZE);
  const tiles: MapTile[] = [];
  for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = x0; tx <= x1; tx++) {
      const wrapped = ((tx % n) + n) % n;
      tiles.push({
        key: `${z}/${tx}/${ty}`,
        x: wrapped,
        y: ty,
        z,
        left: Math.round(tx * TILE_SIZE - originX),
        top: Math.round(ty * TILE_SIZE - originY),
      });
    }
  }
  return tiles;
}

/** Lat/lng under viewport pixel (px, py) for a map centred on `center`. */
export function pixelToLatLng(
  center: LatLng,
  zoom: number,
  width: number,
  height: number,
  px: number,
  py: number,
): LatLng {
  const z = clampZoom(zoom);
  const c = project(center, z);
  return unproject({ x: c.x - width / 2 + px, y: c.y - height / 2 + py }, z);
}

/** New centre after dragging the map by (dx, dy) pixels. */
export function panBy(center: LatLng, zoom: number, dx: number, dy: number): LatLng {
  const z = clampZoom(zoom);
  const c = project(center, z);
  return unproject({ x: c.x - dx, y: c.y - dy }, z);
}

export function roundCoord(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

// ─── Tile source ───

export interface TileSource {
  url: (tile: Pick<MapTile, "x" | "y" | "z">) => string;
  attribution: string;
  attributionUrl: string;
}

export function tileSource(maptilerKey?: string | null): TileSource {
  const key = (maptilerKey ?? "").trim();
  if (key && /^[A-Za-z0-9_-]{8,128}$/.test(key)) {
    return {
      url: ({ x, y, z }) => `https://api.maptiler.com/maps/streets-v2/256/${z}/${x}/${y}.png?key=${key}`,
      attribution: "© MapTiler © OpenStreetMap contributors",
      attributionUrl: "https://www.openstreetmap.org/copyright",
    };
  }
  return {
    url: ({ x, y, z }) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    attribution: "© OpenStreetMap contributors",
    attributionUrl: "https://www.openstreetmap.org/copyright",
  };
}

// ─── Deep links ───

export function googleMapsDirectionsUrl(point: LatLng | null, fallbackQuery?: string | null): string | null {
  if (point && isValidLatLng(point.lat, point.lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${roundCoord(point.lat)},${roundCoord(point.lng)}`;
  }
  const q = (fallbackQuery ?? "").trim();
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

export function wazeUrl(point: LatLng | null): string | null {
  if (!point || !isValidLatLng(point.lat, point.lng)) return null;
  return `https://waze.com/ul?ll=${roundCoord(point.lat)},${roundCoord(point.lng)}&navigate=yes`;
}
