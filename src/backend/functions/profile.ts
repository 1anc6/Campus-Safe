import { createServerFn } from "@tanstack/react-start";
import { auth } from "@/lib/auth/server";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/backend/db";
import {
  BLOOD_GROUPS,
  type ActivityItem,
  type BloodGroup,
  type MyProfile,
  type Profile,
} from "@/lib/types";
import { iso } from "@/lib/utils";
import { z } from "zod";
import {
  AccountExistsError,
  MIN_PASSWORD_LENGTH,
  createPasswordAccount,
  setAccountPassword,
} from "@/backend/core/accounts";
import {
  audit,
  ensureResponderUnit,
  getOrCreateProfile,
  requireAdmin,
} from "@/backend/core/helpers";
import { catName, locName } from "@/backend/core/helpers";

const roleSchema = z.enum(["student", "responder", "admin"]);

export const updateMyPhone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { phone: string }) => ({ phone: input.phone.trim().slice(0, 24) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await getOrCreateProfile(context.userId);
    await sql`update profiles set phone = ${data.phone || null} where user_id = ${context.userId}`;
    return getOrCreateProfile(context.userId);
  });

export const listMyActivity = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ActivityItem[]> => {
    const sql = await getSql();
    const sos = await sql<{
      id: string;
      status: string;
      started_at: unknown;
    }>`select id, status, started_at from sos_alerts where user_id = ${context.userId} order by started_at desc limit 8`;
    const inc = await sql<{
      id: string;
      category_id: string;
      status: string;
      created_at: unknown;
    }>`select id, category_id, status, created_at from incidents where user_id = ${context.userId} order by created_at desc limit 8`;

    const items: ActivityItem[] = [
      ...sos.map((s) => ({
        id: s.id,
        kind: "sos" as const,
        title: "SOS alert",
        status: s.status,
        at: iso(s.started_at),
      })),
      ...inc.map((s) => ({
        id: s.id,
        kind: "incident" as const,
        title: catName(s.category_id),
        status: s.status,
        at: iso(s.created_at),
      })),
    ];
    items.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    return items.slice(0, 8);
  });

export type PersonRow = {
  userId: string;
  name: string;
  email: string | null;
  role: Profile["role"];
  createdAt: string;
  hasPassword: boolean;
};

export const listPeople = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PersonRow[]> => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      user_id: string;
      name: string;
      email: string | null;
      role: Profile["role"];
      created_at: unknown;
      has_password: boolean;
    }>`
      select p.user_id, p.name, p.email, p.role, p.created_at,
             exists (
               select 1 from account a where a."userId" = p.user_id and a."providerId" = 'credential'
             ) as has_password
      from profiles p
      order by p.created_at asc
    `;
    return rows.map((r) => ({
      userId: r.user_id,
      name: r.name,
      email: r.email,
      role: r.role,
      createdAt: iso(r.created_at),
      hasPassword: Boolean(r.has_password),
    }));
  });

export const setPersonRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ userId: z.string().min(1), role: roleSchema }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    // An admin demoting themselves could leave the console with no admin.
    if (data.userId === context.userId) throw new Error("You cannot change your own role");
    const sql = await getSql();
    const rows = await sql<{ name: string }>`
      update profiles set role = ${data.role} where user_id = ${data.userId} returning name
    `;
    if (!rows[0]) throw new Error("Not found");
    await ensureResponderUnit(data.userId, rows[0].name, data.role);
    await audit(context.userId, "user.role", "user", data.userId, data.role);
    return { ok: true as const };
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().toLowerCase().email().max(160),
      password: z.string().min(MIN_PASSWORD_LENGTH).max(128),
      role: roleSchema,
    }),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    try {
      const userId = await createPasswordAccount(data);
      await audit(context.userId, "user.create", "user", userId, data.role);
      return { ok: true as const, userId };
    } catch (err) {
      if (err instanceof AccountExistsError) return { ok: false as const, error: err.message };
      throw err;
    }
  });

export const resetPassword = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      userId: z.string().min(1),
      password: z.string().min(MIN_PASSWORD_LENGTH).max(128),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const target = await sql<{
      user_id: string;
    }>`select user_id from profiles where user_id = ${data.userId}`;
    if (!target[0]) throw new Error("Not found");
    // Resetting someone else's password signs them out everywhere; an admin
    // changing their own keeps the current session.
    await setAccountPassword(data.userId, data.password, {
      signOutEverywhere: data.userId !== context.userId,
    });
    await audit(context.userId, "user.password_reset", "user", data.userId);
    return { ok: true as const };
  });

/* ---------------------------------------------------- own profile (panel) */

/**
 * The signed-in person's own profile (the profile panel). Every query is scoped
 * to the verified session user — never an id sent from the browser.
 */

type MyRow = {
  course: string | null;
  student_id: string | null;
  blood_group: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  medical_notes: string | null;
  share_medical: boolean;
  has_password: boolean;
};

async function loadMyProfile(userId: string): Promise<MyProfile> {
  const base = await getOrCreateProfile(userId);
  const sql = await getSql();
  const rows = await sql<MyRow>`
    select p.course, p.student_id, p.blood_group, p.emergency_name, p.emergency_phone,
           p.medical_notes, p.share_medical,
           exists (
             select 1 from account a where a."userId" = p.user_id and a."providerId" = 'credential'
           ) as has_password
    from profiles p where p.user_id = ${userId}
  `;
  const r = rows[0];
  return {
    ...base,
    course: r?.course ?? null,
    studentId: r?.student_id ?? null,
    bloodGroup: (r?.blood_group as BloodGroup | null) ?? null,
    emergencyName: r?.emergency_name ?? null,
    emergencyPhone: r?.emergency_phone ?? null,
    medicalNotes: r?.medical_notes ?? null,
    shareMedical: r?.share_medical ?? true,
    hasPassword: Boolean(r?.has_password),
  };
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) => loadMyProfile(context.userId));

/** Blank → null, so clearing a field really clears it. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const phoneText = optionalText(24).refine((v) => v === null || /^[+\d][\d\s()-]{5,}$/.test(v), {
  message: "Enter a valid phone number",
});

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: phoneText,
  course: optionalText(80),
  studentId: optionalText(40),
  bloodGroup: z.enum(BLOOD_GROUPS).nullable(),
  emergencyName: optionalText(80),
  emergencyPhone: phoneText,
  medicalNotes: optionalText(500),
  shareMedical: z.boolean(),
});

export type ProfileInput = z.input<typeof profileSchema>;

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(profileSchema)
  .handler(async ({ context, data }) => {
    await getOrCreateProfile(context.userId);
    const sql = await getSql();
    await sql`
      update profiles set
        name = ${data.name},
        phone = ${data.phone},
        course = ${data.course},
        student_id = ${data.studentId},
        blood_group = ${data.bloodGroup},
        emergency_name = ${data.emergencyName},
        emergency_phone = ${data.emergencyPhone},
        medical_notes = ${data.medicalNotes},
        share_medical = ${data.shareMedical}
      where user_id = ${context.userId}
    `;
    // Keep the sign-in record's display name in step with the profile.
    await sql`update "user" set name = ${data.name}, "updatedAt" = now() where id = ${context.userId}`;
    return loadMyProfile(context.userId);
  });

/**
 * Change the sign-in email. Requires the current password, so someone at an
 * unlocked phone cannot quietly take over the account.
 */
export const changeMyEmail = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      email: z.string().trim().toLowerCase().email("Enter a valid email address").max(160),
      currentPassword: z.string().min(1, "Enter your current password").max(128),
    }),
  )
  .handler(async ({ context, data }) => {
    const ctx = await auth.$context;
    const accounts = await ctx.internalAdapter.findAccounts(context.userId);
    const credential = accounts.find((a) => a.providerId === "credential");
    if (!credential?.password) {
      return {
        ok: false as const,
        error: "This account signs in without a password, so its email can't be changed here.",
      };
    }
    const valid = await ctx.password.verify({
      hash: credential.password,
      password: data.currentPassword,
    });
    if (!valid) return { ok: false as const, error: "Current password is incorrect." };

    const existing = await ctx.internalAdapter.findUserByEmail(data.email);
    if (existing && existing.user.id !== context.userId) {
      return { ok: false as const, error: "Another account already uses that email." };
    }

    await ctx.internalAdapter.updateUser(context.userId, { email: data.email });
    const sql = await getSql();
    await sql`update profiles set email = ${data.email} where user_id = ${context.userId}`;
    await audit(context.userId, "user.email_change", "user", context.userId);
    return { ok: true as const, profile: await loadMyProfile(context.userId) };
  });

export { locName };
