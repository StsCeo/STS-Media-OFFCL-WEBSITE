#!/usr/bin/env bash
# Verify Day 1 migrations and RLS on a disposable local Supabase stack.
# Never prints environment values, connection strings, cookies, or keys.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

pass() { printf 'PASS %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; exit 1; }

echo "Day 1 local Supabase verification"
echo "Target: disposable local stack from supabase/config.toml (project_id sts-media)"
echo "This script will not link, push, or migrate a hosted project."

if ! command -v docker >/dev/null 2>&1 && ! command -v podman >/dev/null 2>&1; then
  fail "missing prerequisite: Docker Desktop or Podman on PATH"
fi

if command -v docker >/dev/null 2>&1; then
  docker info >/dev/null 2>&1 || fail "Docker is installed but the engine is not running"
elif command -v podman >/dev/null 2>&1; then
  podman info >/dev/null 2>&1 || fail "Podman is installed but the engine is not running"
fi

if ! command -v npx >/dev/null 2>&1; then
  fail "missing prerequisite: npx"
fi

if [[ ! -f supabase/config.toml ]]; then
  fail "missing supabase/config.toml"
fi

if grep -q 'project_id = "sts-media"' supabase/config.toml; then
  pass "local config.toml is present and project-scoped"
else
  fail "supabase/config.toml is not the local sts-media project"
fi

echo "Starting local Supabase (this uses Docker; first run downloads images)..."
npx --yes supabase start >/dev/null

echo "Resetting the local database and applying every timestamped migration, including legacy init.sql..."
npx --yes supabase db reset --yes >/dev/null

echo "Confirming migration filenames in timestamp order..."
mapfile -t MIGRATIONS < <(ls -1 supabase/migrations/*.sql)
EXPECTED=(
  "supabase/migrations/20260911120000_init.sql"
  "supabase/migrations/20260912060000_phase1_owner_os.sql"
  "supabase/migrations/20260918134000_business_os_org_foundation.sql"
  "supabase/migrations/20260919033000_day1_audit_result_and_rls_hardening.sql"
  "supabase/migrations/20260919041000_day1_settings_save_transaction.sql"
  "supabase/migrations/20260919053000_day1_legacy_init_compat_and_rpc_guards.sql"
)
if [[ "${#MIGRATIONS[@]}" -ne "${#EXPECTED[@]}" ]]; then
  fail "unexpected migration count: ${#MIGRATIONS[@]} (expected ${#EXPECTED[@]})"
fi
for i in "${!EXPECTED[@]}"; do
  if [[ "${MIGRATIONS[$i]}" != "${EXPECTED[$i]}" ]]; then
    fail "migration order mismatch at index $i"
  fi
done
pass "six migrations present in timestamp order (init.sql is first and is applied)"

echo "Running authenticated/anonymous isolation SQL (not as proof via superuser)..."
if ! docker ps --format '{{.Names}}' | grep -q '^supabase_db_sts-media$'; then
  fail "local supabase_db_sts-media container is not running"
fi
docker cp supabase/tests/day1_isolation_runtime.sql supabase_db_sts-media:/tmp/day1_isolation_runtime.sql >/dev/null
if ! docker exec supabase_db_sts-media psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/day1_isolation_runtime.sql >/tmp/sts-day1-isolation.out 2>&1; then
  python3 - <<'PY'
from pathlib import Path
p = Path("/tmp/sts-day1-isolation.out")
text = p.read_text(errors="replace") if p.exists() else ""
for line in text.splitlines()[-40:]:
    low = line.lower()
    if any(s in low for s in ("password=", "apikey", "service_role_key", "jwt secret")):
        print("[redacted]")
    else:
        print(line[:400])
PY
  fail "day1_isolation_runtime.sql"
fi
if grep -q 'DAY1_ISOLATION_RUNTIME_PASSED' /tmp/sts-day1-isolation.out; then
  pass "day1_isolation_runtime.sql finished without error"
else
  fail "isolation SQL did not report DAY1_ISOLATION_RUNTIME_PASSED"
fi

echo
echo "Next (on this same local stack, not production):"
echo "1. Copy local URL and key names from 'npx supabase status' into .env.local yourself."
echo "2. Do not paste those values into chat."
echo "3. In Studio, create a local Auth user for the allowlisted owner mailbox and set your own password."
echo "4. That local user gets a new UUID. Do not treat it as the production owner UUID."
echo "5. Restart Next.js, sign in, save Business Settings, restart Node, and confirm the audit row remains."
echo
echo "DAY1_LOCAL_SUPABASE_VERIFY_PASSED"
