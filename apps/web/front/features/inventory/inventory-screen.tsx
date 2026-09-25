"use client";

import { catalogKey, useCatalog } from "@/front/features/catalog/catalog-store";
import { InventoryExperience } from "./inventory-experience";

/** Remounts the stock screen when the saved catalog replaces the sample one (hydration or another tab). */
export function InventoryScreen() {
  const catalog = useCatalog();
  return <InventoryExperience key={catalogKey(catalog)} initialItems={catalog.stockItems} />;
}
