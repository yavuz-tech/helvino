import { prisma } from "../prisma";
import { store } from "../store";

type WorkflowTrigger = "message_created" | "conversation_created" | "conversation_closed";

type WorkflowContext = {
  orgId: string;
  conversationId: string;
  actorRole?: "user" | "assistant";
};

type WorkflowActions = {
  autoReplyText?: string;
  closeConversation?: boolean;
  assignToOrgUserId?: string | null;
};

export async function runWorkflowsForTrigger(
  trigger: WorkflowTrigger,
  context: WorkflowContext
): Promise<void> {
  const rules = await prisma.workflowRule.findMany({
    where: {
      orgId: context.orgId,
      trigger,
      enabled: true,
    },
    orderBy: { createdAt: "asc" },
  });

  for (const rule of rules) {
    const actions = (rule.actionsJson || {}) as WorkflowActions;

    if (actions.autoReplyText && context.actorRole === "user") {
      await store.addMessage(context.conversationId, context.orgId, "assistant", actions.autoReplyText);
    }

    if (actions.assignToOrgUserId !== undefined) {
      await prisma.conversation.updateMany({
        where: { id: context.conversationId, orgId: context.orgId },
        data: { assignedToOrgUserId: actions.assignToOrgUserId },
      });
    }

    if (actions.closeConversation) {
      await prisma.conversation.updateMany({
        where: { id: context.conversationId, orgId: context.orgId },
        data: { status: "CLOSED", closedAt: new Date() },
      });
    }
  }
}
