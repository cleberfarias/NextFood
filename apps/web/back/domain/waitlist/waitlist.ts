export type WaitlistSignup = {
  email: string;
  businessName: string;
  createdAt: Date;
};

export type NewWaitlistSignup = {
  email: string;
  businessName: string;
};

/**
 * Port: back/data provides the concrete (Firestore) implementation.
 * Domain code only ever depends on this interface, never on Firestore.
 */
export interface WaitlistRepository {
  existsByEmail(email: string): Promise<boolean>;
  add(signup: WaitlistSignup): Promise<void>;
}

export class AlreadyOnWaitlistError extends Error {
  constructor(email: string) {
    super(`${email} is already on the waitlist`);
    this.name = "AlreadyOnWaitlistError";
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function joinWaitlist(
  repository: WaitlistRepository,
  input: NewWaitlistSignup,
): Promise<WaitlistSignup> {
  const email = normalizeEmail(input.email);
  const businessName = input.businessName.trim();

  if (await repository.existsByEmail(email)) {
    throw new AlreadyOnWaitlistError(email);
  }

  const signup: WaitlistSignup = { email, businessName, createdAt: new Date() };
  await repository.add(signup);
  return signup;
}
