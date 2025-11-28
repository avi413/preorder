import prisma from "../db.server";

export type Plan = "FREE" | "BASIC" | "PRO";
export type SubscriptionStatus = "active" | "cancelled";

export interface Subscription {
  shopDomain: string;
  plan: Plan;
  status: SubscriptionStatus;
}

export const PLAN_LIMITS = {
  FREE: {
    maxPreOrders: 1,
    maxWaitlistEmails: 20,
  },
  BASIC: {
    maxPreOrders: Infinity,
    maxWaitlistEmails: 500,
  },
  PRO: {
    maxPreOrders: Infinity,
    maxWaitlistEmails: Infinity,
  },
};

export async function getSubscription(shopDomain: string) {
  const subscription = await prisma.billingSubscription.findUnique({
    where: { shopDomain },
  });

  // Default to FREE plan if no subscription exists
  if (!subscription) {
    return {
      shopDomain,
      plan: "FREE" as Plan,
      status: "active" as SubscriptionStatus,
    };
  }

  return subscription;
}

export async function setSubscription(
  shopDomain: string,
  plan: Plan,
  status: SubscriptionStatus = "active"
) {
  const existing = await prisma.billingSubscription.findUnique({
    where: { shopDomain },
  });

  if (existing) {
    return prisma.billingSubscription.update({
      where: { shopDomain },
      data: { plan, status },
    });
  }

  return prisma.billingSubscription.create({
    data: { shopDomain, plan, status },
  });
}

export async function requireActivePlan(
  shopDomain: string,
  allowedPlans: Plan[]
): Promise<boolean> {
  const subscription = await getSubscription(shopDomain);
  return (
    subscription.status === "active" && allowedPlans.includes(subscription.plan)
  );
}

export function getPlanLimits(plan: Plan) {
  return PLAN_LIMITS[plan];
}
