import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HomeHub } from "./home-hub";

afterEach(cleanup);

async function noopSignOut() {}

describe("HomeHub", () => {
  it("links each module to its route", () => {
    render(<HomeHub userLabel="ana@acai.test" signOutAction={noopSignOut} />);

    expect(screen.getByRole("link", { name: /caixa/i })).toHaveAttribute("href", "/pdv");
    expect(screen.getByRole("link", { name: /estoque/i })).toHaveAttribute("href", "/estoque");
    expect(screen.getByRole("link", { name: /configurações/i })).toHaveAttribute("href", "/configuracoes");
    expect(screen.getByRole("link", { name: /relatórios/i })).toHaveAttribute("href", "/relatorios");
  });

  it("shows who is signed in and a way to sign out", () => {
    render(<HomeHub userLabel="ana@acai.test" signOutAction={noopSignOut} />);

    expect(screen.getByText("ana@acai.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sair/i })).toBeInTheDocument();
  });
});
