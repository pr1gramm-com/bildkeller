import { int } from "@/lib/params";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { ok, fail } from "@/lib/api/envelope";
import { register } from "@/lib/api/router";
import { benis } from "@/lib/benis";
import { clientIp, limit } from "@/lib/limiter";
import { readLog } from "@/lib/sync";
import { notificationVisible } from "@/lib/notifications";
import { getSettings, updateSettings } from "@/lib/settings";
import {
  assertNonce,
  createSession,
  hasActiveBan,
  verifyDummy,
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
  limit(`login:ip:${clientIp(ctx.req)}`, 20, 600);
  limit(`login:name:${name.toLowerCase()}`, 8, 600);

  const rows = await db
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.name}) = ${name.toLowerCase()}`)
    .limit(1);
  const user = rows[0];
  if (!user || user.deleted) {
    await verifyDummy(password);
    return fail("invalid credentials");
  }
  if (!(await verifyPassword(password, user.passwordHash))) return fail("invalid credentials");

  if (await hasActiveBan(user.id)) return fail("banned");
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

register("user.sync", async (ctx) => {
  if (!ctx.user) return fail("not logged in");
  const user = ctx.user;
  const userId = user.userId;
  const offset = int(ctx.query.get("offset"), 0);
  const limit = int(ctx.query.get("limit"), 1000);

  const unread = (type: string) =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.type, type), eq(schema.notifications.read, false), notificationVisible(user)))
      .then((r) => Number(r[0].c));
  const [mentions, comments, follows, messages, notificationsTotal, score, settings, log] = await Promise.all([
    unread("mention"),
    unread("comment"),
    unread("follow"),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.messages)
      .where(and(eq(schema.messages.toId, userId), eq(schema.messages.read, false), sql`not exists (select 1 from blocks b where b.user_id = ${userId} and b.blocked_user_id = ${schema.messages.fromId})`))
      .then((r) => Number(r[0].c)),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.read, false), notificationVisible(user)))
      .then((r) => Number(r[0].c)),
    benis(userId),
    getSettings(userId),
    readLog(userId, offset, limit),
  ]);

  return ok({
    inbox: { comments, mentions, messages, notifications: notificationsTotal, follows, digests: 0 },
    ...log,
    score,
    settings,
  });
});

register("user.sitesettings", async (ctx) => {
  if (!ctx.user) return fail("not logged in");
  assertNonce(ctx, ctx.user);
  return ok({ settings: await updateSettings(ctx.user.userId, ctx.form) });
});

register("user.settings", async (ctx) => {
  if (!ctx.user) return fail("not logged in");
  return ok({ settings: await getSettings(ctx.user.userId) });
});

register("user.clearHistory", async (ctx) => {
  if (!ctx.user) return fail("not logged in");
  assertNonce(ctx, ctx.user);
  return ok({ settings: await updateSettings(ctx.user.userId, { seenItems: "[]" }) });
});
