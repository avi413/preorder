import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  HeadersFunction,
} from "react-router";
import { json, redirect, useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getSubscription, setSubscription, PLAN_LIMITS } from "../services/billing.service";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const subscription = await getSubscription(session.shop);
  return json({ subscription });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const plan = formData.get("plan") as string;

  if (!plan || !["FREE", "BASIC", "PRO"].includes(plan)) {
    return json({ error: "Invalid plan" }, { status: 400 });
  }

  // If FREE plan, just set it directly
  if (plan === "FREE") {
    await setSubscription(session.shop, plan as "FREE" | "BASIC" | "PRO");
    return redirect("/app");
  }

  // For paid plans, create Shopify billing session
  const prices = {
    BASIC: "9.99",
    PRO: "29.99",
  };

  const planNames = {
    BASIC: "Basic Plan",
    PRO: "Pro Plan",
  };

  try {
    // Create recurring application charge using GraphQL
    const returnUrl = `${process.env.SHOPIFY_APP_URL || ""}/app/billing/callback?plan=${plan}`;
    
    const billingResponse = await admin.graphql(
      `#graphql
        mutation createRecurringApplicationCharge($input: RecurringApplicationChargeInput!) {
          recurringApplicationChargeCreate(input: $input) {
            recurringApplicationCharge {
              id
              confirmationUrl
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        variables: {
          input: {
            name: planNames[plan as "BASIC" | "PRO"],
            price: parseFloat(prices[plan as "BASIC" | "PRO"]),
            returnUrl: returnUrl,
            test: process.env.NODE_ENV !== "production",
          },
        },
      }
    );

    const billingData = await billingResponse.json();
    const charge = billingData.data?.recurringApplicationChargeCreate?.recurringApplicationCharge;

    if (charge?.confirmationUrl) {
      return redirect(charge.confirmationUrl);
    }

    const errors = billingData.data?.recurringApplicationChargeCreate?.userErrors || [];
    return json({ error: errors[0]?.message || "Failed to create billing" }, { status: 400 });
  } catch (error) {
    console.error("Billing error:", error);
    return json({ error: "Failed to process billing" }, { status: 500 });
  }
};

export default function Billing() {
  const { subscription } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const handleActivate = (plan: string) => {
    const form = document.createElement("form");
    form.method = "POST";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "plan";
    input.value = plan;
    form.appendChild(input);
    fetcher.submit(new FormData(form), { method: "POST" });
  };

  return (
    <s-page heading="Billing & Subscription">
      <s-section heading="Current Plan">
        <s-paragraph>
          <strong>Plan:</strong> {subscription.plan} | <strong>Status:</strong> {subscription.status}
        </s-paragraph>
      </s-section>

      <s-section heading="Choose Your Plan">
        <s-stack direction="block" gap="large">
          <s-box
            padding="large"
            borderWidth="base"
            borderRadius="base"
            background={subscription.plan === "FREE" ? "highlight" : "base"}
          >
            <s-stack direction="block" gap="base">
              <s-heading>FREE</s-heading>
              <s-heading size="large">$0/month</s-heading>
              <s-unordered-list>
                <s-list-item>Max 1 pre-order product</s-list-item>
                <s-list-item>Max 20 waitlist emails</s-list-item>
              </s-unordered-list>
              <s-button
                variant={subscription.plan === "FREE" ? "primary" : "secondary"}
                onClick={() => handleActivate("FREE")}
                disabled={subscription.plan === "FREE"}
                loading={fetcher.state === "submitting"}
              >
                {subscription.plan === "FREE" ? "Current Plan" : "Choose Plan"}
              </s-button>
            </s-stack>
          </s-box>

          <s-box
            padding="large"
            borderWidth="base"
            borderRadius="base"
            background={subscription.plan === "BASIC" ? "highlight" : "base"}
          >
            <s-stack direction="block" gap="base">
              <s-heading>BASIC</s-heading>
              <s-heading size="large">$9.99/month</s-heading>
              <s-unordered-list>
                <s-list-item>Unlimited pre-order products</s-list-item>
                <s-list-item>500 waitlist emails limit</s-list-item>
              </s-unordered-list>
              <s-button
                variant={subscription.plan === "BASIC" ? "primary" : "secondary"}
                onClick={() => handleActivate("BASIC")}
                disabled={subscription.plan === "BASIC"}
                loading={fetcher.state === "submitting"}
              >
                {subscription.plan === "BASIC" ? "Current Plan" : "Choose Plan"}
              </s-button>
            </s-stack>
          </s-box>

          <s-box
            padding="large"
            borderWidth="base"
            borderRadius="base"
            background={subscription.plan === "PRO" ? "highlight" : "base"}
          >
            <s-stack direction="block" gap="base">
              <s-heading>PRO</s-heading>
              <s-heading size="large">$29.99/month</s-heading>
              <s-unordered-list>
                <s-list-item>Unlimited pre-order products</s-list-item>
                <s-list-item>Unlimited waitlist emails</s-list-item>
                <s-list-item>Priority support</s-list-item>
              </s-unordered-list>
              <s-button
                variant={subscription.plan === "PRO" ? "primary" : "secondary"}
                onClick={() => handleActivate("PRO")}
                disabled={subscription.plan === "PRO"}
                loading={fetcher.state === "submitting"}
              >
                {subscription.plan === "PRO" ? "Current Plan" : "Choose Plan"}
              </s-button>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
