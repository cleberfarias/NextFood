import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CATALOG } from "@/front/features/catalog/catalog-mocks";
import { saveCatalog } from "@/front/features/catalog/catalog-store";
import { PdvExperience } from "./pdv-experience";

afterEach(cleanup);

describe("PdvExperience", () => {
  it("sells with the prices saved in the Cardápio and hides disabled complements", () => {
    saveCatalog({
      ...CATALOG,
      products: CATALOG.products.map((product) => (product.kind === "unidade" && product.id === "copo-300" ? { ...product, price: 16.5 } : product)),
      complements: CATALOG.complements.map((complement) => (complement.id === "confete" ? { ...complement, active: false } : complement)),
    });
    render(<PdvExperience />);
    expect(screen.getByRole("button", { name: /Copo 300 ml.*R\$\s16,50/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar Confete" })).not.toBeInTheDocument();
  });

  it("adds a simulated scale reading and keeps fiscal completion unavailable", () => {
    render(<PdvExperience />);
    fireEvent.click(screen.getByRole("button", { name: /ler peso/i }));
    fireEvent.click(screen.getByRole("button", { name: /adicionar açaí/i }));
    expect(screen.getAllByText("Açaí por peso")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /finalizar venda/i })).toBeDisabled();
  });

  it("removes a complement from the cart when its quantity is reduced", () => {
    render(<PdvExperience />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Banana" }));
    expect(screen.getAllByText("Banana")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Diminuir Banana" }));
    expect(screen.getAllByText("Banana")).toHaveLength(1);
  });

  it("reports a field-level error for an invalid payment", () => {
    render(<PdvExperience />);
    fireEvent.click(screen.getAllByRole("button", { name: /copo 300 ml/i })[0]);
    fireEvent.change(screen.getByLabelText("Valor do pagamento"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/maior que zero/i);
  });

  it("allows removing a registered payment", () => {
    render(<PdvExperience />);
    fireEvent.click(screen.getAllByRole("button", { name: /copo 300 ml/i })[0]);
    fireEvent.change(screen.getByLabelText("Valor do pagamento"), { target: { value: "14,90" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByRole("button", { name: "Remover pagamento Dinheiro" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover pagamento Dinheiro" }));
    expect(screen.queryByRole("button", { name: "Remover pagamento Dinheiro" })).not.toBeInTheDocument();
  });

  it("marks an entered payment as a manual confirmation in demonstration mode", async () => {
    render(<PdvExperience />);
    fireEvent.click(screen.getAllByRole("button", { name: /copo 300 ml/i })[0]);
    fireEvent.change(screen.getByLabelText("Valor do pagamento"), { target: { value: "14,90" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText(/pagamento confirmado manualmente/i)).toBeInTheDocument();
    expect(screen.getByText("Pagamento completo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /finalizar venda/i })).toBeEnabled();
  });

  it("keeps an item intact until a server authorization is available", () => {
    render(<PdvExperience />);
    fireEvent.click(screen.getAllByRole("button", { name: /copo 300 ml/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /remover copo 300 ml/i }));

    expect(screen.getByRole("dialog")).toHaveTextContent(/validação do servidor/i);
    expect(screen.getAllByText("Copo 300 ml")).toHaveLength(2);
  });

  it("uses an accessible server-dependent authorization dialog", () => {
    render(<PdvExperience />);
    fireEvent.click(screen.getAllByRole("button", { name: /copo 300 ml/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /cancelar item/i }));
    expect(screen.getByRole("dialog")).toHaveTextContent(/validação do servidor/i);
    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();
  });
});
