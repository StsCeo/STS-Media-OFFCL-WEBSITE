#!/usr/bin/env bash
# Verify Day 7 schedule/automation migrations and RLS on the disposable local Supabase stack.
# Resets the isolated local database unless DAY7_DB_RESET=0. Does not touch production.
# Never prints environment values, connection strings, cookies, or keys.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

pass() { printf 'PASS %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; exit 1; }

run_sql() {
  local file="$1"
  local marker="$2"
  local out="/tmp/sts-$(basename "$file" .sql).out"
  docker cp "$file" supabase_db_sts-media:/tmp/"$(basename "$file")" >/dev/null
  if ! docker exec supabase_db_sts-media psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/"$(basename "$file")" >"$out" 2>&1; then
    python3 - <<PY
from pathlib import Path
p = Path("$out")
text = p.read_text(errors="replace") if p.exists() else ""
for line in text.splitlines()[-50:]:
    low = line.lower()
    if any(s in low for s in ("password=", "apikey", "service_role_key", "jwt secret")):
        print("[redacted]")
    else:
        print(line[:400])
PY
    fail "$file"
  fi
  if grep -q "$marker" "$out"; then
    pass "$(basename "$file") finished without error"
  else
    fail "$file did not report $marker"
  fi
}

echo "Day 7 local Supabase verification"
echo "Target: disposable local stack from supabase/config.toml (project_id sts-media)"
echo "This script will not link, push, or migrate a hosted project."

if ! command -v docker >/dev/null 2>&1; then
  fail "missing prerequisite: Docker on PATH"
fi
docker info >/dev/null 2>&1 || fail "Docker is installed but the engine is not running"

if [[ ! -f supabase/config.toml ]]; then
  fail "missing supabase/config.toml"
fi
grep -q 'project_id = "sts-media"' supabase/config.toml || fail "supabase/config.toml is not the local sts-media project"

if ! docker ps --format '{{.Names}}' | grep -q '^supabase_db_sts-media$'; then
  echo "Starting local Supabase..."
  npx --yes supabase start >/dev/null
fi

if [[ "${DAY7_DB_RESET:-1}" == "1" ]]; then
  echo "Resetting the isolated local database and applying every timestamped migration..."
  npx --yes supabase db reset --yes >/dev/null
  pass "isolated local database reset"
else
  echo "Applying pending local migrations without resetting Auth users..."
  if ! npx --yes supabase db push --local >/tmp/sts-day7-db-push.out 2>&1; then
    if ! npx --yes supabase migration up --local >/tmp/sts-day7-db-push.out 2>&1; then
      python3 - <<'PY'
from pathlib import Path
text = Path("/tmp/sts-day7-db-push.out").read_text(errors="replace") if Path("/tmp/sts-day7-db-push.out").exists() else ""
for line in text.splitlines()[-20:]:
    low = line.lower()
    if any(s in low for s in ("password=", "apikey", "service_role_key", "jwt secret")):
        print("[redacted]")
    else:
        print(line[:300])
PY
      fail "could not apply pending local migrations"
    fi
  fi
  pass "pending local migrations applied or already present"
fi

EXPECTED=(
  "supabase/migrations/20260920170000_day6_estimate_to_invoice.sql"
  "supabase/migrations/20260920180000_day7_schedule_automations.sql"
  "supabase/migrations/20260920181000_day7_schedule_rpcs.sql"
)
for file in "${EXPECTED[@]}"; do
  if [[ ! -f "$file" ]]; then
    fail "missing $file"
  fi
done
pass "Day 6 and Day 7 migrations are present"

if ! grep -q '"main": true' vercel.json || ! grep -q '"\*": false' vercel.json; then
  fail "vercel.json git.deploymentEnabled is not main true / other branches false"
fi
pass "vercel.json remains main-only for Git deployments"

run_sql supabase/tests/day1_isolation_runtime.sql DAY1_ISOLATION_RUNTIME_PASSED
run_sql supabase/tests/day2_isolation_runtime.sql DAY2_ISOLATION_RUNTIME_PASSED
run_sql supabase/tests/day3_isolation_runtime.sql DAY3_ISOLATION_RUNTIME_PASSED
run_sql supabase/tests/day4_isolation_runtime.sql DAY4_ISOLATION_RUNTIME_PASSED
run_sql supabase/tests/day4_aal2_runtime.sql DAY4_AAL2_RUNTIME_PASSED
run_sql supabase/tests/day5_isolation_runtime.sql DAY5_ISOLATION_RUNTIME_PASSED
run_sql supabase/tests/day6_isolation_runtime.sql DAY6_ISOLATION_RUNTIME_PASSED
run_sql supabase/tests/day7_isolation_runtime.sql DAY7_ISOLATION_RUNTIME_PASSED

echo
echo "DAY7_LOCAL_SUPABASE_VERIFY_PASSED"
