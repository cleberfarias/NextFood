// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  AlreadyOnWaitlistError,
  joinWaitlist,
  type WaitlistRepository,
  type WaitlistSignup,
} from "./waitlist";

/**
 * In-memory fake -- proves the domain use case is testable with no
 * Next.js, no Firebase, no emulator. Just the port it declares.
 */
class InMemoryWaitlistRepository implements WaitlistRepository {
  private signups: WaitlistSignup[] = [];

  async existsByEmail(email: string): Promise<boolean> {
    return this.signups.some((s) => s.email === email);
  }

  async add(signup: WaitlistSignup): Promise<void> {
    this.signups.push(signup);
  }

  all(): WaitlistSignup[] {
    return this.signups;
  }
}

describe("joinWaitlist", () => {
  it("adds a new signup", async () => {
    const repo = new InMemoryWaitlistRepository();

    const signup = await joinWaitlist(repo, {
      email: "owner@acaidaquele.com",
      businessName: "Açaí Daquele",
    });

    expect(signup.email).toBe("owner@acaidaquele.com");
    expect(repo.all()).toHaveLength(1);
  });

  it("normalizes email casing and whitespace before storing and checking duplicates", async () => {
    const repo = new InMemoryWaitlistRepository();
    await joinWaitlist(repo, { email: "Owner@Acai.com", businessName: "Açaí" });

    await expect(
      joinWaitlist(repo, { email: "  owner@acai.com  ", businessName: "Açaí" }),
    ).rejects.toThrow(AlreadyOnWaitlistError);

    expect(repo.all()).toHaveLength(1);
    expect(repo.all()[0].email).toBe("owner@acai.com");
  });

  it("trims the business name", async () => {
    const repo = new InMemoryWaitlistRepository();

    const signup = await joinWaitlist(repo, {
      email: "a@b.com",
      businessName: "  Açaí Daquele  ",
    });

    expect(signup.businessName).toBe("Açaí Daquele");
  });
});
