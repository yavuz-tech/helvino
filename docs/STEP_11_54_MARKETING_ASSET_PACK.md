# STEP 11.54 — Marketing Asset Pack + Crisp-like Visual Language (Web Only)

**Date:** 2026-02-07  
**Status:** ✅ COMPLETE  

---

## Overview

This release introduces a **local marketing asset pack** and a **design token module** to deliver a cohesive, premium, Crisp-like visual language across public and key product surfaces. The change is visibly noticeable across landing, pricing, portal, inbox, and admin screens.

**Important:** Web-only.  
**No backend/API/auth/route changes were made.**

---

## Marketing Asset Pack (Local, No Hotlinks)

**Folder:** `apps/web/public/marketing/`

**Assets added (SVG):**
- `gradient-hero-1.svg` — abstract gradient background
- `gradient-hero-2.svg` — abstract gradient background
- `blob-mesh-1.svg` — soft mesh overlay
- `blob-mesh-2.svg` — soft mesh overlay
- `mock-dashboard.svg` — product mock screenshot (dashboard)
- `mock-inbox.svg` — product mock screenshot (inbox)
- `icon-spark.svg` — decorative spark icon
- `icon-shield.svg` — decorative shield icon

All assets are **local SVGs** (no external runtime loads).

---

## Design Tokens (No CSS File)

**File:** `apps/web/src/lib/designTokens.ts`

Exports Tailwind class strings only:
- Brand colors (teal + soft blue)
- Gradient helpers (hero/accent)
- Card border/shadow styles
- Button variants (primary/secondary/ghost)
- Chips/pill styles

---

## Page-by-Page Visual Changes

### Public — `/`
- Hero background upgraded with gradient + overlay SVG assets.
- CTA group uses premium teal gradient.
- Trust strip converted to pill chips.
- New product preview block using `mock-dashboard.svg`.
- Feature cards unified with `FeatureCard` styling.

### Public — `/pricing`
- Hero uses marketing background + mock preview (`mock-inbox.svg`).
- Trust strip uses pill chips with decorative icons.
- Plan cards use stronger borders and premium CTA styling.
- FAQ spacing and card styling aligned with new tokens.

### Portal — `/portal`
- Page header and stat cards aligned with new card tokens.
- Card surfaces use elevated variants and stronger borders.

### Portal — `/portal/inbox`
- Split view updated with premium toolbar styling and clearer selection.
- Tabs and controls aligned with the new token system.

### Admin — `/dashboard` & `/dashboard/orgs`
- Cards and tables use consistent radius/shadow/border.
- Buttons aligned with primary teal styling.

---

## Non-Breaking Confirmation

✅ No API changes  
✅ No Prisma changes  
✅ No auth changes  
✅ No route behavior changes  
✅ All existing functionality preserved  

---

## Notes

No new i18n strings were added for this release. All visual changes use existing translations.
