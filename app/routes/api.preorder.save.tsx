import type { ActionFunctionArgs } from "react-router";
import { json } from "react-router";
import { authenticate } from "../shopify.server";
import { savePreOrder } from "../services/preorder.service";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await request.json();
  const { productId, variantId, enabled, expectedDate, limitQuantity, customText } = body;

  if (!productId || !variantId) {
    return json({ error: "Product ID and Variant ID are required" }, { status: 400 });
  }

  const shopDomain = session.shop;

  const preOrder = await savePreOrder({
    shopDomain,
    productId,
    variantId,
    enabled: enabled ?? false,
    expectedDate: expectedDate ? new Date(expectedDate) : null,
    limitQuantity: limitQuantity ? parseInt(limitQuantity, 10) : null,
    customText: customText || null,
  });

  return json({ preOrder });
};
