import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { json, redirect } from "react-router";
import { authenticate } from "../shopify.server";
import { requireActivePlan, Plan } from "../services/billing.service";

/**
 * Middleware to protect routes based on subscription plan
 */
export async function requirePlan(
  request: Request,
  allowedPlans: Plan[]
): Promise<{ allowed: boolean; subscription?: any }> {
  const { session } = await authenticate.admin(request);
  const allowed = await requireActivePlan(session.shop, allowedPlans);
  
  if (!allowed) {
    return { allowed: false };
  }

  return { allowed: true };
}

/**
 * Wrapper for loader functions that require specific plans
 */
export function withPlanProtection(
  loader: (args: LoaderFunctionArgs) => Promise<Response>,
  allowedPlans: Plan[]
) {
  return async (args: LoaderFunctionArgs) => {
    const { allowed } = await requirePlan(args.request, allowedPlans);
    
    if (!allowed) {
      return redirect("/app/billing?upgrade_required=true");
    }

    return loader(args);
  };
}

/**
 * Wrapper for action functions that require specific plans
 */
export function withPlanProtectionAction(
  action: (args: ActionFunctionArgs) => Promise<Response>,
  allowedPlans: Plan[]
) {
  return async (args: ActionFunctionArgs) => {
    const { allowed } = await requirePlan(args.request, allowedPlans);
    
    if (!allowed) {
      return json(
        { error: "Upgrade required. Please upgrade your plan to access this feature." },
        { status: 403 }
      );
    }

    return action(args);
  };
}
