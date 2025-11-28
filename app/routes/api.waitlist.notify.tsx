import type { ActionFunctionArgs } from "react-router";
import { json } from "react-router";
import { authenticate } from "../shopify.server";
import { getWaitlistByVariant, markWaitlistNotified } from "../services/waitlist.service";

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { shopDomain, variantId } = body;

  if (!shopDomain || !variantId) {
    return json(
      { error: "shopDomain and variantId are required" },
      { status: 400 }
    );
  }

  const entries = await getWaitlistByVariant(shopDomain, variantId);
  const entryIds = entries.map((e) => e.id);

  if (entryIds.length > 0) {
    // TODO: Send email notifications here
    // For now, just mark as notified
    await markWaitlistNotified(entryIds);
  }

  return json({ success: true, notified: entryIds.length });
};
