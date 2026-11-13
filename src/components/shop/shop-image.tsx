"use client";

import React from "react";
import Image, { type ImageProps } from "next/image";
import { isOptimizableUrl } from "./lib/media";

/**
 * next/image for shop media: optimised for Supabase Storage URLs, passed
 * through for anything else (mock data, OAuth avatars), lazy by default, with
 * the stored blur placeholder when there is one.
 */
export function ShopImage({
  src,
  blurData,
  alt,
  priority,
  ...rest
}: Omit<ImageProps, "src" | "placeholder" | "blurDataURL"> & { src: string; blurData?: string | null }) {
  const blur = blurData && blurData.startsWith("data:image/") ? blurData : null;
  return (
    <Image
      src={src}
      alt={alt}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      unoptimized={!isOptimizableUrl(src)}
      placeholder={blur ? "blur" : "empty"}
      blurDataURL={blur ?? undefined}
      {...rest}
    />
  );
}

export default ShopImage;
