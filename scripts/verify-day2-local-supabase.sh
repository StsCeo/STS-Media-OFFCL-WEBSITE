#!/usr/bin/env bash
# Verify Day 2 migrations and RLS on the disposable local Supabase stack.
# Applies pending local migrations. Does not reset. Does not touch production.
# Never prints environment values, connection strings, cookies, or keys.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

pass() { printf 'PASS %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; exit 1; }

echo "Day 2 local Supabase verification"
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

echo "Applying pending local migrations without resetting Auth users..."
if ! npx --yes supabase db push --local >/tmp/sts-day2-db-push.out 2>&1; then
  if ! npx --yes supabase migration up --local >/tmp/sts-day2-db-push.out 2>&1; then
    python3 - <<'PY'
from pathlib import Path
text = Path("/tmp/sts-day2-db-push.out").read_text(errors="replace") if Path("/tmp/sts-day2-db-push.out").exists() else ""
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

EXPECTED_TAIL=(
  "supabase/migrations/20260919120000_day2_membership_owner_gate.sql"
  "supabase/migrations/20260919123000_day2_crm_leads_clients.sql"
)
mapfile -t MIGRATIONS < <(ls -1 supabase/migrations/*.sql)
for file in "${EXPECTED_TAIL[@]}"; do
  if [[ ! -f "$file" ]]; then
    fail "missing $file"
  fi
done
if [[ "${MIGRATIONS[-2]}" != "${EXPECTED_TAIL[0]}" && "${MIGRATIONS[-1]}" != "${EXPECTED_TAIL[1]}" ]]; then
  if printf '%s\n' "${MIGRATIONS[@]}" | grep -q '20260919120000_day2_membership_owner_gate.sql' \
    && printf '%s\n' "${MIGRATIONS[@]}" | grep -q '20260919123000_day2_crm_leads_clients.sql'; then
    pass "Day 2 migrations are present"
  else
    fail "Day 2 migrations are missing from supabase/migrations"
  fi
else
  pass "Day 2 migrations are present"
fi

docker cp supabase/tests/day2_isolation_runtime.sql supabase_db_sts-media:/tmp/day2_isolation_runtime.sql >/dev/null
if ! docker exec supabase_db_sts-media psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/day2_isolation_runtime.sql >/tmp/sts-day2-isolation.out 2>&1; then
  python3 - <<'PY'
from pathlib import Path
p = Path("/tmp/sts-day2-isolation.out")
text = p.read_text(errors="replace") if p.exists() else ""
for line in text.splitlines()[-40:]:
    low = line.lower()
    if any(s in low for s in ("password=", "apikey", "service_role_key", "jwt secret")):
        print("[redacted]")
    else:
        print(line[:400])
PY
  fail "day2_isolation_runtime.sql"
fi
if grep -q 'DAY2_ISOLATION_RUNTIME_PASSED' /tmp/sts-day2-isolation.out; then
  pass "day2_isolation_runtime.sql finished without error"
else
  fail "isolation SQL did not report DAY2_ISOLATION_RUNTIME_PASSED"
fi

echo
echo "DAY2_LOCAL_SUPABASE_VERIFY_PASSED"
