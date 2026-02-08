#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════
#  VERIFY_STEP_11_65.sh — FAZ 3 Docs Verification (Feature Matrix)
#  Doc-only gate: checks required docs + headings + index links
# ═══════════════════════════════════════════════════════════════

PASS=0; FAIL=0
pass() { ((PASS++)); echo "  ✅ $1"; }
fail() { ((FAIL++)); echo "  ❌ $1"; }

ROOT="$(cd "$(dirname "$0")" && pwd)"
DOCS="$ROOT/docs"
FEATURE_DOC="$DOCS/PLAN_FEATURE_MATRIX.md"
INDEX_DOC="$DOCS/PLAN_TIDIO_FREE_PAID_INDEX.md"
FAZ1_DOC="$DOCS/PLAN_FREE_VS_PAID.md"
FAZ2_DOC="$DOCS/PLAN_PACKAGE_ARCHITECTURE.md"

header() { echo ""; echo "── $1 ──"; }

echo "═══ VERIFY_STEP_11_65: FAZ 3 Docs (Feature Matrix) ═══"

header "1) Required files exist and are non-empty"
[ -s "$FAZ1_DOC" ] && pass "PLAN_FREE_VS_PAID.md exists" || fail "Missing PLAN_FREE_VS_PAID.md"
[ -s "$FAZ2_DOC" ] && pass "PLAN_PACKAGE_ARCHITECTURE.md exists" || fail "Missing PLAN_PACKAGE_ARCHITECTURE.md"
[ -s "$FEATURE_DOC" ] && pass "PLAN_FEATURE_MATRIX.md exists" || fail "Missing PLAN_FEATURE_MATRIX.md"
[ -s "$INDEX_DOC" ] && pass "PLAN_TIDIO_FREE_PAID_INDEX.md exists" || fail "Missing PLAN_TIDIO_FREE_PAID_INDEX.md"

header "2) Index links (FAZ 3 done)"
if grep -q "PLAN_FEATURE_MATRIX.md" "$INDEX_DOC" 2>/dev/null; then
  pass "Index links to PLAN_FEATURE_MATRIX.md"
else
  fail "Index missing link to PLAN_FEATURE_MATRIX.md"
fi
if grep -q "FAZ 3" "$INDEX_DOC" 2>/dev/null && grep -q "PLAN_FEATURE_MATRIX.md" "$INDEX_DOC" 2>/dev/null; then
  pass "FAZ 3 marked with doc link"
else
  fail "FAZ 3 not marked with doc link"
fi

header "3) Required sections in PLAN_FEATURE_MATRIX.md"
req_sections=(
  "5 Rules"
  "Definitions: M1/M2/M3"
  "Modules"
  "Feature Matrix"
  "Branding & Domain Allowlist Security"
  "Phase 4 Checklist"
)
for s in "${req_sections[@]}"; do
  if grep -q "$s" "$FEATURE_DOC" 2>/dev/null; then
    pass "Section: $s"
  else
    fail "Missing section: $s"
  fi
done

header "4) Matrix table headers"
if grep -q "Module | Feature | Free | Pro | Growth | Enterprise" "$FEATURE_DOC" 2>/dev/null; then
  pass "Matrix header includes plans"
else
  fail "Matrix header missing plan columns"
fi
if grep -q "Gating Type" "$FEATURE_DOC" 2>/dev/null; then
  pass "Matrix header includes Gating Type"
else
  fail "Matrix header missing Gating Type"
fi
if grep -q "Enforcement Notes" "$FEATURE_DOC" 2>/dev/null; then
  pass "Matrix header includes Enforcement Notes"
else
  fail "Matrix header missing Enforcement Notes"
fi
if grep -q "When Limit Reached" "$FEATURE_DOC" 2>/dev/null; then
  pass "Matrix header includes When Limit Reached"
else
  fail "Matrix header missing When Limit Reached"
fi
if grep -q "Admin Visibility" "$FEATURE_DOC" 2>/dev/null; then
  pass "Matrix header includes Admin Visibility"
else
  fail "Matrix header missing Admin Visibility"
fi

header "5) Doc-only scope check (informational)"
pass "Doc-only check: script does not inspect working tree"

echo ""
echo "═══ STEP 11.65 TOTALS: $PASS passed, $FAIL failed ═══"
[ "$FAIL" -eq 0 ]
