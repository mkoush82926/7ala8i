#!/usr/bin/env bash
# Runs the WS-P0V availability SQL tests against the local Supabase DB inside
# one transaction that is always rolled back (safe on the shared database).
# Applies 20250101001950_availability_engine.sql first (inside the same
# transaction) unless it is already applied.
#   usage: supabase/tests/availability/run.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
DB="${SUPABASE_DB_CONTAINER:-$(docker ps --format '{{.Names}}' | grep supabase_db | head -n1)}"
MIGRATION="$ROOT/supabase/migrations/20250101001950_availability_engine.sql"

APPLIED=$(docker exec -i "$DB" psql -U postgres -At -c \
  "select count(*) from supabase_migrations.schema_migrations where version = '20250101001950'" 2>/dev/null || echo 0)

{
  echo '\set ON_ERROR_STOP 1'
  echo 'BEGIN;'
  if [ "$APPLIED" != "1" ]; then cat "$MIGRATION"; fi
  cat "$HERE/availability_engine.test.sql"
  echo "SAVEPOINT cpb;"
  cat "$HERE/create_public_booking.test.sql"
  echo 'ROLLBACK;'
} | docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -q -o /dev/null 2>&1 | grep -v '^NOTICE:  \(trigger\|policy\|relation\|constraint\) .* does not exist, skipping$'
