import type { ActionFunctionArgs } from "react-router";
import { json } from "react-router";
import { authenticate } from "../shopify.server";
import { addToWaitlist } from "../services/waitlist.service";

export const action = async ({ request }: ActionFunctionArgs) => {
  // This endpoint can be called from storefront, so we need to handle unauthenticated requests
  // For storefront, we'll extract shop domain from request headers or body
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { shopDomain, productId, variantId, email } = body;

  if (!shopDomain || !productId || !variantId || !email) {
    return json(
      { error: "shopDomain, productId, variantId, and email are required" },
      { status: 400 }
    );
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return json({ error: "Invalid email address" }, { status: 400 });
  }

  const entry = await addToWaitlist({
    shopDomain,
    productId,
    variantId,
    email,
  });

  return json({ success: true, entry });
};
