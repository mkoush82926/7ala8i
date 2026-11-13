#!/usr/bin/env bash
# Rehearse the production go-live (`supabase migration repair` + `supabase db push
# --include-all`) against a LOCAL copy of production.
#
#   scripts/rehearse-prod-upgrade.sh <backup-dir>
#
# <backup-dir> must contain schema.sql (public schema, from `supabase db dump`)
# and data.sql (data-only dump, from `supabase db dump --data-only`).
#
# What it does (LOCAL Supabase stack only — never touches the linked project):
#   1. `supabase db reset --local` so the local Supabase base schemas (auth,
#      storage, realtime, ...) are fresh and intact.
#   2. Drops and recreates the public schema with the standard Supabase grants,
#      empties auth.users, then loads schema.sql + data.sql. The result is the
#      production state BEFORE the upgrade.
#   3. Creates stub auth.users rows for any user id referenced from public
#      tables that the data dump did not contain, so FKs hold.
#   4. Records per-table row counts.
#   5. Applies every supabase/migrations/*.sql in filename order, each in its
#      own transaction (psql --single-transaction -v ON_ERROR_STOP=1), the same
#      way `supabase db push` does; stops at the first failure.
#   6. Prints row counts again, side by side with the "before" counts.
#
# Never run this against production. It talks to the local supabase_db
# container through `docker exec` only.
set -euo pipefail

BACKUP_DIR="${1:-}"
if [[ -z "$BACKUP_DIR" || ! -f "$BACKUP_DIR/schema.sql" || ! -f "$BACKUP_DIR/data.sql" ]]; then
  echo "usage: $0 <backup-dir containing schema.sql and data.sql>" >&2
  exit 2
fi
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep supabase_db | head -n1 || true)"
if [[ -z "$DB_CONTAINER" ]]; then
  echo "No running local supabase_db container. Run 'npx supabase start' first." >&2
  exit 1
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/rehearse-prod.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

# psql as postgres (the role `supabase db push` uses) / as supabase_admin
# (superuser, needed for session_replication_role).
psql_pg()    { docker exec -i "$DB_CONTAINER" psql -U postgres       -X -q -v ON_ERROR_STOP=1 "$@"; }
# The local stack's default superuser password is "postgres" (local only).
LOCAL_DB_PASSWORD="${LOCAL_DB_PASSWORD:-postgres}"
psql_admin() { docker exec -i -e PGPASSWORD="$LOCAL_DB_PASSWORD" "$DB_CONTAINER" psql -U supabase_admin -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

row_counts() {
  psql_admin -At -F $'\t' <<'SQL'
CREATE TEMP TABLE _rc(tbl text, n bigint);
DO $$
DECLARE r record; v bigint;
BEGIN
  FOR r IN SELECT schemaname, tablename FROM pg_tables
           WHERE schemaname IN ('public') OR (schemaname = 'auth' AND tablename IN ('users','identities'))
           ORDER BY 1, 2 LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I', r.schemaname, r.tablename) INTO v;
    INSERT INTO _rc VALUES (r.schemaname || '.' || r.tablename, v);
  END LOOP;
END $$;
SELECT tbl, n FROM _rc ORDER BY tbl;
SQL
}

echo "==> [1/6] Resetting local database (supabase db reset --local)"
npx supabase db reset --local >"$WORK/reset.log" 2>&1 || { cat "$WORK/reset.log"; exit 1; }

echo "==> [2/6] Recreating public schema and loading production schema dump"
psql_admin <<'SQL'
SET client_min_messages = warning;
DROP SCHEMA public CASCADE;
CREATE SCHEMA public AUTHORIZATION pg_database_owner;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres;
-- Supabase-platform default privileges (as on a hosted project).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES    TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
-- Local seed users must not leak into the prod copy.
TRUNCATE auth.users CASCADE;
SQL
# The dump's leading role-setting lines (ALTER ROLE ... statement_timeout) are
# cluster-wide settings; skip them so the local roles stay untouched.
sed -e '/^ALTER ROLE /d' "$BACKUP_DIR/schema.sql" > "$WORK/schema.sql"
psql_pg -d postgres < "$WORK/schema.sql" >"$WORK/schema.log" 2>&1 || { cat "$WORK/schema.log"; exit 1; }

# The dump is public-only, so prod's auth.users trigger (on_auth_user_created
# -> public.handle_new_user) disappeared with DROP SCHEMA ... CASCADE.
# Recreate it like prod has it.
psql_admin <<'SQL'
SET client_min_messages = warning;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
SQL

echo "==> [3/6] Loading production data (session_replication_role=replica)"
# Keep only auth.users / auth.identities from the auth schema; sessions, refresh
# tokens, flow state etc. are irrelevant to the rehearsal (and may not match the
# local auth schema version). Statements are pg_dump --inserts blocks that
# start with 'INSERT INTO "schema"."table"' and end with a line ending in ');'.
awk '
  /^INSERT INTO "/ {
    split($3, p, ".");
    gsub(/"/, "", p[1]); gsub(/"/, "", p[2]);
    keep = (p[1] == "public") || (p[1] == "auth" && (p[2] == "users" || p[2] == "identities"));
    inins = 1;
  }
  !inins { if ($0 !~ /^SELECT pg_catalog.setval\(.\"auth\"/) print; next }
  inins  { if (keep) print; if ($0 ~ /\);$/) inins = 0; next }
' "$BACKUP_DIR/data.sql" > "$WORK/data.sql"
{
  echo 'BEGIN;'
  echo 'SET session_replication_role = replica;'
  cat "$WORK/data.sql"
  cat <<'SQL'
SET search_path = public, auth;
SET session_replication_role = replica;
-- Stub auth.users for every user id referenced from public that the dump
-- did not contain (FKs are not checked under replica, so fix them up here).
INSERT INTO auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       'stub+' || u.id || '@rehearsal.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()
FROM (
  SELECT id FROM public.profiles
  UNION SELECT user_id FROM public.notifications
) u
WHERE u.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users x WHERE x.id = u.id);
SET session_replication_role = origin;
COMMIT;
SQL
} > "$WORK/data-load.sql"
psql_admin < "$WORK/data-load.sql" >"$WORK/data.log" 2>&1 || { cat "$WORK/data.log"; exit 1; }
STUBS="$(psql_admin -At -c "select count(*) from auth.users where email like 'stub+%@rehearsal.invalid'")"
echo "    stub auth.users created: $STUBS"

# Verify the FKs that matter now hold.
FK_ORPHANS="$(psql_admin -At <<'SQL'
SELECT 'profiles.id->auth.users', count(*) FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
UNION ALL SELECT 'notifications.user_id->auth.users', count(*) FROM public.notifications n WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = n.user_id)
UNION ALL SELECT 'profiles.shop_id->shops', count(*) FROM public.profiles p WHERE p.shop_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = p.shop_id)
UNION ALL SELECT 'appointments.barber_id->profiles', count(*) FROM public.appointments a WHERE a.barber_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = a.barber_id)
UNION ALL SELECT 'appointments.client_id->clients', count(*) FROM public.appointments a WHERE a.client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = a.client_id)
UNION ALL SELECT 'reviews.client_id->clients', count(*) FROM public.reviews r WHERE NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = r.client_id);
SQL
)"
echo "$FK_ORPHANS" | awk -F'|' '$2 != 0 { print "    WARNING orphaned FK rows: " $1 " = " $2 }'

echo "    pre-upgrade public tables: $(psql_admin -At -c "select string_agg(tablename, ', ' order by tablename) from pg_tables where schemaname='public'")"

echo "==> [4/6] Row counts BEFORE upgrade"
row_counts > "$WORK/before.tsv"
column -t -s $'\t' "$WORK/before.tsv" | sed 's/^/    /'

# Snapshot pre-upgrade public data (separate schema, local only) so the
# report at the end can list every changed/removed row by column.
psql_admin <<'SQL'
SET client_min_messages = warning;
DROP SCHEMA IF EXISTS rehearsal_before CASCADE;
CREATE SCHEMA rehearsal_before;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('CREATE TABLE rehearsal_before.%I AS SELECT * FROM public.%I', r.tablename, r.tablename);
  END LOOP;
END $$;
SQL

echo "==> [5/6] Applying supabase/migrations/*.sql in order (one transaction each)"
shopt -s nullglob
MIGRATIONS=(supabase/migrations/*.sql)
for f in "${MIGRATIONS[@]}"; do
  printf '    %-70s ' "$(basename "$f")"
  if docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -X -q \
        -v ON_ERROR_STOP=1 --single-transaction < "$f" >"$WORK/mig.log" 2>&1; then
    echo "ok"
    grep -E 'NOTICE|WARNING' "$WORK/mig.log" | grep -v 'does not exist, skipping' | sed 's/^/        /' || true
  else
    echo "FAILED"
    sed 's/^/        /' "$WORK/mig.log"
    echo
    echo "REHEARSAL FAILED at $(basename "$f")" >&2
    exit 1
  fi
done

echo "==> Post-upgrade invariants"
# The double-booking guard must exist and actually reject a new overlap
# (checked inside a rolled-back transaction, so nothing is left behind).
psql_admin <<'SQL' 2>&1 | sed 's/^/    /'
DO $$
DECLARE v_def text; a record; v_ok boolean := false;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_def FROM pg_constraint c
  WHERE c.conname = 'appointments_no_overlap' AND c.conrelid = 'public.appointments'::regclass;
  IF v_def IS NULL THEN RAISE EXCEPTION 'appointments_no_overlap is MISSING'; END IF;
  RAISE NOTICE 'appointments_no_overlap: %', v_def;
  SELECT * INTO a FROM public.appointments WHERE barber_id IS NOT NULL LIMIT 1;
  IF FOUND THEN
    BEGIN
      INSERT INTO public.appointments (shop_id, barber_id, client_name, start_time, end_time, status)
      VALUES (a.shop_id, a.barber_id, 'rehearsal-overlap-a', now() + interval '400 days', now() + interval '400 days 30 min', 'pending');
      INSERT INTO public.appointments (shop_id, barber_id, client_name, start_time, end_time, status)
      VALUES (a.shop_id, a.barber_id, 'rehearsal-overlap-b', now() + interval '400 days 10 min', now() + interval '400 days 40 min', 'confirmed');
    EXCEPTION WHEN exclusion_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'overlapping staff INSERT was NOT rejected'; END IF;
    RAISE NOTICE 'overlapping INSERT rejected with 23P01 (ok)';
  END IF;
END $$;
SQL

echo "==> [6/6] Row counts AFTER upgrade (before -> after)"
row_counts > "$WORK/after.tsv"
join -a1 -a2 -e '-' -o 0,1.2,2.2 -t $'\t' <(sort "$WORK/before.tsv") <(sort "$WORK/after.tsv") \
  | awk -F'\t' '{ flag = ($2 != $3) ? "  <-- changed" : ""; printf "    %-28s %8s -> %-8s%s\n", $1, $2, $3, flag }'

echo
echo "    Data changes in pre-existing tables (rows matched by id, common columns):"
psql_admin -At -F $'\t' <<'SQL' | sed 's/^/      /'
CREATE TEMP TABLE _chg(tbl text, kind text, col text, n bigint);
DO $$
DECLARE r record; c record; n bigint;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'rehearsal_before' ORDER BY 1 LOOP
    IF to_regclass('public.' || quote_ident(r.tablename)) IS NULL THEN
      EXECUTE format('SELECT count(*) FROM rehearsal_before.%I', r.tablename) INTO n;
      INSERT INTO _chg VALUES (r.tablename, 'TABLE DROPPED', '', n);
      CONTINUE;
    END IF;
    EXECUTE format('SELECT count(*) FROM rehearsal_before.%1$I b WHERE NOT EXISTS (SELECT 1 FROM public.%1$I a WHERE a.id = b.id)', r.tablename) INTO n;
    IF n > 0 THEN INSERT INTO _chg VALUES (r.tablename, 'rows removed', '', n); END IF;
    FOR c IN SELECT b.column_name FROM information_schema.columns b
             WHERE b.table_schema = 'rehearsal_before' AND b.table_name = r.tablename
             ORDER BY b.ordinal_position LOOP
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns a
                     WHERE a.table_schema = 'public' AND a.table_name = r.tablename AND a.column_name = c.column_name) THEN
        INSERT INTO _chg VALUES (r.tablename, 'column dropped', c.column_name, NULL);
        CONTINUE;
      END IF;
      EXECUTE format('SELECT count(*) FROM rehearsal_before.%1$I b JOIN public.%1$I a ON a.id = b.id
                      WHERE a.%2$I::text IS DISTINCT FROM b.%2$I::text', r.tablename, c.column_name) INTO n;
      IF n > 0 THEN INSERT INTO _chg VALUES (r.tablename, 'values changed', c.column_name, n); END IF;
    END LOOP;
  END LOOP;
END $$;
SELECT tbl, kind, col, coalesce(n::text, '') FROM _chg ORDER BY 1, 2, 3;
SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM _chg) THEN '(none)' END WHERE NOT EXISTS (SELECT 1 FROM _chg);
SQL
psql_admin -c 'DROP SCHEMA rehearsal_before CASCADE' >/dev/null 2>&1 || true

echo
echo "REHEARSAL PASSED: all ${#MIGRATIONS[@]} migrations applied on top of the production copy."
