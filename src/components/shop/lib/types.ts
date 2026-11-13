/** Public shop profile data shapes (WS-1A). Only anon-readable columns. */

export interface WorkingHourRow {
  barber_id?: string;
  day_of_week: number; // 0 = Sunday … 6 = Saturday
  is_working: boolean | null;
  start_time: string;
  end_time: string;
}

export interface ShopData {
  id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  description_ar: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  google_maps_url: string | null;
  currency: string | null;
  timezone: string | null;
  cancellation_policy_hours: number | null;
  slug: string | null;
  slug_ar: string | null;
  lat: number | null;
  lng: number | null;
  landmark_en: string | null;
  landmark_ar: string | null;
  city_id: string | null;
  area_id: string | null;
  is_published: boolean;
  marketplace_visible: boolean;
  is_verified: boolean;
  cover_url: string | null;
  logo_url: string | null;
}

export interface PlaceName {
  name_en: string;
  name_ar: string;
}

export interface ServiceData {
  id: string;
  name: string;
  name_ar: string | null;
  duration: number;
  price: number;
  category_id: string | null;
}

export interface ServiceCategory {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  sort: number;
}

export interface ReviewData {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
}

export interface BarberData {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role?: string | null;
  handle: string | null;
  title_en: string | null;
  title_ar: string | null;
  bio_en: string | null;
  bio_ar: string | null;
  languages: string[];
  years_experience: number | null;
  is_public: boolean;
  rating_avg: number | null;
  rating_count: number;
}

export interface ShopPhoto {
  id: string;
  path: string;
  url: string;
  sort_order: number;
  alt_en: string | null;
  alt_ar: string | null;
  width: number | null;
  height: number | null;
  blur_data: string | null;
}

export interface PortfolioItem {
  id: string;
  barber_id: string | null;
  service_id: string | null;
  path: string;
  url: string;
  caption: string | null;
  caption_ar: string | null;
  sort_order: number;
  is_featured: boolean;
  blur_data: string | null;
}

export interface Amenity {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  icon: string | null;
  sort: number;
}

export interface ShopProfileData {
  shop: ShopData;
  city: PlaceName | null;
  area: PlaceName | null;
  services: ServiceData[];
  categories: ServiceCategory[];
  reviews: ReviewData[];
  /** Every rating for the shop (capped), for the average + distribution. */
  ratings: number[];
  barbers: BarberData[];
  hours: WorkingHourRow[];
  photos: ShopPhoto[];
  portfolio: PortfolioItem[];
  amenities: Amenity[];
  /** True when the shop is unpublished and the viewer is its staff. */
  preview: boolean;
}

export type ShopProfileResult =
  | { status: "ok"; data: ShopProfileData }
  | { status: "not_found" }
  | { status: "error" };
