#!/usr/bin/env bash
# VERIFY_STEP_11_47.sh — Inbox Workflow: Assignment + Open/Closed + Notes
set -euo pipefail

# i18n compat: use generated flat file instead of translations.ts
_COMPAT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -n "${I18N_COMPAT_FILE:-}" ] && [ -f "${I18N_COMPAT_FILE}" ]; then
  _I18N_COMPAT="$I18N_COMPAT_FILE"
elif [ -f "$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts" ]; then
  _I18N_COMPAT="$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts"
else
  # Fallback: generate compat on the fly
  [ -f "$_COMPAT_DIR/scripts/gen-i18n-compat.js" ] && node "$_COMPAT_DIR/scripts/gen-i18n-compat.js" >/dev/null 2>&1 || true
  _I18N_COMPAT="$_COMPAT_DIR/apps/web/src/i18n/.translations-compat.ts"
fi


STEP="11.47"
PASS_COUNT=0
FAIL_COUNT=0
API_URL="${API_URL:-http://localhost:4000}"
WEB_URL="${WEB_URL:-http://localhost:3000}"

log_pass() { echo "✅ PASS: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
log_fail() { echo "❌ FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP ${STEP} VERIFICATION: Inbox Workflow (Assignment + Status + Notes)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ══════════════════════════════════════════════════════════════════
# 1) SCHEMA & MIGRATION
# ══════════════════════════════════════════════════════════════════
echo
echo "1️⃣  Schema & Migration Checks"

# 1.1 Conversation fields
if grep -q "status.*String.*default.*OPEN" apps/api/prisma/schema.prisma; then
  log_pass "1.1 Conversation.status field exists"
else
  log_fail "1.1 Conversation.status field missing"
fi

# 1.2 assignedToOrgUserId
if grep -q "assignedToOrgUserId.*String?" apps/api/prisma/schema.prisma; then
  log_pass "1.2 Conversation.assignedToOrgUserId field exists"
else
  log_fail "1.2 Conversation.assignedToOrgUserId field missing"
fi

# 1.3 closedAt
if grep -q "closedAt.*DateTime?" apps/api/prisma/schema.prisma; then
  log_pass "1.3 Conversation.closedAt field exists"
else
  log_fail "1.3 Conversation.closedAt field missing"
fi

# 1.4 ConversationNote model
if grep -q "model ConversationNote" apps/api/prisma/schema.prisma; then
  log_pass "1.4 ConversationNote model exists"
else
  log_fail "1.4 ConversationNote model missing"
fi

# 1.5 Migration file
if [ -f "apps/api/prisma/migrations/20260206260000_v11_47_inbox_workflow/migration.sql" ]; then
  log_pass "1.5 Migration file exists"
else
  log_fail "1.5 Migration file missing"
fi

# 1.6 Migration adds status
if grep -q 'ADD COLUMN "status"' apps/api/prisma/migrations/20260206260000_v11_47_inbox_workflow/migration.sql; then
  log_pass "1.6 Migration adds status column"
else
  log_fail "1.6 Migration missing status column"
fi

# 1.7 Migration creates conversation_notes
if grep -q 'CREATE TABLE "conversation_notes"' apps/api/prisma/migrations/20260206260000_v11_47_inbox_workflow/migration.sql; then
  log_pass "1.7 Migration creates conversation_notes table"
else
  log_fail "1.7 Migration missing conversation_notes table"
fi

# ══════════════════════════════════════════════════════════════════
# 2) API ROUTES & LOGIC
# ══════════════════════════════════════════════════════════════════
echo
echo "2️⃣  API Routes & Logic"

# 2.1 Route file exists
if [ -f "apps/api/src/routes/portal-conversations.ts" ]; then
  log_pass "2.1 portal-conversations.ts exists"
else
  log_fail "2.1 portal-conversations.ts missing"
fi

# 2.2 PATCH route registered
if grep -qE 'patch<' apps/api/src/routes/portal-conversations.ts && grep -q '/portal/conversations/:id' apps/api/src/routes/portal-conversations.ts; then
  log_pass "2.2 PATCH /portal/conversations/:id route exists"
else
  log_fail "2.2 PATCH route missing"
fi

# 2.3 GET notes route
if grep -qE 'get<' apps/api/src/routes/portal-conversations.ts && grep -q '/portal/conversations/:id/notes' apps/api/src/routes/portal-conversations.ts; then
  log_pass "2.3 GET /portal/conversations/:id/notes route exists"
else
  log_fail "2.3 GET notes route missing"
fi

# 2.4 POST notes route
if grep -qE 'post<' apps/api/src/routes/portal-conversations.ts && grep -q '/portal/conversations/:id/notes' apps/api/src/routes/portal-conversations.ts; then
  log_pass "2.4 POST /portal/conversations/:id/notes route exists"
else
  log_fail "2.4 POST notes route missing"
fi

# 2.5 Routes registered in index.ts
if grep -q "portalConversationRoutes" apps/api/src/index.ts; then
  log_pass "2.5 portalConversationRoutes registered in index.ts"
else
  log_fail "2.5 portalConversationRoutes not registered"
fi

# 2.6 Auth middleware present
if grep -q "requirePortalUser" apps/api/src/routes/portal-conversations.ts; then
  log_pass "2.6 requirePortalUser middleware used"
else
  log_fail "2.6 Auth middleware missing"
fi

# 2.7 Rate limiting present
if grep -q "createRateLimitMiddleware" apps/api/src/routes/portal-conversations.ts; then
  log_pass "2.7 Rate limiting middleware used"
else
  log_fail "2.7 Rate limiting missing"
fi

# 2.8 Audit log patterns
if grep -qE 'conversation\.(assigned|closed|note_created)' apps/api/src/routes/portal-conversations.ts; then
  log_pass "2.8 Audit log actions present"
else
  log_fail "2.8 Audit log actions missing"
fi

# 2.9 Assignment validation
if grep -qE 'isActive.*true' apps/api/src/routes/portal-conversations.ts; then
  log_pass "2.9 Assignment validates active users"
else
  log_fail "2.9 Assignment validation missing"
fi

# 2.10 Note length validation
if grep -qE '(2000|noteTooLong|body\.length)' apps/api/src/routes/portal-conversations.ts; then
  log_pass "2.10 Note length validation present"
else
  log_fail "2.10 Note length validation missing"
fi

# ══════════════════════════════════════════════════════════════════
# 3) WEB UI
# ══════════════════════════════════════════════════════════════════
echo
echo "3️⃣  Web UI Components"

# 3.1 Inbox page updated
if [ -f "apps/web/src/app/portal/inbox/PortalInboxContent.tsx" ]; then
  log_pass "3.1 Portal inbox page exists"
else
  log_fail "3.1 Portal inbox page missing"
fi

# 3.2 Status badge
if grep -qE '(statusOpen|statusClosed|inbox\.status)' apps/web/src/app/portal/inbox/PortalInboxContent.tsx; then
  log_pass "3.2 Status badge/controls present"
else
  log_fail "3.2 Status controls missing"
fi

# 3.3 Assignment dropdown
if grep -qE '(assignTo|assignedTo|select.*team)' apps/web/src/app/portal/inbox/PortalInboxContent.tsx; then
  log_pass "3.3 Assignment dropdown present"
else
  log_fail "3.3 Assignment dropdown missing"
fi

# 3.4 Notes section
if grep -qE '(notesTitle|conversationNote|notes\.)' apps/web/src/app/portal/inbox/PortalInboxContent.tsx; then
  log_pass "3.4 Notes section present"
else
  log_fail "3.4 Notes section missing"
fi

# 3.5 Add note textarea
if grep -qE '(notePlaceholder|noteBody|textarea)' apps/web/src/app/portal/inbox/PortalInboxContent.tsx; then
  log_pass "3.5 Add note textarea present"
else
  log_fail "3.5 Add note textarea missing"
fi

# 3.6 PATCH fetch for status
if grep -q 'PATCH' apps/web/src/app/portal/inbox/PortalInboxContent.tsx && grep -q '/portal/conversations' apps/web/src/app/portal/inbox/PortalInboxContent.tsx; then
  log_pass "3.6 PATCH request for status/assignment"
else
  log_fail "3.6 PATCH request missing"
fi

# 3.7 POST fetch for notes
if grep -q 'POST' apps/web/src/app/portal/inbox/PortalInboxContent.tsx && grep -q '/notes' apps/web/src/app/portal/inbox/PortalInboxContent.tsx; then
  log_pass "3.7 POST request for notes"
else
  log_fail "3.7 POST notes request missing"
fi

# 3.8 ErrorBanner import
if grep -q "ErrorBanner" apps/web/src/app/portal/inbox/PortalInboxContent.tsx; then
  log_pass "3.8 ErrorBanner imported"
else
  log_fail "3.8 ErrorBanner not imported"
fi

# 3.9 useHydrated for date formatting
if grep -q "useHydrated" apps/web/src/app/portal/inbox/PortalInboxContent.tsx; then
  log_pass "3.9 useHydrated hook used (hydration-safe)"
else
  log_fail "3.9 useHydrated missing (possible hydration issue)"
fi

# ══════════════════════════════════════════════════════════════════
# 4) i18n PARITY
# ══════════════════════════════════════════════════════════════════
echo
echo "4️⃣  i18n Keys (EN/TR/ES Parity)"

I18N_FILE="$_I18N_COMPAT"

# 4.1 EN keys
if sh -c "grep -A 2000 'const en =' \"$I18N_FILE\" | grep -q '\"inbox.statusOpen\"'" 2>/dev/null; then
  log_pass "4.1 EN inbox keys present"
else
  log_fail "4.1 EN inbox keys missing"
fi

# 4.2 TR keys
if grep -q '"inbox.statusOpen".*"Açık"' "$I18N_FILE" || grep -q '"inbox.statusOpen": "Açık"' "$I18N_FILE"; then
  log_pass "4.2 TR inbox keys present"
else
  log_fail "4.2 TR inbox keys missing"
fi

# 4.3 ES keys
if grep -q '"inbox.statusOpen".*"Abierto"' "$I18N_FILE" || grep -q '"inbox.statusOpen": "Abierto"' "$I18N_FILE"; then
  log_pass "4.3 ES inbox keys present"
else
  log_fail "4.3 ES inbox keys missing"
fi

# 4.4 All required inbox keys (sample check)
REQUIRED_KEYS=("inbox.statusClosed" "inbox.assignTo" "inbox.notesTitle" "inbox.noteSubmit")
MISSING_KEYS=()
for key in "${REQUIRED_KEYS[@]}"; do
  if ! grep -q "\"$key\"" "$I18N_FILE"; then
    MISSING_KEYS+=("$key")
  fi
done

if [ ${#MISSING_KEYS[@]} -eq 0 ]; then
  log_pass "4.4 All required inbox keys present"
else
  log_fail "4.4 Missing keys: ${MISSING_KEYS[*]}"
fi

# ══════════════════════════════════════════════════════════════════
# 5) DOCS
# ══════════════════════════════════════════════════════════════════
echo
echo "5️⃣  Documentation"

# 5.1 Doc file exists
if [ -f "docs/STEP_11_47_INBOX_WORKFLOW.md" ]; then
  log_pass "5.1 STEP_11_47_INBOX_WORKFLOW.md exists"
else
  log_fail "5.1 Documentation file missing"
fi

# 5.2 Doc mentions key routes
if grep -qE '(PATCH|GET|POST.*\/portal\/conversations)' docs/STEP_11_47_INBOX_WORKFLOW.md 2>/dev/null; then
  log_pass "5.2 Doc mentions API routes"
else
  log_fail "5.2 Doc missing API route descriptions"
fi

# ══════════════════════════════════════════════════════════════════
# 6) API SMOKE TESTS (Basic)
# ══════════════════════════════════════════════════════════════════
echo
echo "6️⃣  API Smoke Tests"

# 6.1 Unauth PATCH returns 401/403/404 (server might not be running)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/portal/conversations/test123" -X PATCH 2>/dev/null || echo "000")
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ] || [ "$STATUS" = "404" ]; then
  log_pass "6.1 Unauth PATCH returns $STATUS (acceptable)"
else
  log_fail "6.1 Unauth PATCH returned $STATUS (expected 401/403/404)"
fi

# 6.2 Unauth GET notes returns 401/403/404
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/portal/conversations/test123/notes" 2>/dev/null || echo "000")
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ] || [ "$STATUS" = "404" ]; then
  log_pass "6.2 Unauth GET notes returns $STATUS (acceptable)"
else
  log_fail "6.2 Unauth GET notes returned $STATUS (expected 401/403/404)"
fi

# 6.3 Unauth POST notes returns 401/403/404
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/portal/conversations/test123/notes" -X POST \
  -H "Content-Type: application/json" -d '{"body":"test"}' 2>/dev/null || echo "000")
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ] || [ "$STATUS" = "404" ]; then
  log_pass "6.3 Unauth POST notes returns $STATUS (acceptable)"
else
  log_fail "6.3 Unauth POST notes returned $STATUS (expected 401/403/404)"
fi

# ══════════════════════════════════════════════════════════════════
# 7) FINAL SUMMARY
# ══════════════════════════════════════════════════════════════════
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "VERIFICATION SUMMARY — Step ${STEP}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PASS: ${PASS_COUNT}"
echo "❌ FAIL: ${FAIL_COUNT}"
echo

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "🎉 All checks passed!"
  exit 0
else
  echo "❗ Some checks failed."
  exit 1
fi
