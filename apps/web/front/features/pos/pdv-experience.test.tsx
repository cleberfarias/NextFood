import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PdvExperience } from "./pdv-experience";

afterEach(cleanup);

describe("PdvExperience", () => {
  it("adds the stable mock scale reading to the cart and prepares a thermal receipt", () => {
    render(<PdvExperience />);

    fireEvent.click(screen.getByRole("button", { name: /ler balança/i }));
    fireEvent.click(screen.getByRole("button", { name: /adicionar açaí ao carrinho/i }));
    fireEvent.change(screen.getByLabelText("Valor do pagamento"), { target: { value: "17,96" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    fireEvent.click(screen.getByRole("button", { name: /finalizar venda/i }));
    fireEvent.click(screen.getByRole("button", { name: /recibo de venda/i }));

    expect(screen.getByText("Recibo pronto para impressão térmica")).toBeInTheDocument();
    expect(screen.getAllByText("Açaí por peso")).toHaveLength(2);
  });

  it("cancels the last cart item without cancelling the whole sale", () => {
    render(<PdvExperience />);

    fireEvent.click(screen.getAllByRole("button", { name: /copo 300 ml/i })[0]);
    expect(screen.getAllByText("Copo 300 ml")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /cancelar último item/i }));

    fireEvent.change(screen.getByLabelText(/senha de cancelamento/i), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: /autorizar/i }));
    expect(screen.getAllByText("Copo 300 ml")).toHaveLength(1);
    expect(screen.getByText(/item cancelado/i)).toBeInTheDocument();
  });

  it("opens the mock card terminal from the conventional payment shortcut", () => {
    render(<PdvExperience />);

    fireEvent.click(screen.getByRole("button", { name: /abrir pagamento na maquininha/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /iniciar cobran/i }));
    expect(screen.getByText(/cobrança iniciada/i)).toBeInTheDocument();
  });

  it("accepts a manual weight when the scale integration is unavailable", () => {
    render(<PdvExperience />);

    fireEvent.click(screen.getByRole("button", { name: /usar peso manual/i }));
    fireEvent.change(screen.getByLabelText(/peso manual/i), { target: { value: "0,325" } });
    fireEvent.click(screen.getByRole("button", { name: /adicionar.*carrinho/i }));

    expect(screen.getByText(/modo manual/i)).toBeInTheDocument();
    expect(screen.getAllByText(/0,325 kg/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /voltar para ler/i }));
    expect(screen.getByRole("button", { name: /ler balan/i })).toBeInTheDocument();
  });
});
