#!/usr/bin/env bash
# One-time reconciliation of the Supabase migration ledger.
#
# Background: every migration in supabase/migrations/ was applied manually via
# the Supabase SQL editor, so the schema_migrations ledger is empty while the
# DB is fully migrated. Running `supabase db push` today would try to re-run
# everything and fail on non-idempotent statements.
#
# This script marks every on-disk migration as `applied` in the ledger so the
# CLI and DB agree. Safe to re-run — `migration repair` is idempotent.
#
# Prereqs:
#   supabase login
#   supabase link --project-ref knwdjeicyisqsfiisaic
#
# Usage:
#   ./scripts/repair-migrations.sh

set -euo pipefail

MIGRATIONS_DIR="$(cd "$(dirname "$0")/.." && pwd)/supabase/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

VERSIONS=()
for f in "$MIGRATIONS_DIR"/*.sql; do
  name="$(basename "$f" .sql)"
  version="${name%%_*}"
  VERSIONS+=("$version")
done

echo "Marking ${#VERSIONS[@]} migrations as applied…"
supabase migration repair --status applied "${VERSIONS[@]}"
echo "Done. Verify with: supabase migration list"
