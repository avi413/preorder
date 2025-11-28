import type { LoaderFunctionArgs } from "react-router";
import { json } from "react-router";
import { authenticate } from "../shopify.server";
import { getWaitlistEntries } from "../services/waitlist.service";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const { shopDomain } = params;

  if (!shopDomain) {
    return json({ error: "Shop domain is required" }, { status: 400 });
  }

  const entries = await getWaitlistEntries(shopDomain);
  return json({ entries });
};
