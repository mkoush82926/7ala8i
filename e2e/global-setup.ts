import fs from "node:fs";
import path from "node:path";
import { seedE2E } from "../scripts/seed-e2e.mjs";

// Runs once before the whole suite: seeds the local Supabase instance
// (started separately via `npm run db:start` + `npm run db:reset`) and
// writes the resulting fixture data (shop id, seeded service name, user
// credentials) to a file specs can read without each re-running the seed.
export default async function globalSetup() {
  const seeded = await seedE2E();
  fs.writeFileSync(
    path.join(__dirname, ".seed-data.json"),
    JSON.stringify(seeded, null, 2),
  );
}
