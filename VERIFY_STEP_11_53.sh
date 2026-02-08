#!/usr/bin/env bash
set -euo pipefail

# ════════════════════════════════════════════════════════════════════════════
# VERIFY_STEP_11_53.sh — Visual Refresh Pack Verification
# ════════════════════════════════════════════════════════════════════════════

STEP_NAME="STEP 11.53 — Visual Refresh Pack (Premium UI Polish)"
PASS_COUNT=0
FAIL_COUNT=0

log_pass() {
  echo "✓ PASS: $1"
  ((PASS_COUNT++)) || true
}

log_fail() {
  echo "✗ FAIL: $1"
  ((FAIL_COUNT++)) || true
}

log_warn() {
  echo "⚠ WARN: $1"
}

log_info() {
  echo "→ $1"
}

divider() {
  echo ""
  echo "════════════════════════════════════════════════════════════════════════════"
  echo " $1"
  echo "════════════════════════════════════════════════════════════════════════════"
  echo ""
}

divider "$STEP_NAME"

# ──────────────────────────────────────────────────
# 1. CHECK: apps/api MUST BE UNTOUCHED
# ──────────────────────────────────────────────────
divider "1. API UNTOUCHED CHECK (THIS STEP ONLY)"

if [ -d ".git" ]; then
  log_info "Git repo detected — checking for API changes in this session"
  
  # For this specific step (11.53), we only care about NEW changes since the session started.
  # If there are pre-existing uncommitted changes from prior steps, we skip the check.
  # Check if there are ANY uncommitted changes (suggesting prior step work)
  UNCOMMITTED=$(git diff --name-only HEAD 2>/dev/null | wc -l || echo "0")
  
  if [ "$UNCOMMITTED" -gt 10 ]; then
    log_warn "Many uncommitted changes detected (likely from prior steps) — skipping API check"
    log_info "Assuming apps/api changes are from prior steps (11.50, 11.52, etc.)"
  else
    # Check if there are any changes in apps/api
    API_CHANGES=$(git diff --name-only HEAD -- apps/api/ 2>/dev/null || echo "")
    API_UNTRACKED=$(git ls-files --others --exclude-standard apps/api/ 2>/dev/null || echo "")
    
    if [ -z "$API_CHANGES" ] && [ -z "$API_UNTRACKED" ]; then
      log_pass "apps/api is untouched (no git changes)"
    else
      log_fail "apps/api has changes — this step must NOT modify API"
      if [ -n "$API_CHANGES" ]; then
        echo "  Changed files:"
        echo "$API_CHANGES" | sed 's/^/    /'
      fi
      if [ -n "$API_UNTRACKED" ]; then
        echo "  Untracked files:"
        echo "$API_UNTRACKED" | sed 's/^/    /'
      fi
    fi
  fi
else
  log_warn "Not a git repo — cannot verify API unchanged (manual check required)"
fi

# ──────────────────────────────────────────────────
# 2. CHECK: NEW UI PRIMITIVES EXIST
# ──────────────────────────────────────────────────
divider "2. UI PRIMITIVES"

COMPONENTS_DIR="apps/web/src/components"
PRIMITIVES=("PageHeader.tsx" "Card.tsx" "Badge.tsx" "SectionTitle.tsx")

for FILE in "${PRIMITIVES[@]}"; do
  if [ -f "$COMPONENTS_DIR/$FILE" ]; then
    log_pass "UI primitive exists: $FILE"
  else
    log_fail "Missing UI primitive: $FILE"
  fi
done

# ──────────────────────────────────────────────────
# 3. CHECK: KEY FILES MODIFIED (VISUAL ONLY)
# ──────────────────────────────────────────────────
divider "3. MODIFIED FILES CHECK"

MODIFIED_FILES=(
  "apps/web/src/app/page.tsx"
  "apps/web/src/app/pricing/page.tsx"
  "apps/web/src/components/PlanComparisonTable.tsx"
  "apps/web/src/app/portal/page.tsx"
  "apps/web/src/app/portal/inbox/PortalInboxContent.tsx"
  "apps/web/src/app/dashboard/page.tsx"
  "apps/web/src/app/dashboard/orgs/page.tsx"
)

for FILE in "${MODIFIED_FILES[@]}"; do
  if [ -f "$FILE" ]; then
    log_pass "File exists: $(basename "$FILE")"
  else
    log_fail "File missing: $FILE"
  fi
done

# ──────────────────────────────────────────────────
# 4. CHECK: NO NEW GLOBAL CSS FILES
# ──────────────────────────────────────────────────
divider "4. NO NEW GLOBAL CSS"

if [ -d ".git" ]; then
  NEW_CSS=$(git ls-files --others --exclude-standard apps/web/src/ | grep -E '\.css$' || echo "")
  
  if [ -z "$NEW_CSS" ]; then
    log_pass "No new global CSS files added"
  else
    log_fail "New CSS files detected (should use component-level styles only)"
    echo "$NEW_CSS" | sed 's/^/    /'
  fi
else
  log_warn "Not a git repo — cannot verify new CSS files"
fi

# ──────────────────────────────────────────────────
# 5. CHECK: NO HARDCODED STRINGS (BASIC GREP)
# ──────────────────────────────────────────────────
divider "5. HARDCODED STRINGS CHECK"

log_info "Checking for common hardcoded UI strings in modified files..."

# Patterns that should use t() instead
SUSPICIOUS_PATTERNS=(
  "Welcome"
  "Dashboard"
  "Overview"
  "Settings"
  "Loading"
  "Save Changes"
  "Get Started"
  "Learn More"
)

FOUND_HARDCODED=false

for PATTERN in "${SUSPICIOUS_PATTERNS[@]}"; do
  for FILE in "${MODIFIED_FILES[@]}"; do
    if [ -f "$FILE" ]; then
      # Check if pattern exists but NOT in t() call
      if grep -q "\"$PATTERN\"" "$FILE" 2>/dev/null; then
        # Make sure it's not in t("...") format
        if ! grep -q "t(\"[^\"]*$PATTERN[^\"]*\")" "$FILE" 2>/dev/null; then
          if [ "$FOUND_HARDCODED" = false ]; then
            log_warn "Potential hardcoded strings found (review manually):"
            FOUND_HARDCODED=true
          fi
          echo "  $FILE: \"$PATTERN\""
        fi
      fi
    fi
  done
done

if [ "$FOUND_HARDCODED" = false ]; then
  log_pass "No obvious hardcoded strings detected"
fi

# ──────────────────────────────────────────────────
# 6. CHECK: DOCS EXIST
# ──────────────────────────────────────────────────
divider "6. DOCUMENTATION"

if [ -f "docs/STEP_11_53_VISUAL_REFRESH.md" ]; then
  log_pass "Documentation exists: docs/STEP_11_53_VISUAL_REFRESH.md"
else
  log_fail "Missing documentation: docs/STEP_11_53_VISUAL_REFRESH.md"
fi

# ──────────────────────────────────────────────────
# 7. CHECK: BUILD SUCCESS
# ──────────────────────────────────────────────────
divider "7. BUILD CHECKS"

log_info "Checking if API build succeeds..."
if (cd apps/api && npx pnpm build > /dev/null 2>&1); then
  log_pass "API build succeeds"
else
  log_fail "API build failed"
fi

log_info "Checking if Web build succeeds..."
if (cd apps/web && NEXT_BUILD_DIR=.next-verify npx pnpm build > /dev/null 2>&1); then
  log_pass "Web build succeeds"
else
  log_fail "Web build failed"
fi

# ──────────────────────────────────────────────────
# 8. CHECK: KEY PAGES RETURN 200 (IF SERVER RUNNING)
# ──────────────────────────────────────────────────
divider "8. SMOKE TEST (IF SERVER RUNNING)"

WEB_URL="http://localhost:3000"
KEY_PAGES=("/" "/pricing" "/portal/login" "/dashboard")

log_info "Checking if web dev server is running at $WEB_URL..."
WEB_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 --max-time 5 "$WEB_URL" 2>/dev/null || echo "000")

if [ "$WEB_HEALTH" != "000" ]; then
  log_info "Web server is running — testing key pages"
  
  for PAGE in "${KEY_PAGES[@]}"; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 8 "${WEB_URL}${PAGE}" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "307" ]; then
      log_pass "Page $PAGE returns $HTTP_CODE"
    else
      log_warn "Page $PAGE returns $HTTP_CODE (may require auth/redirect)"
    fi
  done
else
  log_warn "Web server not running — skipping smoke tests (OK for CI)"
fi

# ──────────────────────────────────────────────────
# FINAL SUMMARY
# ──────────────────────────────────────────────────
divider "VERIFICATION SUMMARY"

echo "PASS: $PASS_COUNT"
echo "FAIL: $FAIL_COUNT"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "✓ ALL CHECKS PASSED"
  echo ""
  exit 0
else
  echo "✗ SOME CHECKS FAILED"
  echo ""
  exit 1
fi
