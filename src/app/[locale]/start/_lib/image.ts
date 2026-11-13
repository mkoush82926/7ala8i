// Browser-only: turns a picked photo into a small square avatar data URL.
// Until the 1A `shop-media` bucket exists, barber photos travel inline
// (≈10–20 KB each); create_shop_from_wizard accepts data:image URLs up to
// 120 000 characters.

export const AVATAR_SIZE = 160;
export const MAX_AVATAR_CHARS = 110_000;
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export class AvatarError extends Error {
  constructor(public code: "notImage" | "tooLarge" | "decode") {
    super(code);
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AvatarError("decode"));
    };
    img.src = url;
  });
}

/** Centre-crops to a square and encodes as JPEG, lowering quality until it fits. */
export async function fileToAvatar(file: File, size = AVATAR_SIZE): Promise<string> {
  if (!file.type.startsWith("image/")) throw new AvatarError("notImage");
  if (file.size > MAX_SOURCE_BYTES) throw new AvatarError("tooLarge");
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (!side) throw new AvatarError("decode");
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AvatarError("decode");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    (img.naturalWidth - side) / 2,
    (img.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= MAX_AVATAR_CHARS) return url;
  }
  throw new AvatarError("tooLarge");
}
