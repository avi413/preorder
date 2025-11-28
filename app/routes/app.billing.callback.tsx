import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
import { setSubscription } from "../services/billing.service";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const plan = url.searchParams.get("plan") as "FREE" | "BASIC" | "PRO" | null;
  const chargeId = url.searchParams.get("charge_id");

  if (!plan || !["FREE", "BASIC", "PRO"].includes(plan)) {
    return redirect("/app/billing");
  }

  // For FREE plan, just set it directly
  if (plan === "FREE") {
    await setSubscription(session.shop, plan, "active");
    return redirect("/app?billing=success");
  }

  // For paid plans, verify the charge was accepted
  // The charge_id might be in the URL or we need to query active charges
  try {
    // Query for active recurring charges
    const chargesResponse = await admin.graphql(
      `#graphql
        query getRecurringApplicationCharges {
          currentAppInstallation {
            activeSubscriptions {
              id
              name
              status
              currentPeriodEnd
            }
          }
        }`
    );

    const chargesData = await chargesResponse.json();
    const activeSubscriptions = chargesData.data?.currentAppInstallation?.activeSubscriptions || [];

    // Check if there's an active subscription matching our plan
    const planNames = {
      BASIC: "Basic Plan",
      PRO: "Pro Plan",
    };
    
    const activeSubscription = activeSubscriptions.find(
      (sub: any) => sub.name === planNames[plan as "BASIC" | "PRO"] && sub.status === "ACTIVE"
    );

    if (activeSubscription || chargeId) {
      // Charge is active, save subscription
      await setSubscription(session.shop, plan, "active");
      return redirect("/app?billing=success");
    }
  } catch (error) {
    console.error("Error verifying charge:", error);
  }

  return redirect("/app/billing?error=activation_failed");
};
