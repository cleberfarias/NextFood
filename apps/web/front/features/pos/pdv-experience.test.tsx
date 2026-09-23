import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PdvExperience } from "./pdv-experience";

describe("PdvExperience", () => {
  it("adds the stable mock scale reading to the cart and prepares a thermal receipt", () => {
    render(<PdvExperience />);

    fireEvent.click(screen.getByRole("button", { name: /ler balança/i }));
    fireEvent.click(screen.getByRole("button", { name: /adicionar açaí ao carrinho/i }));
    fireEvent.change(screen.getByLabelText("Valor do pagamento"), { target: { value: "17,96" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    fireEvent.click(screen.getByRole("button", { name: /finalizar venda/i }));

    expect(screen.getByText("Recibo pronto para impressão térmica")).toBeInTheDocument();
    expect(screen.getAllByText("Açaí por peso")).toHaveLength(2);
  });
});
