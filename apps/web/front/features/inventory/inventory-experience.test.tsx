import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InventoryExperience } from "./inventory-experience";

afterEach(cleanup);

function lowStockBanner() {
  return screen.getByRole("region", { name: "Itens com estoque baixo" });
}

function itemRow(name: string) {
  return screen.getByRole("listitem", { name });
}

function registerEntrada(itemName: string, quantity: string, reason: string) {
  fireEvent.click(screen.getByRole("button", { name: `Movimentar ${itemName}` }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(/quantidade recebida/i), { target: { value: quantity } });
  fireEvent.change(within(dialog).getByLabelText("Justificativa"), { target: { value: reason } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Salvar movimentação" }));
}

describe("InventoryExperience", () => {
  it("lists the low and empty items in the alert banner", () => {
    render(<InventoryExperience />);
    const banner = lowStockBanner();
    expect(within(banner).getByText(/4 itens precisam de reposição/)).toBeInTheDocument();
    expect(within(banner).getByText("Polpa de açaí: 1,2 kg (mínimo 5 kg)")).toBeInTheDocument();
    expect(within(banner).getByText(/Morango/)).toBeInTheDocument();
  });

  it("filters the list down to low stock from the banner", () => {
    render(<InventoryExperience />);
    fireEvent.click(within(lowStockBanner()).getByRole("button", { name: "Ver só esses itens" }));
    const list = screen.getByRole("list", { name: "Itens do estoque" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("checkbox", { name: "Só estoque baixo" })).toBeChecked();
  });

  it("finds items ignoring accents and shows an empty state with a reset", () => {
    render(<InventoryExperience />);
    fireEvent.change(screen.getByLabelText("Buscar item"), { target: { value: "acai" } });
    expect(within(screen.getByRole("list", { name: "Itens do estoque" })).getAllByRole("listitem")).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Buscar item"), { target: { value: "inexistente" } });
    expect(screen.getByText("Nenhum item encontrado com esses filtros.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(within(screen.getByRole("list", { name: "Itens do estoque" })).getAllByRole("listitem")).toHaveLength(12);
  });

  it("registers an entrada, updates the balance and clears the alert for that item", () => {
    render(<InventoryExperience />);
    registerEntrada("Polpa de açaí", "10", "Recebimento do fornecedor");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(itemRow("Polpa de açaí")).getByText("11,2 kg")).toBeInTheDocument();
    expect(within(lowStockBanner()).queryByText(/Polpa de açaí/)).not.toBeInTheDocument();

    const history = screen.getByRole("region", { name: "Movimentações recentes" });
    expect(within(history).getByText("Recebimento do fornecedor")).toBeInTheDocument();
    expect(within(history).getByText("+10 kg")).toBeInTheDocument();
  });

  it("keeps the panel open with the message when the reason is empty", () => {
    render(<InventoryExperience />);
    registerEntrada("Polpa de açaí", "10", "   ");

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Informe a justificativa.")).toBeInTheDocument();
    // The open dialog marks the page behind it aria-hidden, so query it with hidden: true.
    expect(within(screen.getByRole("listitem", { name: "Polpa de açaí", hidden: true })).getByText("1,2 kg")).toBeInTheDocument();
  });

  it("previews the resulting balance before saving", () => {
    render(<InventoryExperience />);
    fireEvent.click(screen.getByRole("button", { name: "Movimentar Polpa de açaí" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/quantidade recebida/i), { target: { value: "10" } });
    expect(within(dialog).getByText("O saldo vai de 1,2 kg para 11,2 kg.")).toBeInTheDocument();
  });

  it("changes the quantity label with the movement type", () => {
    render(<InventoryExperience />);
    fireEvent.click(screen.getByRole("button", { name: "Movimentar Polpa de açaí" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: "Inventário" }));
    expect(within(dialog).getByLabelText(/contagem física/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("radio", { name: "Ajuste" }));
    expect(within(dialog).getByLabelText(/diferença/i)).toBeInTheDocument();
  });

  it("reopens the panel with a clean form after a failed attempt", () => {
    render(<InventoryExperience />);
    registerEntrada("Polpa de açaí", "10", "");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));

    fireEvent.click(screen.getByRole("button", { name: "Movimentar Polpa de açaí" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("Informe a justificativa.")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(/quantidade recebida/i)).toHaveValue("");
  });
});
