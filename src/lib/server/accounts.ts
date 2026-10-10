import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import type { UserRole } from "@/lib/campus";
import { ensureResponderUnit, getOrCreateProfile } from "./helpers";

/**
 * Server-only account management. Besides public student sign-up (`/signup`),
 * password accounts are created when:
 *   - an admin creates them from the Users page (`createAccount`), or
 *   - the operator declares bootstrap accounts in server env vars (below).
 * Passwords are hashed by Better Auth; nothing is stored or shipped in plain text.
 */

export const MIN_PASSWORD_LENGTH = 8;

export type NewAccount = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

export class AccountExistsError extends Error {
  constructor() {
    super("An account with that email already exists");
    this.name = "AccountExistsError";
  }
}

async function setRole(userId: string, name: string, email: string, role: UserRole) {
  await getOrCreateProfile(userId);
  const sql = await getSql();
  await sql`update profiles set role = ${role}, name = ${name}, email = ${email} where user_id = ${userId}`;
  await ensureResponderUnit(userId, name, role);
}

/** Create a password account with a role. Throws `AccountExistsError` on a duplicate email. */
export async function createPasswordAccount(input: NewAccount): Promise<string> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const ctx = await auth.$context;
  if (await ctx.internalAdapter.findUserByEmail(email)) throw new AccountExistsError();

  const user = await ctx.internalAdapter.createUser({ email, name, emailVerified: true });
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await ctx.password.hash(input.password),
  });
  await setRole(user.id, name, email, input.role);
  return user.id;
}

type BootstrapSpec = { prefix: string; role: UserRole; defaultName: string };

const BOOTSTRAP_SPECS: BootstrapSpec[] = [
  { prefix: "BOOTSTRAP_ADMIN", role: "admin", defaultName: "Campus Command" },
  { prefix: "BOOTSTRAP_STUDENT", role: "student", defaultName: "Student" },
];

function envValue(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

/**
 * Make sure the env-declared bootstrap accounts exist with their role. Creates a
 * missing account; for an existing one it only re-asserts the role and adds a
 * password login if it has none. It never resets an existing password.
 */
async function applyBootstrapAccounts(): Promise<void> {
  const ctx = await auth.$context;
  for (const spec of BOOTSTRAP_SPECS) {
    const email = envValue(`${spec.prefix}_EMAIL`)?.toLowerCase();
    const password = envValue(`${spec.prefix}_PASSWORD`);
    if (!email || !password) continue;
    const name = envValue(`${spec.prefix}_NAME`) ?? spec.defaultName;
    if (password.length < MIN_PASSWORD_LENGTH) {
      console.error(
        `[accounts] ${spec.prefix}_PASSWORD is shorter than ${MIN_PASSWORD_LENGTH} characters — account not created.`,
      );
      continue;
    }

    const found = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });
    if (!found) {
      await createPasswordAccount({ name, email, password, role: spec.role });
      continue;
    }
    const hasPassword = found.accounts.some((a) => a.providerId === "credential");
    if (!hasPassword) {
      await ctx.internalAdapter.linkAccount({
        userId: found.user.id,
        providerId: "credential",
        accountId: found.user.id,
        password: await ctx.password.hash(password),
      });
    }
    await setRole(found.user.id, found.user.name || name, email, spec.role);
  }
}

const globalRef = globalThis as typeof globalThis & { __bootstrapAccounts__?: Promise<void> };

/** Run the bootstrap once per server process; a failure is retried on the next call. */
export function ensureBootstrapAccounts(): Promise<void> {
  globalRef.__bootstrapAccounts__ ??= applyBootstrapAccounts().catch((err) => {
    globalRef.__bootstrapAccounts__ = undefined;
    console.error("[accounts] bootstrap failed:", err);
  });
  return globalRef.__bootstrapAccounts__;
}

/**
 * Set a new password for an account (admin reset). Adds a password login when the
 * account only used federated sign-in. `signOutEverywhere` ends the person's
 * existing sessions so an old password or stolen session stops working.
 */
export async function setAccountPassword(
  userId: string,
  password: string,
  { signOutEverywhere }: { signOutEverywhere: boolean },
): Promise<void> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);
  const accounts = await ctx.internalAdapter.findAccounts(userId);
  if (accounts.some((a) => a.providerId === "credential")) {
    await ctx.internalAdapter.updatePassword(userId, hash);
  } else {
    await ctx.internalAdapter.linkAccount({
      userId,
      providerId: "credential",
      accountId: userId,
      password: hash,
    });
  }
  if (signOutEverywhere) await ctx.internalAdapter.deleteUserSessions(userId);
}
