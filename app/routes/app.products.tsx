import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  HeadersFunction,
} from "react-router";
import { json, useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getPreOrders, savePreOrder } from "../services/preorder.service";
import { getSubscription, getPlanLimits } from "../services/billing.service";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Fetch products from Shopify
  const productsResponse = await admin.graphql(
    `#graphql
      query getProducts {
        products(first: 50) {
          edges {
            node {
              id
              title
              handle
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    price
                    inventoryQuantity
                    sku
                  }
                }
              }
            }
          }
        }
      }`
  );

  const productsData = await productsResponse.json();
  const products = productsData.data?.products?.edges || [];

  // Get pre-order settings
  const preOrders = await getPreOrders(session.shop);

  // Get subscription to check limits
  const subscription = await getSubscription(session.shop);
  const limits = getPlanLimits(subscription.plan);

  return json({
    products: products.map((edge: any) => edge.node),
    preOrders,
    subscription,
    limits,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const productId = formData.get("productId") as string;
  const variantId = formData.get("variantId") as string;
  const enabled = formData.get("enabled") === "true";
  const expectedDate = formData.get("expectedDate") as string | null;
  const limitQuantity = formData.get("limitQuantity") as string | null;
  const customText = formData.get("customText") as string | null;

  // Check plan limits
  const subscription = await getSubscription(session.shop);
  const limits = getPlanLimits(subscription.plan);

  if (enabled && limits.maxPreOrders !== Infinity) {
    const existingPreOrders = await getPreOrders(session.shop);
    const activeCount = existingPreOrders.filter((po) => po.enabled).length;
    if (activeCount >= limits.maxPreOrders) {
      return json(
        {
          error: `Plan limit reached. Maximum ${limits.maxPreOrders} pre-order product(s) allowed.`,
        },
        { status: 403 }
      );
    }
  }

  const preOrder = await savePreOrder({
    shopDomain: session.shop,
    productId,
    variantId,
    enabled,
    expectedDate: expectedDate ? new Date(expectedDate) : null,
    limitQuantity: limitQuantity ? parseInt(limitQuantity, 10) : null,
    customText: customText || null,
  });

  return json({ success: true, preOrder });
};

export default function Products() {
  const { products, preOrders, subscription, limits } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Pre-order settings saved");
      window.location.reload();
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const toggleProduct = (productId: string) => {
    const newSet = new Set(expandedProducts);
    if (newSet.has(productId)) {
      newSet.delete(productId);
    } else {
      newSet.add(productId);
    }
    setExpandedProducts(newSet);
  };

  const getPreOrderForVariant = (variantId: string) => {
    return preOrders.find((po) => po.variantId === variantId);
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <s-page heading="Pre-Order Management">
      <s-section heading={`Current Plan: ${subscription.plan}`}>
        <s-paragraph>
          Pre-Order Limit: {limits.maxPreOrders === Infinity ? "Unlimited" : limits.maxPreOrders}
        </s-paragraph>
      </s-section>

      <s-section heading="Products">
        {products.length === 0 ? (
          <s-paragraph>No products found. Create products in your Shopify admin.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {products.map((product: any) => {
              const isExpanded = expandedProducts.has(product.id);
              return (
                <s-box
                  key={product.id}
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                >
                  <s-stack direction="block" gap="tight">
                    <s-stack direction="inline" gap="base" align="space-between">
                      <s-heading>{product.title}</s-heading>
                      <s-button
                        variant="tertiary"
                        onClick={() => toggleProduct(product.id)}
                      >
                        {isExpanded ? "Collapse" : "Expand"}
                      </s-button>
                    </s-stack>

                    {isExpanded && (
                      <s-stack direction="block" gap="base">
                        {product.variants.edges.map((variantEdge: any) => {
                          const variant = variantEdge.node;
                          const preOrder = getPreOrderForVariant(variant.id);
                          return (
                            <s-box
                              key={variant.id}
                              padding="base"
                              background="subdued"
                              borderRadius="base"
                            >
                              <fetcher.Form method="POST" onSubmit={handleSave}>
                                <input type="hidden" name="productId" value={product.id} />
                                <input type="hidden" name="variantId" value={variant.id} />
                                <s-stack direction="block" gap="base">
                                  <s-heading size="small">
                                    {variant.title || "Default"}
                                  </s-heading>
                                  <s-paragraph>
                                    Price: ${variant.price} | Stock: {variant.inventoryQuantity ?? "N/A"}
                                  </s-paragraph>

                                  <s-stack direction="block" gap="tight">
                                    <s-checkbox
                                      name="enabled"
                                      value="true"
                                      defaultChecked={preOrder?.enabled}
                                    >
                                      Enable Pre-Order
                                    </s-checkbox>

                                    <s-text-field
                                      name="expectedDate"
                                      label="Expected Date"
                                      type="date"
                                      defaultValue={
                                        preOrder?.expectedDate
                                          ? new Date(preOrder.expectedDate).toISOString().split("T")[0]
                                          : ""
                                      }
                                    />

                                    <s-text-field
                                      name="limitQuantity"
                                      label="Limit Quantity"
                                      type="number"
                                      defaultValue={preOrder?.limitQuantity?.toString() || ""}
                                    />

                                    <s-text-field
                                      name="customText"
                                      label="Custom Text"
                                      multiline
                                      rows={3}
                                      defaultValue={preOrder?.customText || ""}
                                    />

                                    <s-button
                                      type="submit"
                                      variant="primary"
                                      loading={fetcher.state === "submitting"}
                                    >
                                      Save Settings
                                    </s-button>
                                  </s-stack>
                                </s-stack>
                              </fetcher.Form>
                            </s-box>
                          );
                        })}
                      </s-stack>
                    )}
                  </s-stack>
                </s-box>
              );
            })}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
