#!/usr/bin/env bash
# One-shot production database upgrade for Halaqy.
# Run it yourself in a terminal: it asks for the database password privately
# (never echoed, never written to disk), then:
#   1. backs up production (schema, data, roles)
#   2. rehearses the full upgrade on that backup in the local Supabase stack
#   3. shows a dry run
#   4. applies the migrations only after you type GO
set -euo pipefail

export PATH="/Users/Mohammad/.nvm/versions/node/v24.18.0/bin:$PATH"
cd "$(dirname "$0")/.."
SUPA="npx supabase"

read -r -s -p "Production database password: " SUPABASE_DB_PASSWORD; echo
export SUPABASE_DB_PASSWORD

BACKUP="../prod-backup-golive-$(date +%Y%m%d-%H%M)"
mkdir -p "$BACKUP"
echo "==> 1/4 Backing up production to $BACKUP"
$SUPA db dump --linked -f "$BACKUP/schema.sql"
$SUPA db dump --linked --data-only --use-copy=false -f "$BACKUP/data.sql"
$SUPA db dump --linked --role-only -f "$BACKUP/roles.sql"
ls -la "$BACKUP"

echo "==> 2/4 Rehearsing the upgrade on the fresh backup (local database)"
$SUPA status >/dev/null 2>&1 || $SUPA start -x studio,imgproxy,mailpit,logflare,vector,supavisor
export DB_CONTAINER="supabase_db_$(sed -n 's/^project_id = "\(.*\)"/\1/p' supabase/config.toml)"
bash scripts/rehearse-prod-upgrade.sh "$BACKUP" | tee "$BACKUP/rehearsal.log"
grep -q "REHEARSAL PASSED" "$BACKUP/rehearsal.log" || { echo "Rehearsal failed - production NOT touched."; exit 1; }

echo "==> 3/4 Dry run (only migrations newer than production are applied)"
$SUPA db push --include-all --dry-run

read -r -p "Type GO to apply these migrations to PRODUCTION: " ANSWER
[ "$ANSWER" = "GO" ] || { echo "Stopped before applying. Production schema unchanged."; exit 1; }

echo "==> 4/4 Applying"
$SUPA db push --include-all --yes
$SUPA migration list --linked
unset SUPABASE_DB_PASSWORD
echo "DONE: production database upgraded. Backup kept in $BACKUP"
