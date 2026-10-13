import { eq, sql } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { ok, fail } from "@/lib/api/envelope";
import { register } from "@/lib/api/router";
import {
  assertNonce,
  createSession,
  setMeCookie,
  verifyPassword,
} from "@/lib/auth";

export function userPayload(user: {
  id: number;
  name: string;
  mark: number;
  verified: boolean;
  admin: boolean;
  mod: boolean;
  created: number;
}): Record<string, unknown> {
  return {
    id: user.id,
    name: user.name,
    mark: user.mark,
    verified: user.verified,
    admin: user.admin,
    mod: user.mod,
    registered: user.created,
  };
}

register("user.login", async (ctx) => {
  const name = (ctx.form.name ?? "").trim();
  const password = ctx.form.password ?? "";
  if (!name || !password) return fail("invalid login");

  const rows = await db
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.name}) = ${name.toLowerCase()}`)
    .limit(1);
  const user = rows[0];
  if (!user || user.deleted || !(await verifyPassword(password, user.passwordHash))) {
    return fail("invalid credentials");
  }

  const token = await createSession(user.id);
  setMeCookie(ctx, {
    id: token,
    name: user.name,
    mark: user.mark,
    verified: user.verified,
    admin: user.admin,
  });
  return ok({ success: true });
});

register("user.logout", async (ctx) => {
  if (ctx.user) {
    assertNonce(ctx, ctx.user);
    await db.delete(schema.sessions).where(eq(schema.sessions.token, ctx.user.id));
  }
  ctx.outCookies.push({ name: "me", value: "", maxAge: 0 });
  return ok({});
});

register("user.validate", async (ctx) => {
  if (!ctx.user) return fail("not logged in");
  return ok(userPayload({ ...ctx.user, id: ctx.user.userId, created: 0 }));
});

register("user.info", async (ctx) => {
  if (!ctx.user) return fail("not logged in");
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, ctx.user.userId))
    .limit(1);
  const user = rows[0];
  if (!user) return fail("not logged in");
  return ok({
    account: userPayload(user),
    authorizedApps: [],
    backgrounds: [],
    canChangeName: true,
    digests: { daily: false, weekly: false },
    enableEmailNotifications: false,
    inviteEligibilityData: {},
    inviteEligible: false,
    invited: 0,
    invitesDetached: 0,
    invitesRemaining: 0,
    payments: [],
    promotedApps: [],
    subscriptions: [],
  });
});
