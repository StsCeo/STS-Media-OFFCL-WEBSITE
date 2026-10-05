#!/usr/bin/env bash
# Verify Day 1–10 SQL on the disposable local Supabase stack only.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

pass() { printf 'PASS %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; exit 1; }

if [[ ! -f supabase/config.toml ]]; then
  fail "missing supabase/config.toml"
fi
grep -q 'project_id = "sts-media"' supabase/config.toml || fail "not the local sts-media project"
if ! grep -q '"main": true' vercel.json || ! grep -q '"\*": false' vercel.json; then
  fail "vercel.json git.deploymentEnabled is not main true / other branches false"
fi
pass "vercel.json remains main-only"

DAY9_DB_RESET="${DAY10_DB_RESET:-1}" bash "$ROOT/scripts/verify-day9-local-supabase.sh"

run_sql() {
  local file="$1"
  local marker="$2"
  local out="/tmp/sts-$(basename "$file" .sql).out"
  docker cp "$file" supabase_db_sts-media:/tmp/"$(basename "$file")" >/dev/null
  if ! docker exec supabase_db_sts-media psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/"$(basename "$file")" >"$out" 2>&1; then
    python3 - <<PY
from pathlib import Path
text = Path("$out").read_text(errors="replace") if Path("$out").exists() else ""
for line in text.splitlines()[-40:]:
    print(line[:400])
PY
    fail "$file"
  fi
  grep -q "$marker" "$out" || fail "$file did not report $marker"
  pass "$(basename "$file") finished without error"
}

run_sql supabase/tests/day10_integrity_runtime.sql DAY10_INTEGRITY_RUNTIME_PASSED
echo
echo "DAY10_LOCAL_SUPABASE_VERIFY_PASSED"
