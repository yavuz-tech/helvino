# STEP 11.52 — Widget Appearance Studio

## Overview

Widget Appearance Studio allows organizations to customize their widget's visual appearance and messaging through a Portal UI with live preview. Settings are stored per-organization in a new `WidgetSettings` table and are served via the bootloader endpoint to the widget.

## Database Schema

### WidgetSettings Model

```prisma
model WidgetSettings {
  id             String       @id @default(cuid())
  orgId          String       @unique
  primaryColor   String       @default("#0F5C5C")
  position       String       @default("right") // "right" | "left"
  launcher       String       @default("bubble") // "bubble" | "icon"
  welcomeTitle   String       @default("Welcome") @db.VarChar(60)
  welcomeMessage String       @default("How can we help you today?") @db.VarChar(240)
  brandName      String?      @db.VarChar(40)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([orgId])
  @@map("widget_settings")
}
```

**Relation**: 1:1 with Organization (via `orgId`)

**Defaults**: If no settings exist for an org, API returns safe defaults without auto-creating DB row.

## API Endpoints

All endpoints require portal auth (`requirePortalUser` middleware).

### GET /portal/widget/settings

Returns widget appearance settings for the authenticated user's organization.

**Response (200)**:
```json
{
  "settings": {
    "primaryColor": "#0F5C5C",
    "position": "right",
    "launcher": "bubble",
    "welcomeTitle": "Welcome",
    "welcomeMessage": "How can we help you today?",
    "brandName": null
  },
  "requestId": "..."
}
```

**Notes**:
- Returns defaults if no row exists (does NOT auto-create)
- Rate limit: 100 req/min

### PUT /portal/widget/settings

Updates widget appearance settings (upsert operation).

**Request Body**:
```json
{
  "primaryColor": "#FF5733",
  "position": "left",
  "launcher": "icon",
  "welcomeTitle": "Hello!",
  "welcomeMessage": "We're here to help",
  "brandName": "Acme Inc"
}
```

**Validations**:
- `primaryColor`: Must be valid hex format (`#RGB` or `#RRGGBB`)
- `position`: Must be `"right"` or `"left"`
- `launcher`: Must be `"bubble"` or `"icon"`
- `welcomeTitle`: Max 60 characters
- `welcomeMessage`: Max 240 characters
- `brandName`: Max 40 characters (nullable)

**Response (200)**:
```json
{
  "ok": true,
  "settings": { /* updated settings */ },
  "requestId": "..."
}
```

**Audit Log**: Writes `widget.settings.updated` event (best-effort)

**Rate limit**: 20 req/min

## Bootloader Integration

The `/api/bootloader` endpoint now includes `widgetSettings` in its response:

```json
{
  "ok": true,
  "org": { "id": "...", "key": "...", "name": "..." },
  "config": {
    "widgetEnabled": true,
    "writeEnabled": true,
    "aiEnabled": true,
    "language": "en",
    "theme": { "primaryColor": "#0F5C5C" },
    "branding": { ... },
    "widgetSettings": {
      "primaryColor": "#0F5C5C",
      "position": "right",
      "launcher": "bubble",
      "welcomeTitle": "Welcome",
      "welcomeMessage": "How can we help you today?",
      "brandName": null
    }
  },
  "orgToken": "...",
  "env": "production",
  "timestamp": "..."
}
```

**Implementation**:
- Bootloader fetches `WidgetSettings` from DB
- If no row exists, returns defaults (non-breaking)
- Settings are server-trusted (not client-provided)

## Portal UI

### Route: `/portal/widget-appearance`

**Features**:
- Form controls for all widget settings
- Color picker + hex input for `primaryColor`
- Radio buttons for `position` and `launcher`
- Text inputs with character counters for titles/messages
- **Live Preview Panel**: Real-time widget mockup showing:
  - Widget launcher button (styled with selected color/position/launcher)
  - Simulated widget window with welcome title/message
  - Brand name in header
- "Save Changes" button (disabled for non-owner/admin roles)
- Success/error notifications

**Access Control**:
- View: All portal users
- Edit: `owner` and `admin` roles only

**Navigation**:
- Added to `PortalLayout` nav as "Widget Appearance"

## i18n Keys

All keys added with EN/TR/ES parity:

```
widgetAppearance.title
widgetAppearance.subtitle
widgetAppearance.primaryColor
widgetAppearance.position
widgetAppearance.positionRight
widgetAppearance.positionLeft
widgetAppearance.launcher
widgetAppearance.launcherBubble
widgetAppearance.launcherIcon
widgetAppearance.welcomeTitle
widgetAppearance.welcomeMessage
widgetAppearance.brandName
widgetAppearance.save
widgetAppearance.saved
widgetAppearance.preview
common.invalidColor
common.saveFailed
```

## Non-Breaking Changes

- ✅ No changes to auth flows or org scoping
- ✅ No changes to widget token flow
- ✅ No changes to existing route behavior
- ✅ Bootloader response extended (backward-compatible)
- ✅ New optional table (organizations continue working without it)
- ✅ New portal route (`/portal/widget-appearance`) — no conflicts

## Migration

**File**: `20260207030000_v11_52_widget_appearance_settings/migration.sql`

Creates `widget_settings` table with unique constraint on `orgId`.

**Apply**:
```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

## Files Changed

### API
- `apps/api/prisma/schema.prisma` — Added `WidgetSettings` model
- `apps/api/prisma/migrations/20260207030000_v11_52_widget_appearance_settings/migration.sql` — Migration
- `apps/api/src/routes/portal-widget-settings.ts` — **NEW** endpoints
- `apps/api/src/routes/bootloader.ts` — Extended response with `widgetSettings`
- `apps/api/src/index.ts` — Registered new routes

### Web
- `apps/web/src/app/portal/widget-appearance/page.tsx` — **NEW** Portal UI with live preview
- `apps/web/src/components/PortalLayout.tsx` — Added nav link
- `apps/web/src/i18n/translations.ts` — Added i18n keys (EN/TR/ES)

### Docs
- `docs/STEP_11_52_WIDGET_APPEARANCE_STUDIO.md` — This file
- `VERIFY_STEP_11_52.sh` — **NEW** verification script

## Verification

Run `bash VERIFY_STEP_11_52.sh` to validate:
- Prisma schema includes `WidgetSettings`
- Migration exists
- API routes file exists
- Bootloader includes `widgetSettings` in code
- Portal page exists
- Nav link exists
- i18n keys present with EN/TR/ES parity
- Builds pass
