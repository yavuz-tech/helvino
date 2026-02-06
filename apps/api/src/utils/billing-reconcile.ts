import Stripe from "stripe";
import { prisma } from "../prisma";
import {
  getStripeClient,
  isStripeConfigured,
  mapPriceToplanKey,
  StripeNotConfiguredError,
} from "./stripe";

type ReconcileOptions = {
  dryRun?: boolean;
  timeoutMs?: number;
  graceDays?: number;
};

export type ReconcileOrgResult = {
  orgId: string;
  orgKey: string;
  updated: boolean;
  dryRun: boolean;
  changes: string[];
  error?: string;
  summary?: Record<string, unknown>;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Stripe request timeout"));
    }, timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function mapStripeStatus(status?: string | null): string {
  switch (status) {
    case "trialing":
    case "active":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
      return status;
    default:
      return "none";
  }
}

function isActiveStatus(status?: string | null) {
  return status === "active" || status === "trialing";
}

function isPastDueStatus(status?: string | null) {
  return status === "past_due" || status === "unpaid";
}

function parseDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function sameValue(a: unknown, b: unknown) {
  if (a instanceof Date && b instanceof Date) {
    return a.toISOString() === b.toISOString();
  }
  return a === b;
}

function pickSubscription(subs: Stripe.ApiList<Stripe.Subscription>) {
  if (!subs.data.length) return null;
  const priority = (s: Stripe.Subscription) =>
    isActiveStatus(s.status) ? 1 : isPastDueStatus(s.status) ? 2 : 3;
  return subs.data
    .slice()
    .sort((a, b) => {
      const p = priority(a) - priority(b);
      if (p !== 0) return p;
      return (b.created || 0) - (a.created || 0);
    })[0];
}

function latestInvoiceFailed(
  invoice?: Stripe.Invoice | string | null
): boolean {
  if (!invoice || typeof invoice === "string") return false;
  if (invoice.status === "open") return true;
  if (invoice.paid === false && invoice.attempted) return true;
  return false;
}

export async function reconcileOrgBilling(
  orgId: string,
  options: ReconcileOptions = {}
): Promise<ReconcileOrgResult> {
  const timeoutMs = options.timeoutMs || 8000;
  const graceDays =
    options.graceDays || parseInt(process.env.GRACE_DAYS || "7", 10);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org) {
    return {
      orgId,
      orgKey: "",
      updated: false,
      dryRun: Boolean(options.dryRun),
      changes: [],
      error: "Organization not found",
    };
  }

  if (!isStripeConfigured()) {
    throw new StripeNotConfiguredError();
  }

  if (!org.stripeCustomerId) {
    return {
      orgId: org.id,
      orgKey: org.key,
      updated: false,
      dryRun: Boolean(options.dryRun),
      changes: [],
      error: "No stripeCustomerId",
    };
  }

  const stripe = getStripeClient();
  const now = new Date();

  try {
    await withTimeout(
      stripe.customers.retrieve(org.stripeCustomerId),
      timeoutMs
    );

    const subs = await withTimeout(
      stripe.subscriptions.list({
        customer: org.stripeCustomerId,
        status: "all",
        limit: 10,
        expand: ["data.latest_invoice"],
      }),
      timeoutMs
    );

    const selected = pickSubscription(subs);
    const selectedStatus = selected ? mapStripeStatus(selected.status) : "none";
    const latestInvoiceFailedFlag = selected
      ? latestInvoiceFailed(selected.latest_invoice as Stripe.Invoice | string)
      : false;

    const updateData: Record<string, unknown> = {};
    const changes: string[] = [];

    const setField = (key: string, value: unknown) => {
      const current = (org as any)[key];
      if (!sameValue(current, value)) {
        updateData[key] = value;
        changes.push(key);
      }
    };

    if (!selected) {
      setField("billingStatus", "none");
      setField("planStatus", "inactive");
      setField("stripeSubscriptionId", null);
      setField("stripePriceId", null);
      setField("currentPeriodEnd", null);
      setField("cancelAtPeriodEnd", false);
      setField("trialEndsAt", null);
      setField("planKey", "free");
    } else {
      const priceId = selected.items?.data?.[0]?.price?.id || null;
      const mappedPlan = priceId ? await mapPriceToplanKey(priceId) : null;
      const planKey = mappedPlan || org.planKey || "free";

      const planStatus = isActiveStatus(selected.status)
        ? "active"
        : isPastDueStatus(selected.status)
          ? "past_due"
          : selected.status === "canceled"
            ? "canceled"
            : "inactive";

      setField("billingStatus", selectedStatus);
      setField("planStatus", planStatus);
      setField("stripeSubscriptionId", selected.id);
      setField("stripePriceId", priceId);
      setField("planKey", planKey);
      setField(
        "currentPeriodEnd",
        selected.current_period_end
          ? new Date(selected.current_period_end * 1000)
          : null
      );
      setField("cancelAtPeriodEnd", Boolean(selected.cancel_at_period_end));
      setField(
        "trialEndsAt",
        selected.trial_end ? new Date(selected.trial_end * 1000) : null
      );

      if (isActiveStatus(selected.status)) {
        setField("lastPaymentFailureAt", null);
        setField("graceEndsAt", null);
        setField("billingLockedAt", null);
      } else if (isPastDueStatus(selected.status) || latestInvoiceFailedFlag) {
        setField("lastPaymentFailureAt", now);

        const existingGrace = parseDate(org.graceEndsAt);
        if (existingGrace) {
          if (now > existingGrace) {
            setField("billingLockedAt", org.billingLockedAt || now);
          }
          setField("graceEndsAt", existingGrace);
        } else {
          const newGrace = new Date(
            now.getTime() + graceDays * 24 * 60 * 60 * 1000
          );
          setField("graceEndsAt", newGrace);
        }
      }
    }

    const summary = {
      subscriptionStatus: selectedStatus,
      priceId: selected?.items?.data?.[0]?.price?.id || null,
      planKey: updateData.planKey || org.planKey,
      changes,
    };

    setField("lastBillingReconcileAt", now);
    setField("lastBillingReconcileResult", summary);

    if (options.dryRun) {
      return {
        orgId: org.id,
        orgKey: org.key,
        updated: false,
        dryRun: true,
        changes,
        summary,
      };
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.organization.update({
        where: { id: org.id },
        data: updateData,
      });
    }

    return {
      orgId: org.id,
      orgKey: org.key,
      updated: Object.keys(updateData).length > 0,
      dryRun: false,
      changes,
      summary,
    };
  } catch (error) {
    return {
      orgId: org.id,
      orgKey: org.key,
      updated: false,
      dryRun: Boolean(options.dryRun),
      changes: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
