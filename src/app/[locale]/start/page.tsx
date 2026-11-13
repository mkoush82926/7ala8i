import type { Metadata } from "next";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { MOCK_DATA_ENABLED } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingState } from "./_lib/wizard";
import { StartWizard, type CityOption, type AreaOption } from "./_components/start-wizard";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = locale === "ar" ? ar : en;
  return {
    title: t.start.metaTitle,
    description: t.start.metaDescription,
    robots: { index: true, follow: true },
    openGraph: { title: t.start.metaTitle, description: t.start.metaDescription, type: "website" },
  };
}

// Per-user state: never cache.
export const dynamic = "force-dynamic";

interface LoadResult {
  signedIn: boolean;
  state: OnboardingState | null;
  loadError: boolean;
  cities: CityOption[];
  areas: AreaOption[];
}

async function load(): Promise<LoadResult> {
  const empty: LoadResult = { signedIn: false, state: null, loadError: false, cities: [], areas: [] };
  if (MOCK_DATA_ENABLED) return empty;
  try {
    const supabase = await createClient();
    const [{ data: userData }, cities, areas] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("cities").select("id, slug_en, name_en, name_ar, lat, lng").order("sort"),
      supabase.from("areas").select("id, city_id, name_en, name_ar, lat, lng").order("sort"),
    ]);
    const result: LoadResult = {
      ...empty,
      cities: (cities.data as CityOption[] | null) ?? [],
      areas: (areas.data as AreaOption[] | null) ?? [],
    };
    if (!userData.user) return result;

    result.signedIn = true;
    const rpc = supabase as unknown as {
      rpc: (fn: "get_onboarding_state") => PromiseLike<{ data: unknown; error: unknown }>;
    };
    const { data, error } = await rpc.rpc("get_onboarding_state");
    if (error) return { ...result, loadError: true };
    result.state = (data as OnboardingState | null) ?? null;
    return result;
  } catch {
    return { ...empty, loadError: true };
  }
}

export default async function StartPage() {
  const { signedIn, state, loadError, cities, areas } = await load();
  return (
    <StartWizard
      signedIn={signedIn}
      initialState={state}
      loadError={loadError}
      cities={cities}
      areas={areas}
      phoneAuth={process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true"}
    />
  );
}
