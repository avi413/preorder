import prisma from "../db.server";

export interface WaitlistEntry {
  shopDomain: string;
  productId: string;
  variantId: string;
  email: string;
}

export async function addToWaitlist(entry: WaitlistEntry) {
  // Check if already exists
  const existing = await prisma.stockWaitlist.findFirst({
    where: {
      shopDomain: entry.shopDomain,
      variantId: entry.variantId,
      email: entry.email,
      notified: false,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.stockWaitlist.create({
    data: entry,
  });
}

export async function getWaitlistEntries(shopDomain: string) {
  return prisma.stockWaitlist.findMany({
    where: { shopDomain },
    orderBy: { createdAt: "desc" },
  });
}

export async function getWaitlistByVariant(
  shopDomain: string,
  variantId: string
) {
  return prisma.stockWaitlist.findMany({
    where: {
      shopDomain,
      variantId,
      notified: false,
    },
  });
}

export async function markWaitlistNotified(ids: string[]) {
  return prisma.stockWaitlist.updateMany({
    where: {
      id: { in: ids },
    },
    data: {
      notified: true,
    },
  });
}

export async function deleteWaitlistEntry(id: string) {
  return prisma.stockWaitlist.delete({
    where: { id },
  });
}
