import type { LoaderFunctionArgs } from "react-router";
import { json } from "react-router";
import { getPreOrders } from "../services/preorder.service";

/**
 * Public API endpoint for storefront to fetch pre-order settings
 * No authentication required - shop domain is in URL
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { shopDomain } = params;

  if (!shopDomain) {
    return json({ error: "Shop domain is required" }, { status: 400 });
  }

  const preOrders = await getPreOrders(shopDomain);
  return json({ preOrders });
};
