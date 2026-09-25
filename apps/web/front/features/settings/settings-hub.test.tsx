import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsHub } from "./settings-hub";

afterEach(cleanup);

describe("SettingsHub", () => {
  it("links to the Cardápio and marks the other areas as coming soon", () => {
    render(<SettingsHub />);
    expect(screen.getByRole("heading", { name: "Configurações" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cardápio/ })).toHaveAttribute("href", "/configuracoes/cardapio");
    expect(screen.queryByRole("link", { name: /Usuários/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dados da loja/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Em breve")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Início/ })).toHaveAttribute("href", "/dashboard");
  });
});
