import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComingSoon } from "./coming-soon";

afterEach(cleanup);

describe("ComingSoon", () => {
  it("names the module and links back to the home", () => {
    render(<ComingSoon title="Estoque" description="Entradas, saídas e alertas de reposição." />);

    expect(screen.getByRole("heading", { name: "Estoque" })).toBeInTheDocument();
    expect(screen.getByText(/entradas, saídas/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /voltar para o início/i })).toHaveAttribute("href", "/dashboard");
  });
});
