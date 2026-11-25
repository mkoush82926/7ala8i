/**
 * Opt-in database test for WS-1I: applies the admin migration and
 * admin_rpc.test.sql inside a transaction that is always rolled back, then
 * checks the success marker. It asserts that every admin write produces one
 * audit row, non-platform users are refused and hidden reviews vanish for anon.
 *
 *   ADMIN_DB_TEST=1 npx vitest run src/lib/admin/admin-db.test.ts
 *
 * Needs the local Supabase stack (docker container named *supabase_db*).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const enabled = process.env.ADMIN_DB_TEST === "1";

function dbContainer(): string | null {
  try {
    const names = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" });
    return names.split("\n").find((n) => n.includes("supabase_db")) ?? null;
  } catch {
    return null;
  }
}

describe.skipIf(!enabled)("admin RPCs (database)", () => {
  it("audits every admin write and rolls back cleanly", () => {
    const container = dbContainer();
    expect(container, "local supabase_db container").toBeTruthy();
    const root = resolve(__dirname, "../../..");
    const sql = [
      "BEGIN;",
      readFileSync(resolve(root, "supabase/migrations/20250101002800_admin.sql"), "utf8"),
      readFileSync(resolve(__dirname, "admin_rpc.test.sql"), "utf8"),
      "ROLLBACK;",
    ].join("\n");
    const out = execFileSync(
      "docker",
      ["exec", "-i", container as string, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
      { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 },
    );
    expect(out).toContain("ADMIN_SQL_TESTS_OK");
  }, 60_000);
});
