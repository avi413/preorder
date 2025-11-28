import { useState } from "react";
import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { json, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getWaitlistEntries, deleteWaitlistEntry } from "../services/waitlist.service";
import { getSubscription, getPlanLimits } from "../services/billing.service";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const entries = await getWaitlistEntries(session.shop);
  const subscription = await getSubscription(session.shop);
  const limits = getPlanLimits(subscription.plan);

  // Fetch product/variant details for display
  const productIds = [...new Set(entries.map((e) => e.productId))];
  const variantIds = [...new Set(entries.map((e) => e.variantId))];

  // Note: In production, you'd want to batch these queries
  const entriesWithDetails = await Promise.all(
    entries.map(async (entry) => {
      try {
        const productResponse = await admin.graphql(
          `#graphql
            query getProduct($id: ID!) {
              product(id: $id) {
                id
                title
                handle
                variants(first: 1, query: "id:${entry.variantId}") {
                  edges {
                    node {
                      id
                      title
                      price
                    }
                  }
                }
              }
            }`,
          {
            variables: { id: entry.productId },
          }
        );
        const productData = await productResponse.json();
        return {
          ...entry,
          productTitle: productData.data?.product?.title || "Unknown",
          variantTitle: productData.data?.product?.variants?.edges[0]?.node?.title || "Default",
        };
      } catch {
        return {
          ...entry,
          productTitle: "Unknown",
          variantTitle: "Unknown",
        };
      }
    })
  );

  return json({
    entries: entriesWithDetails,
    subscription,
    limits,
  });
};

export default function BackInStock() {
  const { entries, subscription, limits } = useLoaderData<typeof loader>();
  const [filter, setFilter] = useState<{ productId?: string; variantId?: string }>({});

  const filteredEntries = entries.filter((entry) => {
    if (filter.productId && entry.productId !== filter.productId) return false;
    if (filter.variantId && entry.variantId !== filter.variantId) return false;
    return true;
  });

  const handleExport = () => {
    const csv = [
      ["Email", "Product", "Variant", "Notified", "Date"].join(","),
      ...filteredEntries.map((entry) =>
        [
          entry.email,
          entry.productTitle,
          entry.variantTitle,
          entry.notified ? "Yes" : "No",
          new Date(entry.createdAt).toLocaleDateString(),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitlist-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this entry?")) {
      await fetch(`/api/waitlist/${id}`, { method: "DELETE" });
      window.location.reload();
    }
  };

  return (
    <s-page heading="Back-In-Stock Waitlist">
      <s-section heading={`Current Plan: ${subscription.plan}`}>
        <s-paragraph>
          Waitlist Limit: {limits.maxWaitlistEmails === Infinity ? "Unlimited" : limits.maxWaitlistEmails}
        </s-paragraph>
        <s-paragraph>
          Total Entries: {entries.length} | Notified: {entries.filter((e) => e.notified).length}
        </s-paragraph>
      </s-section>

      <s-section heading="Waitlist Entries">
        <s-stack direction="inline" gap="base" align="end">
          <s-button onClick={handleExport}>Export to CSV</s-button>
        </s-stack>

        {filteredEntries.length === 0 ? (
          <s-paragraph>No waitlist entries found.</s-paragraph>
        ) : (
          <s-table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Product</th>
                <th>Variant</th>
                <th>Notified</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.email}</td>
                  <td>{entry.productTitle}</td>
                  <td>{entry.variantTitle}</td>
                  <td>{entry.notified ? "Yes" : "No"}</td>
                  <td>{new Date(entry.createdAt).toLocaleDateString()}</td>
                  <td>
                    <s-button
                      variant="tertiary"
                      onClick={() => handleDelete(entry.id)}
                    >
                      Delete
                    </s-button>
                  </td>
                </tr>
              ))}
            </tbody>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
