/**
 * Widget Analytics Routes (Step 11.35)
 *
 * Portal: GET /portal/widget/health   — org-scoped widget health
 * Admin:  GET /internal/metrics/widget-health-summary — global summary
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalUser } from "../middleware/require-portal-user";
import { requireAdmin } from "../middleware/require-admin";
import { parseHistogram, computePercentile } from "../utils/widget-histogram";

// ─── Status logic (deterministic) ────────────────────────────
function computeWidgetStatus(org: {
  firstWidgetEmbedAt: Date | null;
  lastWidgetSeenAt: Date | null;
  widgetLoadsTotal: number;
  widgetLoadFailuresTotal: number;
  widgetDomainMismatchTotal: number;
}): "OK" | "NEEDS_ATTENTION" | "NOT_CONNECTED" {
  // NOT_CONNECTED: never embedded or never seen
  if (!org.firstWidgetEmbedAt || !org.lastWidgetSeenAt) {
    return "NOT_CONNECTED";
  }

  // NEEDS_ATTENTION checks
  const lastSeenAge = Date.now() - new Date(org.lastWidgetSeenAt).getTime();
  const olderThan24h = lastSeenAge > 24 * 60 * 60 * 1000;

  if (olderThan24h) return "NEEDS_ATTENTION";
  if (org.widgetDomainMismatchTotal > 0) return "NEEDS_ATTENTION";
  if (
    org.widgetLoadsTotal > 0 &&
    org.widgetLoadFailuresTotal / org.widgetLoadsTotal >= 0.05
  ) {
    return "NEEDS_ATTENTION";
  }

  return "OK";
}

export async function widgetAnalyticsRoutes(fastify: FastifyInstance) {
  // ─── Portal: Widget Health ─────────────────────────────────
  fastify.get(
    "/portal/widget/health",
    { preHandler: [requirePortalUser] },
    async (request) => {
      const user = (request as any).portalUser!;
      const orgId: string = user.orgId;

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          widgetLoadsTotal: true,
          widgetLoadFailuresTotal: true,
          widgetDomainMismatchTotal: true,
          widgetRtBucketsJson: true,
          widgetRtTotalCount: true,
          lastWidgetSeenAt: true,
          firstWidgetEmbedAt: true,
        },
      });

      if (!org) {
        return { error: "Organization not found" };
      }

      const status = computeWidgetStatus(org);

      // Compute p50/p95 from histogram
      const buckets = parseHistogram(org.widgetRtBucketsJson);
      const p50 = computePercentile(buckets, org.widgetRtTotalCount, 50);
      const p95 = computePercentile(buckets, org.widgetRtTotalCount, 95);

      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      return {
        status,
        lastSeenAt: org.lastWidgetSeenAt?.toISOString() || null,
        loads: { total: org.widgetLoadsTotal, failures: org.widgetLoadFailuresTotal },
        domainMismatch: { total: org.widgetDomainMismatchTotal },
        responseTime: { p50, p95 },
        requestId,
      };
    }
  );

  // ─── Admin: Widget Health Summary ──────────────────────────
  fastify.get(
    "/internal/metrics/widget-health-summary",
    { preHandler: [requireAdmin] },
    async (request) => {
      // Fetch all orgs for status classification + aggregation
      const allOrgs = await prisma.organization.findMany({
        select: {
          id: true,
          key: true,
          name: true,
          firstWidgetEmbedAt: true,
          lastWidgetSeenAt: true,
          widgetLoadsTotal: true,
          widgetLoadFailuresTotal: true,
          widgetDomainMismatchTotal: true,
        },
      });

      let loadsTotal = 0;
      let failuresTotal = 0;
      let domainMismatchTotal = 0;
      let connectedOrgs = 0;
      let okCount = 0;
      let needsAttentionCount = 0;
      let notConnectedCount = 0;

      // Last-seen distribution
      const now = Date.now();
      let seenNever = 0;
      let seenLt1h = 0;
      let seenLt24h = 0;
      let seenLt7d = 0;
      let seenGte7d = 0;

      // Spike detection candidates
      const spikeOrgs: { key: string; failures: number; loads: number; domainMismatch: number }[] = [];

      for (const org of allOrgs) {
        loadsTotal += org.widgetLoadsTotal;
        failuresTotal += org.widgetLoadFailuresTotal;
        domainMismatchTotal += org.widgetDomainMismatchTotal;

        if (org.widgetLoadsTotal > 0) connectedOrgs++;

        const status = computeWidgetStatus(org);
        if (status === "OK") okCount++;
        else if (status === "NEEDS_ATTENTION") needsAttentionCount++;
        else notConnectedCount++;

        // Last-seen distribution
        if (!org.lastWidgetSeenAt) {
          seenNever++;
        } else {
          const age = now - new Date(org.lastWidgetSeenAt).getTime();
          if (age < 60 * 60 * 1000) seenLt1h++;
          else if (age < 24 * 60 * 60 * 1000) seenLt24h++;
          else if (age < 7 * 24 * 60 * 60 * 1000) seenLt7d++;
          else seenGte7d++;
        }

        // Suspicious spike detection
        const hasFailureSpike =
          org.widgetLoadFailuresTotal >= 50 &&
          org.widgetLoadsTotal > 0 &&
          org.widgetLoadFailuresTotal / org.widgetLoadsTotal >= 0.2;
        const hasDomainSpike = org.widgetDomainMismatchTotal >= 20;
        if (hasFailureSpike || hasDomainSpike) {
          spikeOrgs.push({
            key: org.key,
            failures: org.widgetLoadFailuresTotal,
            loads: org.widgetLoadsTotal,
            domainMismatch: org.widgetDomainMismatchTotal,
          });
        }
      }

      // Top 5 by failures
      const topByFailures = [...allOrgs]
        .filter((o) => o.widgetLoadFailuresTotal > 0)
        .sort((a, b) => b.widgetLoadFailuresTotal - a.widgetLoadFailuresTotal)
        .slice(0, 5)
        .map((o) => ({
          orgKey: o.key,
          orgName: o.name,
          failuresTotal: o.widgetLoadFailuresTotal,
          loadsTotal: o.widgetLoadsTotal,
          lastSeenAt: o.lastWidgetSeenAt?.toISOString() || null,
        }));

      // Top 5 by domain mismatch
      const topByDomainMismatch = [...allOrgs]
        .filter((o) => o.widgetDomainMismatchTotal > 0)
        .sort((a, b) => b.widgetDomainMismatchTotal - a.widgetDomainMismatchTotal)
        .slice(0, 5)
        .map((o) => ({
          orgKey: o.key,
          orgName: o.name,
          domainMismatchTotal: o.widgetDomainMismatchTotal,
          lastSeenAt: o.lastWidgetSeenAt?.toISOString() || null,
        }));

      const requestId =
        (request as any).requestId ||
        (request.headers["x-request-id"] as string) ||
        undefined;

      // Best-effort audit log
      try {
        const adminUser = (request as any).adminUser;
        const firstOrg = allOrgs[0];
        if (firstOrg) {
          await prisma.auditLog.create({
            data: {
              orgId: firstOrg.id,
              actor: adminUser?.email || "admin",
              action: "admin.metrics.widget_health_summary.read",
              details: {
                requestId,
                orgsTotal: allOrgs.length,
                connectedOrgs,
                loadsTotal,
                failuresTotal,
              },
            },
          });
        }
      } catch {
        /* best-effort */
      }

      // Best-effort spike audit logs (never block response)
      if (spikeOrgs.length > 0) {
        Promise.resolve().then(async () => {
          for (const spike of spikeOrgs) {
            try {
              const spikeOrg = allOrgs.find((o) => o.key === spike.key);
              if (spikeOrg) {
                await prisma.auditLog.create({
                  data: {
                    orgId: spikeOrg.id,
                    actor: "system",
                    action: "security.widget_health_spike",
                    details: {
                      orgKey: spike.key,
                      failuresTotal: spike.failures,
                      loadsTotal: spike.loads,
                      domainMismatchTotal: spike.domainMismatch,
                      requestId,
                    },
                  },
                });
              }
            } catch {
              /* best-effort */
            }
          }
        }).catch(() => {});
      }

      return {
        totals: {
          orgsTotal: allOrgs.length,
          connectedOrgs,
          loadsTotal,
          failuresTotal,
          domainMismatchTotal,
          okCount,
          needsAttentionCount,
          notConnectedCount,
        },
        topByFailures,
        topByDomainMismatch,
        lastSeenDistribution: {
          never: seenNever,
          lt1h: seenLt1h,
          lt24h: seenLt24h,
          lt7d: seenLt7d,
          gte7d: seenGte7d,
        },
        requestId,
      };
    }
  );
}
