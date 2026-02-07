# Step 11.34 — Widget UX & Embed Onboarding

## Overview
Adds widget first-run experience, embed setup checklist, contextual empty/error states, and soft conversion nudges to the Portal.

## Components Added

| Component | Path | Purpose |
|---|---|---|
| `WidgetStatusBanner` | `components/WidgetStatusBanner.tsx` | Shows widget connection status (loading/ready/error) |
| `EmbedChecklist` | `components/EmbedChecklist.tsx` | Step-by-step guide for embed setup with progress |
| `WidgetEmptyState` | `components/WidgetEmptyState.tsx` | Contextual empty states for widget scenarios |
| `ConversationNudge` | `components/ConversationNudge.tsx` | Soft nudge to start a test conversation |

## Behavior

### Widget Status Banner
- Shows "ready" status when widget has been embedded but no conversation yet
- Dismissible (does not persist across page reloads)
- Uses conversion signals from `/portal/billing/status`

### Embed Checklist
- 3-step progress: copy snippet, configure domains, widget connected
- Progress bar + completion counter
- Copy-to-clipboard action
- Link to security settings for domain configuration
- Status derived from org data + conversion signals

### Conversation Nudge
- Appears 5 seconds after page load if widget is connected but no conversations
- Dismissible (persists in sessionStorage)
- Non-intrusive (indigo info banner)

### Widget Empty States
- `not-loaded`: Widget hasn't been embedded yet (CTA: copy snippet)
- `error`: Widget failed to connect (CTA: retry)
- `domain-not-authorized`: Domain not in allowlist (CTA: configure domains)

## i18n
All strings use `t()` with keys prefixed `widget.*` and `embed.*` across EN/TR/ES.

## No Breaking Changes
- No API changes
- No auth/billing/security flow changes
- All new UI is additive to existing portal overview page
