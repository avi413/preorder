import type { ActionFunctionArgs } from "react-router";
import { json } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteWaitlistEntry } from "../services/waitlist.service";

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    return json({ error: "ID is required" }, { status: 400 });
  }

  if (request.method !== "DELETE") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  await deleteWaitlistEntry(id);
  return json({ success: true });
};
