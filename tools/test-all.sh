#!/bin/bash
# Run every test, in parallel. Exit code 0 = all passed, 1 = something failed.
#
#   bash tools/test-all.sh               # everything (about 1–2 minutes)
#   bash tools/test-all.sh --no-browser  # only the Node tests (a few seconds)
#   bash tools/test-all.sh -g goals      # Node tests + browser tests whose name matches "goals"
#
# Three groups run at the same time:
#   1. tools/run-tests.mjs   syntax, files, packs, balance, headless play-test, API limits
#   2. tests/unit            game rules, save/load, tutorial, every pack's content (node --test)
#   3. tests/e2e             the game in a real browser (Playwright, several workers)
# Tests for bugs listed in tests/helpers/known-bugs.mjs are reported but do not fail the run.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BROWSER=1
if [ "${1:-}" = "--no-browser" ]; then BROWSER=0; shift; fi
LOGS="$(mktemp -d)"

if [ "$BROWSER" = 1 ]; then
  # First run on a machine: install the test tools and the browser
  if [ ! -d node_modules/@playwright/test ]; then
    echo "Installing test tools (first run)…"
    npm install --no-audit --no-fund --loglevel=error || exit 1
  fi
  node --input-type=module -e "import { chromium } from '@playwright/test'; import fs from 'node:fs'; process.exit(fs.existsSync(chromium.executablePath()) ? 0 : 1)" \
    || npx playwright install chromium || exit 1
fi

START=$(date +%s)
node tools/run-tests.mjs > "$LOGS/checks.log" 2>&1 & P1=$!
node --test tests/unit/*.test.mjs > "$LOGS/unit.log" 2>&1 & P2=$!
if [ "$BROWSER" = 1 ]; then
  CI=1 npx playwright test --reporter=line "$@" > "$LOGS/e2e.log" 2>&1 & P3=$!
fi

wait $P1; C1=$?
wait $P2; C2=$?
C3=0
if [ "$BROWSER" = 1 ]; then wait $P3; C3=$?; fi

status() { [ "$1" = 0 ] && echo "PASS" || echo "FAIL"; }
echo
echo "── 1. Checks (tools/run-tests.mjs): $(status $C1)"
if [ $C1 = 0 ]; then tail -1 "$LOGS/checks.log"; else grep -E "✗|→" "$LOGS/checks.log"; fi
echo "── 2. Unit tests (tests/unit): $(status $C2)"
grep -E "^# (pass|fail|skipped)" "$LOGS/unit.log" | tr '\n' ' '; echo
[ $C2 = 0 ] || grep -E "^not ok|error:|expected|actual" "$LOGS/unit.log" | head -40
if [ "$BROWSER" = 1 ]; then
  echo "── 3. Browser tests (tests/e2e): $(status $C3)"
  grep -E "^\s+[0-9]+ (passed|failed|skipped|flaky)" "$LOGS/e2e.log" | tr -s ' ' | tr '\n' ' '; echo
  [ $C3 = 0 ] || grep -vE "^\s*$" "$LOGS/e2e.log" | grep -E "✘|›|Error|Expected|Received|failed" | head -60
  [ $C3 = 0 ] || echo "   Full report: npx playwright show-report  (screenshots and traces of each failure)"
else
  echo "── 3. Browser tests: skipped (--no-browser)"
fi

FIXED=$(cat "$LOGS"/*.log | grep -o 'FIXED: known bug "[^"]*"' | sort -u)
OPEN=$(cat "$LOGS"/*.log | grep -o '\[bug: [a-z0-9-]*\]' | sort -u | wc -l | tr -d ' ')
echo
if [ -n "$FIXED" ]; then echo "✨ Now passing, remove from tests/helpers/known-bugs.mjs:"; echo "$FIXED" | sed 's/^/   /'; fi
SKIPPED=$(cat "$LOGS"/*.log | grep -c "known bug, not fixed yet" || true)
[ "$SKIPPED" -gt 0 ] && echo "🐞 $SKIPPED known-bug test(s) still failing (allowed, see tests/helpers/known-bugs.mjs)"

echo "Took $(( $(date +%s) - START ))s. Logs: $LOGS"
if [ $C1 != 0 ] || [ $C2 != 0 ] || [ $C3 != 0 ]; then
  echo "❌ TESTS FAILED"
  exit 1
fi
echo "✅ ALL TESTS PASSED"
