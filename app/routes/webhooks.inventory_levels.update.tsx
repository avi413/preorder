import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getWaitlistByVariant,
  markWaitlistNotified,
} from "../services/waitlist.service";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    const inventoryItemId = (payload as any).inventory_item_id;
    const available = (payload as any).available;

    if (!inventoryItemId || available === undefined) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Only process if inventory is now available (> 0)
    if (available > 0) {
      // Query Shopify to get all variants using this inventory item
      const variantsResponse = await admin.graphql(
        `#graphql
          query getVariantsByInventoryItem($inventoryItemId: ID!) {
            inventoryItem(id: $inventoryItemId) {
              id
              variant {
                id
                product {
                  id
                  title
                }
              }
            }
          }`,
        {
          variables: {
            inventoryItemId: `gid://shopify/InventoryItem/${inventoryItemId}`,
          },
        }
      );

      const variantsData = await variantsResponse.json();
      const inventoryItem = variantsData.data?.inventoryItem;

      if (inventoryItem?.variant?.id) {
        const variantId = inventoryItem.variant.id;
        const productTitle = inventoryItem.variant.product?.title || "Product";

        // Get all waitlist entries for this variant
        const waitlistEntries = await getWaitlistByVariant(shop, variantId);

        if (waitlistEntries.length > 0) {
          const entryIds = waitlistEntries.map((e) => e.id);
          const emails = waitlistEntries.map((e) => e.email);

          // TODO: Send email notifications here
          // For now, we'll just log and mark as notified
          console.log(
            `Notifying ${waitlistEntries.length} customers about ${productTitle} being back in stock`
          );
          console.log(`Emails: ${emails.join(", ")}`);

          // Mark entries as notified
          await markWaitlistNotified(entryIds);
        }
      }
    }

    return new Response();
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal server error", { status: 500 });
  }
};
