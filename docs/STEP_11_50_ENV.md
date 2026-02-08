# STEP 11.50 — API ENV Setup + Email Foundation

## Overview

This step establishes production-ready environment variable management and email infrastructure for the Helvino API.

## Environment Variables

### Location
- **Template**: `apps/api/.env.example` (tracked in git)
- **Local config**: `apps/api/.env` (NOT tracked, gitignored)

### Setup
1. Copy the template:
   ```bash
   cd apps/api
   cp .env.example .env
   ```

2. Fill in your values in `.env`

3. **NEVER commit `.env`** — it contains secrets

### Viewing Hidden Files (macOS)
If you can't see `.env` in Finder:
- Press **Cmd + Shift + .** to show hidden files
- Or use terminal: `ls -la apps/api/`

### Required Variables (Minimal)
```bash
SESSION_SECRET=your-random-secret-here
DATABASE_URL=postgresql://...
```

### Optional Variables
All other variables have safe defaults. The system will:
- Use console email provider in dev
- Disable features gracefully when tokens missing
- Log clear warnings (no crashes)

## Email System

### Provider Selection (Automatic)

The system chooses a provider in this order:

1. **Postmark** (if `POSTMARK_SERVER_TOKEN` present)
   - Production email delivery
   - Requires: `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM`
   - Optional: `POSTMARK_MESSAGE_STREAM` (default: "outbound")

2. **SMTP** (if `MAIL_PROVIDER=smtp` and `SMTP_HOST` set)
   - Alternative production provider
   - Requires: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

3. **Console** (if `MAIL_PROVIDER=console` or dev mode)
   - Dev mode default
   - Logs emails to console (safe for local testing)

4. **NOOP** (safe fallback)
   - When no provider configured
   - Logs "EMAIL_DISABLED" and returns success (no crash)

### Postmark Setup (Production)

Add to `apps/api/.env`:
```bash
POSTMARK_SERVER_TOKEN=your-token-here
POSTMARK_MESSAGE_STREAM=transactional
EMAIL_FROM=noreply@yourdomain.com
MAIL_PROVIDER=postmark  # optional; auto-detected if token present
```

Get token from: https://postmarkapp.com/

### Templates

Available templates (`apps/api/src/email/templates/`):
- **reset-password.ts** — Password reset emails
- **verify-email.ts** — Email verification
- **notification.ts** — Security/system alerts (generic)
- **base.ts** — Shared layout with inline styles

All templates:
- Accept params (no hardcoded strings)
- Return `{ subject, html, text }`
- Use inline CSS (email client compatible)
- No external images

### Usage Example

```typescript
import { sendEmail, renderResetPasswordEmail } from "../email";

const { subject, html, text } = renderResetPasswordEmail({
  resetLink: "https://app.helvion.io/reset?token=...",
  recipientEmail: "user@example.com",
  expiresInMinutes: 30,
});

await sendEmail({
  to: "user@example.com",
  subject,
  html,
  text,
  tags: ["password-reset"],
});
```

## Security Notes

### Secrets Management
- **NEVER** commit `.env` to git
- `.env` is automatically ignored (`.gitignore`)
- `.env.example` is tracked (no secrets, only keys)

### Safe Defaults
- Missing email token → NOOP provider (no crash)
- Missing Stripe keys → billing returns 501
- Missing MFA secrets → gracefully disabled

### Production Checklist
Before deploying:
1. Set `NODE_ENV=production`
2. Set strong `SESSION_SECRET` (random, 32+ chars)
3. Configure `POSTMARK_SERVER_TOKEN` or SMTP
4. Set `EMAIL_FROM` to your verified sender
5. Set `TRUSTED_HOSTS` (comma-separated domains)
6. Review all secrets in `.env`

## Email Provider Details

### Postmark
- Native fetch (no dependencies)
- API: `https://api.postmarkapp.com/email`
- Supports: single tag, reply-to, HTML + text
- Rate limits: depend on plan

### NOOP (Fallback)
- Logs to console only
- Returns success (prevents crashes)
- Use case: no email in staging/test environments

### Console (Dev)
- Pretty-prints email to terminal
- Shows truncated body (500 chars)
- Safe for local development

## Files Added

```
apps/api/
├── .env.example           # Template (tracked)
├── .env                   # Local config (gitignored)
└── src/
    └── email/
        ├── index.ts                    # Public API
        ├── providers/
        │   ├── postmark.ts             # Postmark provider
        │   └── noop.ts                 # Safe fallback
        └── templates/
            ├── base.ts                 # Shared layout
            ├── reset-password.ts       # Password reset
            ├── verify-email.ts         # Email verification
            └── notification.ts         # Generic alerts
```

## Non-Breaking Changes

- Existing `mailer.ts` extended (not replaced)
- All existing code continues to work
- Provider selection backward compatible
- No changes to auth flows (email integration optional)
