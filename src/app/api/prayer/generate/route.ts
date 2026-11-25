import { handlePrayerGenerate } from "@/lib/prayer/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** See handlePrayerGenerate (src/lib/prayer/cron.ts). */
export const GET = handlePrayerGenerate;
export const POST = handlePrayerGenerate;
