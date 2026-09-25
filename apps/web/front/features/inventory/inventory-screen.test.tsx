import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CATALOG } from "@/front/features/catalog/catalog-mocks";
import { saveCatalog } from "@/front/features/catalog/catalog-store";
import { InventoryScreen } from "./inventory-screen";

afterEach(cleanup);

describe("InventoryScreen", () => {
  it("lists stock items created through the Cardápio", () => {
    saveCatalog({
      ...CATALOG,
      stockItems: [...CATALOG.stockItems, { id: "copo-700-ml", name: "Copo 700 ml", category: "insumo", unit: "un", balance: 0, minimum: 0 }],
    });
    render(<InventoryScreen />);
    expect(screen.getByRole("listitem", { name: "Copo 700 ml" })).toBeInTheDocument();
  });
});
