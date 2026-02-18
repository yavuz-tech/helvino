# Portal Regression Checklist (app.helvion.io)

Goal: make UI/UX changes safely without breaking core workflows.

## How To Use
- Run the checklist on `staging` first.
- Verify the same items on `production` only after approval.
- Record any failures with: URL, steps, expected vs actual, screenshot/video.

## Environments
- Web: `apps/web` (Next.js)
- API: `apps/api` (Fastify)

## Quick Health Checks
```bash
curl -sf http://localhost:4000/health && echo "API OK"
curl -sf http://localhost:3000/ && echo "WEB OK"
```

## Auth & Session
- Login page loads: `/portal/login`
- Login works (owner/admin/agent)
- Logout works
- Session persists on refresh
- Route protection:
  - Unauthed user redirected away from `/portal/*`
  - Authed user can access `/portal`

## Portal Shell / Navigation
- Sidebar renders with correct active state
- Mobile sidebar opens/closes and does not block scrolling after close
- Notification bell opens/closes; no console spam
- Language switcher works (EN/TR/ES) and does not break layout

## Inbox Core Flow
URL: `/portal/inbox`
- Conversation list loads:
  - Empty state looks correct when no conversations
  - Loading state present (no layout jumps)
- Selecting a conversation:
  - Messages render in correct order
  - Scroll behavior is correct (no stuck scroll)
- Sending a message:
  - Send works
  - Disabled state while sending
  - Error toast on network failure
- Real-time updates:
  - New messages appear without refresh (if socket enabled)

## Customer Context Panel
- Panel renders for selected conversation
- Attributes/metadata readable on desktop and mobile
- Notes UI does not overflow and remains usable

## Settings Hub + Modules
URL: `/portal/settings`
- Settings hub loads without errors
- Each module page loads (no blank pages):
  - `/portal/settings/general`
  - `/portal/settings/appearance`
  - `/portal/settings/installation`
  - `/portal/settings/chat-page`
  - `/portal/settings/translations`
  - `/portal/settings/channels`
  - `/portal/settings/notifications`
  - `/portal/settings/operating-hours`
  - `/portal/settings/macros`
  - `/portal/settings/workflows`
  - `/portal/settings/sla`
  - `/portal/settings/sessions`
  - `/portal/settings/api-keys`

## Plan Gating / Entitlements (UI + API)
- Free org:
  - Gated sections are visually dimmed + CTA to upgrade
  - Save buttons disabled where required
  - API calls return 403 for restricted writes
- Starter/Pro/Business org:
  - Gated sections unlock correctly
  - Upgrade banners do not show incorrectly
- AI quota:
  - `/portal/ai/quota` returns correct limit/used
  - Over-limit shows friendly messaging and blocks appropriately

## Billing
URL: `/portal/billing`
- Billing page loads and displays current plan
- Checkout link works (if Stripe configured)
- Customer portal link works (if configured)

## Security
URL: `/portal/security`
- MFA setup flow loads: `/portal/mfa-setup`
- Devices page loads: `/portal/security/devices`
- No sensitive info rendered in client logs

## Performance / A11y Smoke Checks
- No major layout shifts in hero/header/sidebar/inbox
- Tab key navigation works in:
  - Header menus
  - Inbox conversation list
  - Message composer
- Focus ring visible on interactive elements

