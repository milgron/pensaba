#!/usr/bin/env bash
# Runs the RLS / rate-limit test suite against a throwaway Postgres in Docker.
#
#   supabase/tests/run.sh                 # uses the official Supabase Postgres image
#   PG_IMAGE=postgres:16-alpine supabase/tests/run.sh   # plain Postgres + stub
#
# Exit code is non-zero if any test fails.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$HERE/../migrations"
PG_IMAGE="${PG_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.166}"
NAME="pensaba-rls-test-$$"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres "$PG_IMAGE" >/dev/null

psql_in() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "waiting for postgres ($PG_IMAGE)..."
# The Supabase image restarts once after init, so require several
# consecutive successful connections before proceeding.
OK=0
for i in $(seq 1 120); do
  if psql_in -c 'select 1' >/dev/null 2>&1; then OK=$((OK + 1)); else OK=0; fi
  [ "$OK" -ge 4 ] && break
  sleep 1
  [ "$i" = 120 ] && { echo "postgres did not start"; docker logs "$NAME" | tail -20; exit 1; }
done

if ! psql_in -tAc "select 1 from pg_roles where rolname = 'authenticated'" | grep -q 1; then
  echo "plain postgres detected: loading supabase stub"
  psql_in < "$HERE/stub-supabase.sql"
fi

for f in "$MIGRATIONS"/*.sql; do
  echo "applying $(basename "$f")"
  psql_in < "$f"
done

psql_in < "$HERE/helpers.sql"
echo "running tests"
psql_in < "$HERE/rls.test.sql" 2>&1 | sed -n 's/^NOTICE:  //p'

FAILED=$(psql_in -tAc "select count(*) from test.results where not passed")
TOTAL=$(psql_in -tAc "select count(*) from test.results")
echo "---"
echo "$((TOTAL - FAILED))/$TOTAL passed"
[ "$FAILED" = 0 ]
