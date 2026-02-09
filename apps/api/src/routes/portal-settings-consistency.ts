import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requirePortalRole, requirePortalUser } from "../middleware/require-portal-user";
import { createRateLimitMiddleware } from "../middleware/rate-limit";

type ConsistencyIssue = {
  code: string;
  severity: "warning" | "error";
  message: string;
};

export async function portalSettingsConsistencyRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/portal/settings/consistency",
    {
      preHandler: [
        requirePortalUser,
        requirePortalRole(["owner", "admin", "agent"]),
        createRateLimitMiddleware({ limit: 30, windowMs: 60000 }),
      ],
    },
    async (request) => {
      const actor = request.portalUser!;
      const [hours, workflows, sla, channels] = await Promise.all([
        prisma.operatingHours.findUnique({
          where: { orgId: actor.orgId },
          include: { days: true },
        }),
        prisma.workflowRule.findMany({
          where: { orgId: actor.orgId, enabled: true },
        }),
        prisma.slaPolicy.findFirst({
          where: { orgId: actor.orgId, enabled: true },
        }),
        prisma.channelConfig.findMany({
          where: { orgId: actor.orgId },
        }),
      ]);

      const issues: ConsistencyIssue[] = [];

      if (hours?.enabled) {
        const openDays = hours.days.filter((d) => d.isOpen).length;
        if (openDays === 0) {
          issues.push({
            code: "OPERATING_HOURS_NO_OPEN_DAY",
            severity: "error",
            message: "Operating hours enabled but no open day configured.",
          });
        }
        if (hours.offHoursAutoReply && !hours.offHoursReplyText?.trim()) {
          issues.push({
            code: "OFF_HOURS_REPLY_EMPTY",
            severity: "warning",
            message: "Off-hours auto-reply is enabled but reply text is empty.",
          });
        }
      }

      workflows.forEach((wf) => {
        const actions = (wf.actionsJson || {}) as Record<string, unknown>;
        if (!actions.autoReplyText && !actions.closeConversation && actions.assignToOrgUserId === undefined) {
          issues.push({
            code: "WORKFLOW_NO_ACTION",
            severity: "warning",
            message: `Workflow '${wf.name}' has no actionable step.`,
          });
        }
      });

      if (sla && sla.firstResponseMinutes > sla.resolutionMinutes) {
        issues.push({
          code: "SLA_FIRST_RESPONSE_GT_RESOLUTION",
          severity: "error",
          message: "SLA first response target cannot be greater than resolution target.",
        });
      }

      const externalChannelsEnabled = channels.filter(
        (ch) => ch.enabled && ch.channelType !== "live_chat" && ch.channelType !== "email"
      );
      if (externalChannelsEnabled.length > 0) {
        issues.push({
          code: "EXTERNAL_CHANNEL_REVIEW_REQUIRED",
          severity: "warning",
          message: "External channels enabled. Verify integration credentials are configured.",
        });
      }

      return {
        ok: issues.length === 0,
        issues,
      };
    }
  );
}
