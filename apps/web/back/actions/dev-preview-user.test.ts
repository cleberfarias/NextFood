import { afterEach, describe, expect, it, vi } from "vitest";
import { getDevPreviewUser } from "./dev-preview-user";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getDevPreviewUser", () => {
  it("returns a stand-in user when DEV_SKIP_AUTH is on outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_SKIP_AUTH", "true");

    expect(getDevPreviewUser()).toEqual({ uid: "dev-preview", email: "Modo desenvolvimento (sem login)" });
  });

  it("returns null when the flag is off", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_SKIP_AUTH", "");

    expect(getDevPreviewUser()).toBeNull();
  });

  it("never bypasses auth in production, even with the flag on", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_SKIP_AUTH", "true");

    expect(getDevPreviewUser()).toBeNull();
  });
});
