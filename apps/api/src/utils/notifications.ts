/**
 * In-App Notification Helper — Step 11.43 + 11.44 + 11.45
 *
 * Server-side only. Creates notifications with per-user preference enforcement and robust dedupe.
 */

import { prisma } from "../prisma";
import { writeAuditLog } from "./audit-log";

export type NotificationSeverity = "INFO" | "WARN" | "CRITICAL";
export type NotificationCategory = "SECURITY" | "WIDGET_HEALTH" | "BILLING" | "SYSTEM";

export interface CreateNotificationInput {
  orgId: string;
  titleKey: string;
  bodyKey: string;
  vars?: Record<string, unknown>; // vars to pass in meta for template substitution
  category: NotificationCategory;
  severity: NotificationSeverity;
  sourceAction?: string; // e.g. "mfa.enabled", "billing.locked"
  target: "all" | "owners" | "userId";
  userId?: string; // required when target="userId"
  requestId?: string;
}

// Dedupe window: skip if same fingerprint within this period
const DEDUPE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Create notification fingerprint for dedupe
 */
function getFingerprint(input: CreateNotificationInput): string {
  return [
    input.orgId,
    input.category,
    input.severity,
    input.sourceAction || "none",
    input.titleKey,
  ].join("::");
}

/**
 * Get preference field name from category
 */
function categoryToPrefField(category: NotificationCategory): "securityEnabled" | "billingEnabled" | "widgetEnabled" | null {
  switch (category) {
    case "SECURITY": return "securityEnabled";
    case "BILLING": return "billingEnabled";
    case "WIDGET_HEALTH": return "widgetEnabled";
    case "SYSTEM": return null; // always show
    default: return null;
  }
}

/**
 * Get eligible users based on target and preferences
 */
async function getEligibleUsers(
  orgId: string,
  target: string,
  userId: string | undefined,
  category: NotificationCategory
): Promise<string[]> {
  const prefField = categoryToPrefField(category);

  // Target="userId"
  if (target === "userId" && userId) {
    if (!prefField) return [userId]; // SYSTEM always delivered
    const pref = await prisma.notificationPreference.findUnique({
      where: { orgUserId: userId },
      select: { [prefField]: true },
    });
    const enabled = pref ? (pref as any)[prefField] : true;
    return enabled ? [userId] : [];
  }

  // Target="all" or "owners"
  const roleFilter = target === "owners" ? ["owner", "admin"] : undefined;
  const users = await prisma.orgUser.findMany({
    where: {
      orgId,
      ...(roleFilter ? { role: { in: roleFilter } } : {}),
    },
    select: { id: true },
  });

  // Filter by preferences
  if (!prefField) return users.map((u) => u.id); // SYSTEM always delivered

  const prefs = await prisma.notificationPreference.findMany({
    where: {
      orgUserId: { in: users.map((u) => u.id) },
    },
    select: { orgUserId: true, [prefField]: true },
  });

  const enabledUserIds = prefs
    .filter((p) => (p as any)[prefField] === true)
    .map((p) => p.orgUserId);

  // Users without prefs default to enabled
  const userIdsWithoutPrefs = users
    .map((u) => u.id)
    .filter((id) => !prefs.find((p) => p.orgUserId === id));

  return [...enabledUserIds, ...userIdsWithoutPrefs];
}

/**
 * Create notifications for multiple users (org-scoped, preference-enforced, deduped).
 * Never throws — best-effort.
 */
export async function createNotificationForOrgUsers(
  input: CreateNotificationInput
): Promise<void> {
  try {
    const fingerprint = getFingerprint(input);
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);

    // Dedupe: check if same fingerprint was created recently
    const existing = await prisma.notification.findFirst({
      where: {
        orgId: input.orgId,
        type: input.category, // Prisma field is "type", not "category"
        severity: input.severity,
        sourceAction: input.sourceAction ?? null,
        titleKey: input.titleKey,
        createdAt: { gte: since },
      },
      select: { id: true },
    });

    if (existing) {
      // Skip — already sent recently
      return;
    }

    // Get eligible users
    const userIds = await getEligibleUsers(
      input.orgId,
      input.target,
      input.userId,
      input.category
    );

    if (userIds.length === 0) {
      // No eligible users (all disabled this category)
      return;
    }

    // Create org-wide or user-specific notifications
    if (input.target === "all" || input.target === "owners") {
      // Create one org-wide notification (userId=null)
      await prisma.notification.create({
        data: {
          orgId: input.orgId,
          userId: null,
          severity: input.severity,
          type: input.category,
          sourceAction: input.sourceAction ?? null,
          titleKey: input.titleKey,
          bodyKey: input.bodyKey,
          metaJson: input.vars ? JSON.parse(JSON.stringify(input.vars)) : undefined,
        },
      });
    } else {
      // Create per-user notification
      for (const uid of userIds) {
        await prisma.notification.create({
          data: {
            orgId: input.orgId,
            userId: uid,
            severity: input.severity,
            type: input.category,
            sourceAction: input.sourceAction ?? null,
            titleKey: input.titleKey,
            bodyKey: input.bodyKey,
            metaJson: input.vars ? JSON.parse(JSON.stringify(input.vars)) : undefined,
          },
        });
      }
    }

    // Audit log (best-effort)
    writeAuditLog(
      input.orgId,
      "system",
      "notifications.emitted",
      {
        category: input.category,
        severity: input.severity,
        sourceAction: input.sourceAction,
        targetCount: userIds.length,
        requestId: input.requestId,
      },
      input.requestId
    ).catch(() => {});
  } catch (err) {
    // Best-effort — never break the main flow
    console.error("Notification create error:", err);
  }
}

// ── Convenience wrappers for common scenarios ──

export async function emitMfaEnabled(orgId: string, userId: string, requestId?: string) {
  await createNotificationForOrgUsers({
    orgId,
    titleKey: "notif.security.mfaEnabled.title",
    bodyKey: "notif.security.mfaEnabled.body",
    category: "SECURITY",
    severity: "INFO",
    sourceAction: "mfa.enabled",
    target: "userId",
    userId,
    requestId,
  });
}

export async function emitMfaDisabled(orgId: string, userId: string, requestId?: string) {
  await createNotificationForOrgUsers({
    orgId,
    titleKey: "notif.security.mfaDisabled.title",
    bodyKey: "notif.security.mfaDisabled.body",
    category: "SECURITY",
    severity: "WARN",
    sourceAction: "mfa.disabled",
    target: "userId",
    userId,
    requestId,
  });
}

export async function emitPasskeyRegistered(orgId: string, userId: string, requestId?: string) {
  await createNotificationForOrgUsers({
    orgId,
    titleKey: "notif.security.passkeyRegistered.title",
    bodyKey: "notif.security.passkeyRegistered.body",
    category: "SECURITY",
    severity: "INFO",
    sourceAction: "passkey.registered",
    target: "userId",
    userId,
    requestId,
  });
}

export async function emitPasskeyRevoked(orgId: string, userId: string, requestId?: string) {
  await createNotificationForOrgUsers({
    orgId,
    titleKey: "notif.security.passkeyRevoked.title",
    bodyKey: "notif.security.passkeyRevoked.body",
    category: "SECURITY",
    severity: "WARN",
    sourceAction: "passkey.revoked",
    target: "userId",
    userId,
    requestId,
  });
}

export async function emitNewDeviceSignIn(orgId: string, userId: string, requestId?: string) {
  await createNotificationForOrgUsers({
    orgId,
    titleKey: "notif.security.newDevice.title",
    bodyKey: "notif.security.newDevice.body",
    category: "SECURITY",
    severity: "INFO",
    sourceAction: "device.new",
    target: "userId",
    userId,
    requestId,
  });
}

export async function emitRecoveryApproved(orgId: string, userId: string, requestId?: string) {
  await createNotificationForOrgUsers({
    orgId,
    titleKey: "notif.security.recoveryApproved.title",
    bodyKey: "notif.security.recoveryApproved.body",
    category: "SECURITY",
    severity: "INFO",
    sourceAction: "recovery.approved",
    target: "userId",
    userId,
    requestId,
  });
}

export async function emitRecoveryRejected(orgId: string, userId: string, requestId?: string) {
  await createNotificationForOrgUsers({
    orgId,
    titleKey: "notif.security.recoveryRejected.title",
    bodyKey: "notif.security.recoveryRejected.body",
    category: "SECURITY",
    severity: "WARN",
    sourceAction: "recovery.rejected",
    target: "userId",
    userId,
    requestId,
  });
}

export async function emitEmergencyTokenUsed(orgId: string, requestId?: string) {
  await createNotificationForOrgUsers({
    orgId,
    titleKey: "notif.security.emergencyUsed.title",
    bodyKey: "notif.security.emergencyUsed.body",
    category: "SECURITY",
    severity: "CRITICAL",
    sourceAction: "emergency.token_used",
    target: "owners",
    requestId,
  });
}

export async function emitBillingGraceStarted(orgId: string, requestId?: string) {
  await createNotificationForOrgUsers({
    orgId,
    titleKey: "notif.billing.graceStarted.title",
    bodyKey: "notif.billing.graceStarted.body",
    category: "BILLING",
    severity: "WARN",
    sourceAction: "billing.grace_started",
    target: "owners",
    requestId,
  });
}

export async function emitBillingLocked(orgId: string, requestId?: string) {
  await createNotificationForOrgUsers({
    orgId,
    titleKey: "notif.billing.locked.title",
    bodyKey: "notif.billing.locked.body",
    category: "BILLING",
    severity: "CRITICAL",
    sourceAction: "billing.locked",
    target: "owners",
    requestId,
  });
}

export async function emitBillingUnlocked(orgId: string, requestId?: string) {
  await createNotificationForOrgUsers({
    orgId,
    titleKey: "notif.billing.unlocked.title",
    bodyKey: "notif.billing.unlocked.body",
    category: "BILLING",
    severity: "INFO",
    sourceAction: "billing.unlocked",
    target: "owners",
    requestId,
  });
}

export async function emitWidgetNeedsAttention(orgId: string, requestId?: string) {
  await createNotificationForOrgUsers({
    orgId,
    titleKey: "notif.widgetHealth.needsAttention.title",
    bodyKey: "notif.widgetHealth.needsAttention.body",
    category: "WIDGET_HEALTH",
    severity: "WARN",
    sourceAction: "widget.needs_attention",
    target: "owners",
    requestId,
  });
}
