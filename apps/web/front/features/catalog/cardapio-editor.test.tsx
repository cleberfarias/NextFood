import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CardapioEditor } from "./cardapio-editor";
import { CATALOG } from "./catalog-mocks";
import { loadCatalog } from "./catalog-store";

afterEach(cleanup);

function openEdit(name: string) {
  fireEvent.click(screen.getByRole("button", { name: `Editar ${name}` }));
  return screen.getByRole("dialog");
}

function save(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
}

function row(name: string) {
  return screen.getByRole("listitem", { name });
}

describe("CardapioEditor", () => {
  it("edits the açaí price per kg, shows it in the list and saves it in the browser", () => {
    render(<CardapioEditor />);
    const dialog = openEdit("Açaí por peso");
    fireEvent.change(within(dialog).getByLabelText("Preço por kg (R$)"), { target: { value: "45,50" } });
    save(dialog);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(row("Açaí por peso")).getByText("R$ 45,50/kg")).toBeInTheDocument();
    expect(screen.getByText("Alterações salvas.")).toBeInTheDocument();
    expect(loadCatalog().products.find((product) => product.id === "acai-peso")).toMatchObject({ pricePerKg: 45.5 });
  });

  it("keeps the panel open with the message when the price is empty", () => {
    render(<CardapioEditor />);
    const dialog = openEdit("Copo 300 ml");
    fireEvent.change(within(dialog).getByLabelText("Preço (R$)"), { target: { value: "" } });
    save(dialog);

    expect(within(screen.getByRole("dialog")).getByText("O preço precisa ser maior que zero.")).toBeInTheDocument();
    expect(loadCatalog()).toBe(CATALOG);
  });

  it("reopens the panel clean after a failed save", () => {
    render(<CardapioEditor />);
    const failed = openEdit("Copo 300 ml");
    fireEvent.change(within(failed).getByLabelText("Preço (R$)"), { target: { value: "0" } });
    save(failed);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));

    const dialog = openEdit("Copo 300 ml");
    expect(within(dialog).queryByText("O preço precisa ser maior que zero.")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Preço (R$)")).toHaveValue("14,90");
  });

  it("creates a ready cup with a stock consumption", () => {
    render(<CardapioEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Novo produto" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("radio", { name: "Copo pronto" })).toBeChecked();
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Copo pronto 700 ml" } });
    fireEvent.change(within(dialog).getByLabelText("Preço (R$)"), { target: { value: "20" } });
    fireEvent.change(within(dialog).getByLabelText("Complementos incluídos"), { target: { value: "4" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Adicionar consumo" }));
    fireEvent.change(within(dialog).getByLabelText("Quantidade (kg)"), { target: { value: "0,5" } });
    save(dialog);

    expect(row("Copo pronto 700 ml")).toBeInTheDocument();
    expect(loadCatalog().products.find((product) => product.id === "copo-pronto-700-ml")).toMatchObject({
      kind: "pronto",
      price: 20,
      includedComplements: 4,
      consumes: [{ itemId: "polpa-acai", quantity: 0.5 }],
    });
  });

  it("creates a packaging and its stock item", () => {
    render(<CardapioEditor />);
    fireEvent.click(screen.getByRole("tab", { name: "Embalagens" }));
    fireEvent.click(screen.getByRole("button", { name: "Nova embalagem" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Copo 700 ml" } });
    fireEvent.change(within(dialog).getByLabelText("Tara (g)"), { target: { value: "20" } });
    save(dialog);

    expect(within(screen.getByRole("list", { name: "Embalagens" })).getByRole("listitem", { name: "Copo 700 ml" })).toBeInTheDocument();
    expect(within(row("Copo 700 ml")).getByText("Tara 20 g")).toBeInTheDocument();
    expect(loadCatalog().stockItems.find((item) => item.id === "copo-700-ml")).toMatchObject({ unit: "un", balance: 0, minimum: 0 });
  });

  it("disables a complement and marks it in the list", () => {
    render(<CardapioEditor />);
    fireEvent.click(screen.getByRole("tab", { name: "Complementos" }));
    const dialog = openEdit("Confete");
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Ativo" }));
    save(dialog);

    expect(within(row("Confete")).getByText("Desativado")).toBeInTheDocument();
  });

  it("does not offer to disable the açaí sold by weight", () => {
    render(<CardapioEditor />);
    const dialog = openEdit("Açaí por peso");
    expect(within(dialog).queryByRole("checkbox", { name: "Ativo" })).not.toBeInTheDocument();
  });

  it("restores the sample values after confirming", () => {
    render(<CardapioEditor />);
    const dialog = openEdit("Açaí por peso");
    fireEvent.change(within(dialog).getByLabelText("Preço por kg (R$)"), { target: { value: "45" } });
    save(dialog);

    fireEvent.click(screen.getByRole("button", { name: "Restaurar valores de exemplo" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restaurar" }));

    expect(within(row("Açaí por peso")).getByText("R$ 39,90/kg")).toBeInTheDocument();
    expect(loadCatalog()).toBe(CATALOG);
  });
});
