import prisma from "../db.server";

export interface PreOrderSettings {
  shopDomain: string;
  productId: string;
  variantId: string;
  enabled: boolean;
  expectedDate?: Date | null;
  limitQuantity?: number | null;
  customText?: string | null;
}

export async function getPreOrders(shopDomain: string) {
  return prisma.preOrderSetting.findMany({
    where: { shopDomain },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPreOrderByVariant(
  shopDomain: string,
  variantId: string
) {
  return prisma.preOrderSetting.findFirst({
    where: {
      shopDomain,
      variantId,
    },
  });
}

export async function savePreOrder(settings: PreOrderSettings) {
  const existing = await prisma.preOrderSetting.findFirst({
    where: {
      shopDomain: settings.shopDomain,
      productId: settings.productId,
      variantId: settings.variantId,
    },
  });

  if (existing) {
    return prisma.preOrderSetting.update({
      where: { id: existing.id },
      data: {
        enabled: settings.enabled,
        expectedDate: settings.expectedDate,
        limitQuantity: settings.limitQuantity,
        customText: settings.customText,
      },
    });
  }

  return prisma.preOrderSetting.create({
    data: settings,
  });
}

export async function deletePreOrder(id: string) {
  return prisma.preOrderSetting.delete({
    where: { id },
  });
}
