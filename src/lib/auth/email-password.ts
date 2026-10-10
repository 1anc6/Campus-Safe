/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * On: the shared `/login` page signs students and admins in with
 * `authClient.signIn.email`. Students self-register on `/signup`
 * (`authClient.signUp.email`); staff accounts are created server-side
 * (`src/lib/server/accounts.ts`).
 */
export const emailAndPasswordEnabled = true;
