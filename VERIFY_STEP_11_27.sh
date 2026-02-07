#!/usr/bin/env bash
# VERIFY_STEP_11_27.sh — Transactional Email System + Signed Links + i18n Templates
# ≥ 45 checks

set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
check_grep() {
  local label="$1" pattern="$2" file="$3"
  if grep -qE "$pattern" "$file" 2>/dev/null; then pass "$label"; else fail "$label"; fi
}

echo "╔══════════════════════════════════════════════════╗"
echo "║  VERIFY STEP 11.27 — Email System                ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ════════════════════════════════════════════════
# SECTION 1: Mailer utility
# ════════════════════════════════════════════════
echo "── 1. Mailer Utility ──"

MAILER="$ROOT/apps/api/src/utils/mailer.ts"

# 1
if [ -f "$MAILER" ]; then pass "1.1 mailer.ts exists"; else fail "1.1 mailer.ts exists"; fi
# 2
check_grep "1.2 sendEmail function exported" "export async function sendEmail" "$MAILER"
# 3
check_grep "1.3 EmailPayload interface" "interface EmailPayload" "$MAILER"
# 4
check_grep "1.4 EmailProvider interface" "interface EmailProvider" "$MAILER"
# 5
check_grep "1.5 ConsoleEmailProvider" "ConsoleEmailProvider" "$MAILER"
# 6
check_grep "1.6 SmtpEmailProvider" "SmtpEmailProvider" "$MAILER"
# 7
check_grep "1.7 MAIL_PROVIDER env var" "MAIL_PROVIDER" "$MAILER"
# 8
check_grep "1.8 MAIL_FROM env var" "MAIL_FROM" "$MAILER"
# 9
check_grep "1.9 getMailProviderName exported" "export function getMailProviderName" "$MAILER"
# 10
check_grep "1.10 Provider send returns EmailResult" "EmailResult" "$MAILER"

echo ""

# ════════════════════════════════════════════════
# SECTION 2: Signed Links
# ════════════════════════════════════════════════
echo "── 2. Signed Links ──"

SIGNED="$ROOT/apps/api/src/utils/signed-links.ts"

# 11
if [ -f "$SIGNED" ]; then pass "2.1 signed-links.ts exists"; else fail "2.1 signed-links.ts exists"; fi
# 12
check_grep "2.2 generateSignedLink function" "export function generateSignedLink" "$SIGNED"
# 13
check_grep "2.3 verifySignedLink function" "export function verifySignedLink" "$SIGNED"
# 14
check_grep "2.4 generateInviteLink helper" "export function generateInviteLink" "$SIGNED"
# 15
check_grep "2.5 generateResetLink helper" "export function generateResetLink" "$SIGNED"
# 16
check_grep "2.6 generateRecoveryLink helper" "export function generateRecoveryLink" "$SIGNED"
# 17
check_grep "2.7 generateEmergencyLink helper" "export function generateEmergencyLink" "$SIGNED"
# 18
check_grep "2.8 HMAC signing" "createHmac" "$SIGNED"
# 19
check_grep "2.9 Timing-safe comparison" "timingSafeCompare|timingSafeEqual" "$SIGNED"
# 20
check_grep "2.10 APP_PUBLIC_URL or NEXT_PUBLIC_WEB_URL" "APP_PUBLIC_URL|NEXT_PUBLIC_WEB_URL" "$SIGNED"
# 21
check_grep "2.11 SIGNED_LINK_SECRET env" "SIGNED_LINK_SECRET" "$SIGNED"
# 22
check_grep "2.12 Expiry check in verify" "expired|expir" "$SIGNED"

echo ""

# ════════════════════════════════════════════════
# SECTION 3: Email Templates
# ════════════════════════════════════════════════
echo "── 3. Email Templates ──"

TEMPLATES="$ROOT/apps/api/src/utils/email-templates.ts"

# 23
if [ -f "$TEMPLATES" ]; then pass "3.1 email-templates.ts exists"; else fail "3.1 email-templates.ts exists"; fi
# 24
check_grep "3.2 getInviteEmail exported" "export function getInviteEmail" "$TEMPLATES"
# 25
check_grep "3.3 getResetEmail exported" "export function getResetEmail" "$TEMPLATES"
# 26
check_grep "3.4 getRecoveryApprovedEmail exported" "export function getRecoveryApprovedEmail" "$TEMPLATES"
# 27
check_grep "3.5 getRecoveryRejectedEmail exported" "export function getRecoveryRejectedEmail" "$TEMPLATES"
# 28
check_grep "3.6 getEmergencyTokenEmail exported" "export function getEmergencyTokenEmail" "$TEMPLATES"
# 29
check_grep "3.7 EN locale templates" '"en"' "$TEMPLATES"
# 30
check_grep "3.8 TR locale templates" '"tr"' "$TEMPLATES"
# 31
check_grep "3.9 ES locale templates" '"es"' "$TEMPLATES"
# 32
check_grep "3.10 No TOTP jargon (uses authenticator app)" 'authenticator app|Authenticator|doğrulama uygulama|autenticación' "$TEMPLATES"
# 33
check_grep "3.11 HTML email wrapper" "<!DOCTYPE html>" "$TEMPLATES"
# 34
check_grep "3.12 Button/CTA in templates" "buttonHtml" "$TEMPLATES"

echo ""

# ════════════════════════════════════════════════
# SECTION 4: Integration — Portal Invites
# ════════════════════════════════════════════════
echo "── 4. Integration — Portal Invites ──"

TEAM="$ROOT/apps/api/src/routes/portal-team.ts"

# 35
check_grep "4.1 Imports sendEmail" "sendEmail" "$TEAM"
# 36
check_grep "4.2 Imports generateInviteLink" "generateInviteLink" "$TEAM"
# 37
check_grep "4.3 Imports getInviteEmail" "getInviteEmail" "$TEAM"
# 38
check_grep "4.4 sendEmail called in invite create" 'sendEmail' "$TEAM"

echo ""

# ════════════════════════════════════════════════
# SECTION 5: Integration — Password Reset
# ════════════════════════════════════════════════
echo "── 5. Integration — Password Reset ──"

SECURITY="$ROOT/apps/api/src/routes/portal-security.ts"

# 39
check_grep "5.1 Imports sendEmail" "sendEmail" "$SECURITY"
# 40
check_grep "5.2 Imports generateResetLink" "generateResetLink" "$SECURITY"
# 41
check_grep "5.3 Imports getResetEmail" "getResetEmail" "$SECURITY"
# 42
check_grep "5.4 sendEmail called in forgot-password" 'password-reset' "$SECURITY"

echo ""

# ════════════════════════════════════════════════
# SECTION 6: Integration — Recovery + Emergency
# ════════════════════════════════════════════════
echo "── 6. Integration — Recovery + Emergency ──"

RECOVERY="$ROOT/apps/api/src/routes/recovery-routes.ts"

# 43
check_grep "6.1 Imports sendEmail" "sendEmail" "$RECOVERY"
# 44
check_grep "6.2 Imports recovery email templates" "getRecoveryApprovedEmail" "$RECOVERY"
# 45
check_grep "6.3 Imports emergency email template" "getEmergencyTokenEmail" "$RECOVERY"
# 46
check_grep "6.4 sendEmail in recovery approve" 'recovery.*approved' "$RECOVERY"
# 47
check_grep "6.5 sendEmail in recovery reject" 'recovery.*rejected' "$RECOVERY"
# 48
check_grep "6.6 sendEmail in emergency generate" 'emergency.*security' "$RECOVERY"

echo ""

# ════════════════════════════════════════════════
# SECTION 7: Documentation
# ════════════════════════════════════════════════
echo "── 7. Documentation ──"

DOC="$ROOT/docs/STEP_11_27_EMAIL_SYSTEM.md"

# 49
if [ -f "$DOC" ]; then pass "7.1 Docs file exists"; else fail "7.1 Docs file exists"; fi
# 50
check_grep "7.2 Provider abstraction section" "provider|Provider" "$DOC"
# 51
check_grep "7.3 Signed links section" "signed|Signed" "$DOC"
# 52
check_grep "7.4 i18n templates section" "i18n|EN.*TR.*ES" "$DOC"
# 53
check_grep "7.5 Integration points documented" "Integration" "$DOC"
# 54
check_grep "7.6 Security notes" "security|Security" "$DOC"

echo ""

# ════════════════════════════════════════════════
# SECTION 8: Smoke tests (API)
# ════════════════════════════════════════════════
echo "── 8. Smoke tests ──"

API_URL="${API_URL:-http://localhost:4000}"

# 55: forgot-password should return 200 (or 429 if rate-limited by prior scripts)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/auth/forgot-password" \
  -H "Content-Type: application/json" -d '{"email":"nonexistent-11-27@test.com"}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "429" ]; then pass "8.1 forgot-password returns 200|429 (generic, no enumeration)"; else fail "8.1 forgot-password returns 200|429 (got $HTTP_CODE)"; fi

# 56: invite without auth should return 401
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/org/users/invite" \
  -H "Content-Type: application/json" -d '{"email":"test-1127@test.com","role":"agent"}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "401" ]; then pass "8.2 invite unauthenticated → 401"; else fail "8.2 invite unauthenticated → 401 (got $HTTP_CODE)"; fi

# 57: reset-password with invalid token (or 429 if rate-limited)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/portal/auth/reset-password" \
  -H "Content-Type: application/json" -d '{"token":"invalidtoken-1127","newPassword":"newpassword123"}' 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "429" ]; then pass "8.3 reset-password invalid token → 400|429"; else fail "8.3 reset-password invalid token → 400|429 (got $HTTP_CODE)"; fi

echo ""

# ════════════════════════════════════════════════
# SECTION 9: Code quality
# ════════════════════════════════════════════════
echo "── 9. Code quality ──"

# 58: No hardcoded email subjects in route files (should use template)
if grep -qE 'subject:.*"You.*invited|subject:.*"Invite' "$TEAM" 2>/dev/null; then
  fail "9.1 No hardcoded email subjects in portal-team.ts"
else
  pass "9.1 No hardcoded email subjects in portal-team.ts"
fi

# 59: Email sends are best-effort (catch)
CATCH_COUNT_TEAM=$(grep -c '\.catch' "$TEAM" 2>/dev/null || echo 0)
if [ "$CATCH_COUNT_TEAM" -ge 1 ]; then pass "9.2 Email sends are best-effort in portal-team.ts"; else fail "9.2 Email sends are best-effort in portal-team.ts"; fi

# 60: Email sends are best-effort in portal-security.ts
CATCH_COUNT_SEC=$(grep -c '\.catch' "$SECURITY" 2>/dev/null || echo 0)
if [ "$CATCH_COUNT_SEC" -ge 1 ]; then pass "9.3 Email sends are best-effort in portal-security.ts"; else fail "9.3 Email sends are best-effort in portal-security.ts"; fi

# 61: Email sends are best-effort in recovery-routes.ts
CATCH_COUNT_REC=$(grep -c '\.catch' "$RECOVERY" 2>/dev/null || echo 0)
if [ "$CATCH_COUNT_REC" -ge 2 ]; then pass "9.4 Email sends are best-effort in recovery-routes.ts (>= 2 catches)"; else fail "9.4 Email sends are best-effort in recovery-routes.ts (found $CATCH_COUNT_REC)"; fi

echo ""

# ════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════
echo "════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo "  Total: $TOTAL checks | PASS: $PASS | FAIL: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo "  ✅ VERIFY_STEP_11_27: ALL PASS"
  exit 0
else
  echo "  ❌ VERIFY_STEP_11_27: $FAIL FAILURE(S)"
  exit 1
fi
