#!/usr/bin/env bash
# VERIFY_STEP_11_50.sh — API ENV Setup + Email Foundation
set -euo pipefail

STEP="11.50"
PASS_COUNT=0
FAIL_COUNT=0

log_pass() { echo "  PASS: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
log_fail() { echo "  FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }

echo "================================================================"
echo "STEP ${STEP} VERIFICATION: API ENV Setup + Email Foundation"
echo "================================================================"

# ══════════════════════════════════════════════════════════════════
# 1) ENV FILES
# ══════════════════════════════════════════════════════════════════
echo
echo "1) Environment Setup"

# 1.1 .env.example exists
if [ -f "apps/api/.env.example" ]; then
  log_pass "1.1 .env.example exists"
else
  log_fail "1.1 .env.example missing"
fi

# 1.2 .env.example contains key variables
if [ -f "apps/api/.env.example" ]; then
  REQUIRED_KEYS=("SESSION_SECRET" "DATABASE_URL" "POSTMARK_SERVER_TOKEN" "EMAIL_FROM" "APP_PUBLIC_URL")
  MISSING_KEYS=()
  for key in "${REQUIRED_KEYS[@]}"; do
    if ! grep -q "^${key}=" apps/api/.env.example; then
      MISSING_KEYS+=("$key")
    fi
  done
  
  if [ ${#MISSING_KEYS[@]} -eq 0 ]; then
    log_pass "1.2 All required keys in .env.example"
  else
    log_fail "1.2 Missing keys: ${MISSING_KEYS[*]}"
  fi
else
  log_fail "1.2 .env.example missing (skipped key check)"
fi

# 1.3 .env is gitignored (if git repo)
if [ -d ".git" ]; then
  if grep -qE '^(\.env|apps/api/\.env)$' .gitignore 2>/dev/null; then
    log_pass "1.3 .env is gitignored"
  else
    log_fail "1.3 .env NOT gitignored"
  fi
else
  log_pass "1.3 Not a git repo (skip gitignore check)"
fi

# ══════════════════════════════════════════════════════════════════
# 2) EMAIL MODULE FILES
# ══════════════════════════════════════════════════════════════════
echo
echo "2) Email Module Structure"

EMAIL_FILES=(
  "apps/api/src/email/index.ts"
  "apps/api/src/email/providers/postmark.ts"
  "apps/api/src/email/providers/noop.ts"
  "apps/api/src/email/templates/base.ts"
  "apps/api/src/email/templates/reset-password.ts"
  "apps/api/src/email/templates/verify-email.ts"
  "apps/api/src/email/templates/notification.ts"
)

MISSING_FILES=()
for file in "${EMAIL_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    MISSING_FILES+=("$file")
  fi
done

if [ ${#MISSING_FILES[@]} -eq 0 ]; then
  log_pass "2.1 All email module files exist (${#EMAIL_FILES[@]} files)"
else
  log_fail "2.1 Missing files: ${MISSING_FILES[*]}"
fi

# 2.2 Postmark provider exports class
if [ -f "apps/api/src/email/providers/postmark.ts" ]; then
  if grep -q "export class PostmarkEmailProvider" apps/api/src/email/providers/postmark.ts; then
    log_pass "2.2 Postmark provider exports class"
  else
    log_fail "2.2 Postmark provider class missing"
  fi
else
  log_fail "2.2 Postmark provider file missing"
fi

# 2.3 NOOP provider exports class
if [ -f "apps/api/src/email/providers/noop.ts" ]; then
  if grep -q "export class NoopEmailProvider" apps/api/src/email/providers/noop.ts; then
    log_pass "2.3 NOOP provider exports class"
  else
    log_fail "2.3 NOOP provider class missing"
  fi
else
  log_fail "2.3 NOOP provider file missing"
fi

# 2.4 Templates export render functions
if [ -f "apps/api/src/email/templates/reset-password.ts" ] && \
   grep -q "export function renderResetPasswordEmail" apps/api/src/email/templates/reset-password.ts; then
  log_pass "2.4 Reset password template exports render function"
else
  log_fail "2.4 Reset password template missing/incomplete"
fi

if [ -f "apps/api/src/email/templates/verify-email.ts" ] && \
   grep -q "export function renderVerifyEmail" apps/api/src/email/templates/verify-email.ts; then
  log_pass "2.5 Verify email template exports render function"
else
  log_fail "2.5 Verify email template missing/incomplete"
fi

if [ -f "apps/api/src/email/templates/notification.ts" ] && \
   grep -q "export function renderNotificationEmail" apps/api/src/email/templates/notification.ts; then
  log_pass "2.6 Notification template exports render function"
else
  log_fail "2.6 Notification template missing/incomplete"
fi

# 2.7 Base template
if [ -f "apps/api/src/email/templates/base.ts" ] && \
   grep -q "export function renderBaseTemplate" apps/api/src/email/templates/base.ts; then
  log_pass "2.7 Base template exports render function"
else
  log_fail "2.7 Base template missing/incomplete"
fi

# ══════════════════════════════════════════════════════════════════
# 3) MAILER INTEGRATION
# ══════════════════════════════════════════════════════════════════
echo
echo "3) Mailer Integration"

MAILER_FILE="apps/api/src/utils/mailer.ts"

# 3.1 Mailer file exists
if [ -f "$MAILER_FILE" ]; then
  log_pass "3.1 Mailer file exists"
else
  log_fail "3.1 Mailer file missing"
fi

# 3.2 Mailer checks for POSTMARK_SERVER_TOKEN
if grep -q "POSTMARK_SERVER_TOKEN" "$MAILER_FILE"; then
  log_pass "3.2 Mailer checks for POSTMARK_SERVER_TOKEN"
else
  log_fail "3.2 Mailer missing Postmark integration"
fi

# 3.3 Mailer imports/requires Postmark provider
if grep -qE '(PostmarkEmailProvider|email/providers/postmark)' "$MAILER_FILE"; then
  log_pass "3.3 Mailer imports Postmark provider"
else
  log_fail "3.3 Mailer missing Postmark import"
fi

# 3.4 Mailer imports/requires NOOP provider
if grep -qE '(NoopEmailProvider|email/providers/noop)' "$MAILER_FILE"; then
  log_pass "3.4 Mailer imports NOOP provider"
else
  log_fail "3.4 Mailer missing NOOP import"
fi

# ══════════════════════════════════════════════════════════════════
# 4) DOCUMENTATION
# ══════════════════════════════════════════════════════════════════
echo
echo "4) Documentation"

DOC_FILE="docs/STEP_11_50_ENV.md"

# 4.1 Doc file exists
if [ -f "$DOC_FILE" ]; then
  log_pass "4.1 Documentation exists"
else
  log_fail "4.1 Documentation missing"
fi

# 4.2 Doc mentions key topics
if [ -f "$DOC_FILE" ]; then
  TOPICS=(".env.example" "POSTMARK" "EMAIL_FROM" "NOOP")
  MISSING_TOPICS=()
  for topic in "${TOPICS[@]}"; do
    if ! grep -qi "$topic" "$DOC_FILE"; then
      MISSING_TOPICS+=("$topic")
    fi
  done
  
  if [ ${#MISSING_TOPICS[@]} -eq 0 ]; then
    log_pass "4.2 Doc covers key topics"
  else
    log_fail "4.2 Doc missing topics: ${MISSING_TOPICS[*]}"
  fi
else
  log_fail "4.2 Doc file missing (skipped topic check)"
fi

# 4.3 Doc mentions Cmd+Shift+. for macOS
if [ -f "$DOC_FILE" ] && grep -q "Cmd.*Shift" "$DOC_FILE"; then
  log_pass "4.3 Doc mentions macOS show hidden files"
else
  log_fail "4.3 Doc missing macOS tip"
fi

# ══════════════════════════════════════════════════════════════════
# 5) BUILD CHECKS
# ══════════════════════════════════════════════════════════════════
echo
echo "5) Build Checks"

# 5.1 API builds
if cd apps/api && pnpm build > /dev/null 2>&1; then
  log_pass "5.1 API builds successfully"
else
  log_fail "5.1 API build failed"
fi
cd - > /dev/null || true

# 5.2 Web builds (quick check - already built in main verify)
if [ -d "apps/web/.next-verify" ] || [ -d "apps/web/.next" ]; then
  log_pass "5.2 Web build artifacts present"
else
  log_fail "5.2 Web build artifacts missing"
fi

# ══════════════════════════════════════════════════════════════════
# 6) TEMPLATE QUALITY (Basic Checks)
# ══════════════════════════════════════════════════════════════════
echo
echo "6) Template Quality"

# 6.1 Templates return { subject, html, text }
TEMPLATE_FILES=(
  "apps/api/src/email/templates/reset-password.ts"
  "apps/api/src/email/templates/verify-email.ts"
  "apps/api/src/email/templates/notification.ts"
)

ALL_RETURN_CORRECT=true
for tpl in "${TEMPLATE_FILES[@]}"; do
  if [ -f "$tpl" ]; then
    if ! (grep -q 'subject' "$tpl" && grep -q 'html' "$tpl" && grep -q 'text' "$tpl"); then
      ALL_RETURN_CORRECT=false
      break
    fi
  fi
done

if [ "$ALL_RETURN_CORRECT" = true ]; then
  log_pass "6.1 Templates return { subject, html, text }"
else
  log_fail "6.1 Some templates missing correct return shape"
fi

# 6.2 No hardcoded email addresses in templates
HARDCODED_EMAILS=$(grep -rE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' apps/api/src/email/templates/ 2>/dev/null | grep -v 'example.com' | grep -v 'helvion.io' || true)
if [ -z "$HARDCODED_EMAILS" ]; then
  log_pass "6.2 No hardcoded emails in templates"
else
  log_fail "6.2 Found hardcoded emails in templates"
fi

# 6.3 Templates use params (accept arguments)
if grep -qE '(Params|params:)' apps/api/src/email/templates/reset-password.ts && \
   grep -qE '(Params|params:)' apps/api/src/email/templates/verify-email.ts; then
  log_pass "6.3 Templates accept params"
else
  log_fail "6.3 Templates missing param interfaces"
fi

# ══════════════════════════════════════════════════════════════════
# 7) FINAL SUMMARY
# ══════════════════════════════════════════════════════════════════
echo
echo "================================================================"
echo "VERIFICATION SUMMARY - Step ${STEP}"
echo "================================================================"
echo "  PASS: ${PASS_COUNT}"
echo "  FAIL: ${FAIL_COUNT}"
echo

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "All checks passed!"
  exit 0
else
  echo "Some checks failed."
  exit 1
fi
