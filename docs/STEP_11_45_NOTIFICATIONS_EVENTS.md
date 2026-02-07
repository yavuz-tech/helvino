# STEP 11.45 — In-App Notifications: Event Wiring + Severity + Preference Enforcement

## Goal

Wire key security/billing/widget events into actionable in-app notifications with:
- Per-user read state (from Step 11.44)
- Per-user preferences enforcement (from Step 11.44)
- Consistent event emission with severity/category + anti-spam dedupe

## Prisma Changes

### Notification Model Extensions
- **sourceAction** (string?, optional): Traceability field for linking notification to originating event (e.g. `"mfa.enabled"`, `"billing.locked"`)
- **Migration**: `20260206250000_v11_45_notification_source_action`

### Fields Summary
- **id**: CUID
- **orgId**: FK to Organization
- **userId**: optional (null => org-wide)
- **severity**: "INFO" | "WARN" | "CRITICAL"
- **type**: "SECURITY" | "WIDGET_HEALTH" | "BILLING" | "SYSTEM" (category)
- **sourceAction**: optional traceability string
- **titleKey** / **bodyKey**: i18n keys
- **metaJson**: optional metadata
- **createdAt**: timestamp
- **readAt**: deprecated (per-user read state now in NotificationRead)
- **reads**: relation to NotificationRead[]

## API (apps/api)

### Notification Utilities (`apps/api/src/utils/notifications.ts`)

#### `createNotificationForOrgUsers(input: CreateNotificationInput): Promise<void>`
Central notification emission with:
- **Preference enforcement**: honors NotificationPreference toggles per category
- **Dedupe**: 30-minute window based on (orgId + category + severity + sourceAction + titleKey)
- **Target audience**: "all" | "owners" | "userId"
- **Best-effort audit logging**: action = "notifications.emitted"

#### Convenience Wrappers
Pre-wired helpers for common events:
- `emitMfaEnabled(orgId, userId, requestId?)`
- `emitMfaDisabled(orgId, userId, requestId?)`
- `emitPasskeyRegistered(orgId, userId, requestId?)`
- `emitPasskeyRevoked(orgId, userId, requestId?)`
- `emitNewDeviceSignIn(orgId, userId, requestId?)` *(note: not fully wired due to device fingerprinting complexity)*
- `emitRecoveryApproved(orgId, userId, requestId?)`
- `emitRecoveryRejected(orgId, userId, requestId?)`
- `emitEmergencyTokenUsed(orgId, requestId?)`
- `emitBillingGraceStarted(orgId, requestId?)`
- `emitBillingLocked(orgId, requestId?)`
- `emitBillingUnlocked(orgId, requestId?)`
- `emitWidgetNeedsAttention(orgId, requestId?)`

### Event Wiring (where notifications are emitted)

| Event | File | Trigger | Notification | Severity | Target |
|-------|------|---------|-------------|----------|--------|
| **MFA Enabled** | `portal-mfa.ts` | POST `/portal/security/mfa/verify` | `mfaEnabled` | INFO | userId |
| **MFA Disabled** | `portal-mfa.ts` | POST `/portal/security/mfa/disable` | `mfaDisabled` | WARN | userId |
| **Passkey Registered** | `webauthn-routes.ts` | POST `/portal/webauthn/register/verify` | `passkeyRegistered` | INFO | userId |
| **Passkey Revoked** | `webauthn-routes.ts` | POST `/portal/webauthn/credentials/:id/revoke` | `passkeyRevoked` | WARN | userId |
| **Recovery Approved** | `recovery-routes.ts` | POST `/internal/recovery/:id/approve` | `recoveryApproved` | INFO | userId |
| **Recovery Rejected** | `recovery-routes.ts` | POST `/internal/recovery/:id/reject` | `recoveryRejected` | WARN | userId |
| **Emergency Token Used** | `recovery-routes.ts` | POST `/portal/emergency/use` | `emergencyUsed` | CRITICAL | owners |
| **Billing Locked** | `internal-admin.ts` | POST `/internal/org/:key/billing/lock` | `billingLocked` | CRITICAL | owners |
| **Billing Unlocked** | `internal-admin.ts` | POST `/internal/org/:key/billing/unlock` | `billingUnlocked` | INFO | owners |
| **Widget Domain Mismatch** | `domain-allowlist.ts` | Domain not allowed | `widgetNeedsAttention` | WARN | owners |

### Portal Notifications Endpoints

#### `GET /portal/notifications`
**Query Params**:
- `limit`: 1–100 (default 25)
- `cursor`: pagination
- `unreadOnly`: "1" for unread only
- **category**: optional filter ("security" | "billing" | "widget" | "system")

**Response**:
```json
{
  "items": [
    {
      "id": "...",
      "createdAt": "...",
      "severity": "INFO" | "WARN" | "CRITICAL",
      "type": "SECURITY" | "WIDGET_HEALTH" | "BILLING" | "SYSTEM",
      "category": "...", // alias for backward compat
      "sourceAction": "mfa.enabled",
      "titleKey": "notif.security.mfaEnabled.title",
      "bodyKey": "notif.security.mfaEnabled.body",
      "meta": {},
      "readAt": "..." | null
    }
  ],
  "nextCursor": "..." | undefined,
  "unreadCount": 0,
  "requestId": "..."
}
```

## Web (apps/web)

### Notifications Page (`/portal/notifications`)

**Features**:
- **Category filter dropdown**: All / Security / Billing / Widget / System
- **Tab filter**: All / Unread
- **Category + Severity badges** displayed on each item
- **Preferences section** (from Step 11.44) preserved
- **Mark all as read** / **Load More** buttons

**UI Components**:
- Severity pill with icon (Info/Warn/Critical)
- Category pill (gray badge)
- Type icon (Shield/Activity/CreditCard/Settings)
- Read/unread state visual indicator

## i18n (EN/TR/ES)

New keys added:
- `notifications.filter.category`
- `notifications.filter.unreadOnly`
- `notifications.category.security`
- `notifications.category.billing`
- `notifications.category.widget`
- `notifications.category.system`
- `notif.security.mfaEnabled.title/.body`
- `notif.security.mfaDisabled.title/.body`
- `notif.security.passkeyRegistered.title/.body`
- `notif.security.passkeyRevoked.title/.body`
- `notif.security.newDevice.title/.body`
- `notif.security.recoveryApproved.title/.body`
- `notif.security.recoveryRejected.title/.body`
- `notif.security.emergencyUsed.title/.body`
- `notif.billing.graceStarted.title/.body`
- `notif.billing.locked.title/.body`
- `notif.billing.unlocked.title/.body`

## Security / RBAC

- All notification mutations honor `NotificationPreference` per user
- Dedupe prevents spam (30-min window)
- No client trust: all emissions are server-side only
- Audit logs include `notifications.emitted` action with counts
- RequestId propagation maintained throughout

## Verification

See `VERIFY_STEP_11_45.sh`:
- Prisma model fields present
- Migration exists
- Notification utility pattern checks
- Route registration checks
- API endpoints return category/severity/sourceAction fields
- Web UI category filter present
- i18n parity checks (EN/TR/ES)
- Smoke tests for auth + shape validation
