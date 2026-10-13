import { randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { fail, ok } from "@/lib/api/envelope";
import { register } from "@/lib/api/router";
import { assertNonce, createSession, hashPassword, setMeCookie, verifyPassword } from "@/lib/auth";
import { config } from "@/lib/config";
import { userByName } from "@/lib/collections";
import type { ApiCtx, SessionUser } from "@/lib/types";

const now = () => Math.floor(Date.now() / 1000);
const MAX_OPEN_INVITES = 3;

function me(ctx: ApiCtx): SessionUser {
  if (!ctx.user) throw new Error("not logged in");
  assertNonce(ctx, ctx.user);
  return ctx.user;
}

register("user.invite", async (ctx) => {
  const user = me(ctx);
  if (!user.admin) {
    const open = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.invites)
      .where(and(eq(schema.invites.createdBy, user.userId), isNull(schema.invites.usedBy)));
    if (Number(open[0].c) >= MAX_OPEN_INVITES) return fail("invite limit");
  }
  const code = randomBytes(8).toString("hex");
  await db.insert(schema.invites).values({ code, createdBy: user.userId, created: now() });
  return ok({ code });
});

register("user.loadinvite", async (ctx) => {
  const code = ctx.query.get("code") ?? "";
  const inv = (
    await db.select().from(schema.invites).where(and(eq(schema.invites.code, code), isNull(schema.invites.usedBy))).limit(1)
  )[0];
  return inv ? ok({ valid: true }) : fail("invalid invite");
});

register("user.joinwithinvite", async (ctx) => {
  const name = (ctx.form.name ?? "").trim();
  const password = ctx.form.password ?? "";
  if (!/^[\p{L}\p{N}_-]{2,32}$/u.test(name)) return fail("invalid name");
  if (password.length < 8) return fail("password too short");

  const total = Number(
    (await db.select({ c: sql<number>`count(*)::int` }).from(schema.users))[0].c,
  );
  const first = total === 0; // bootstrap: the very first account becomes admin, no invite needed
  const required = (await config("invites.required")) !== false;

  let inviteId: number | null = null;
  if (!first && required) {
    if (!ctx.form.invite) return fail("invite required");
    const inv = (
      await db
        .select()
        .from(schema.invites)
        .where(and(eq(schema.invites.code, ctx.form.invite), isNull(schema.invites.usedBy)))
        .limit(1)
    )[0];
    if (!inv) return fail("invalid invite");
    inviteId = inv.id;
  }
  if (await userByName(name)) return fail("name taken");

  const [created] = await db
    .insert(schema.users)
    .values({
      name,
      email: ctx.form.email || null,
      passwordHash: hashPassword(password),
      verified: first || ctx.form.ageVerified === "1",
      admin: first,
      mod: first,
      inviteId,
      created: now(),
    })
    .returning();
  if (inviteId) await db.update(schema.invites).set({ usedBy: created.id }).where(eq(schema.invites.id, inviteId));

  const token = await createSession(created.id);
  setMeCookie(ctx, { id: token, name: created.name, mark: created.mark, verified: created.verified, admin: created.admin });
  return ok({ success: true });
});

// Self-declaration of age (self-hosted default); operators needing proof should replace this endpoint.
register("user.ageVerified", async (ctx) => {
  const user = me(ctx);
  await db.update(schema.users).set({ verified: true }).where(eq(schema.users.id, user.userId));
  return ok({});
});

register("user.changepassword", async (ctx) => {
  const user = me(ctx);
  const row = (await db.select().from(schema.users).where(eq(schema.users.id, user.userId)).limit(1))[0];
  const next = ctx.form.password ?? ctx.form.new ?? "";
  if (!row || !(await verifyPassword(ctx.form.old ?? "", row.passwordHash))) return fail("invalid credentials");
  if (next.length < 8) return fail("password too short");
  await db.update(schema.users).set({ passwordHash: hashPassword(next) }).where(eq(schema.users.id, user.userId));
  return ok({});
});

register("contact.report", async (ctx) => {
  const user = me(ctx);
  const reason = (ctx.form.reason ?? "").trim();
  const itemId = Number(ctx.form.itemId ?? 0) || null;
  const commentId = Number(ctx.form.commentId ?? 0) || null;
  if (!reason || (!itemId && !commentId)) return fail("invalid");
  await db
    .insert(schema.reports)
    .values({ userId: user.userId, itemId, commentId, reason, message: ctx.form.message ?? "", created: now() });
  return ok({});
});

// --- GDPR basics -----------------------------------------------------------
const deletionKey = (userId: number) => `deletion.${userId}`;

register("user.requestAccountDeletion", async (ctx) => {
  const user = me(ctx);
  await db
    .insert(schema.siteConfig)
    .values({ key: deletionKey(user.userId), value: { requested: now() } })
    .onConflictDoNothing();
  return ok({});
});

register("user.deletionStatus", async (ctx) => {
  if (!ctx.user) return fail("not logged in");
  const row = (
    await db.select().from(schema.siteConfig).where(eq(schema.siteConfig.key, deletionKey(ctx.user.userId))).limit(1)
  )[0];
  return ok({ pending: Boolean(row), requested: (row?.value as { requested?: number } | undefined)?.requested ?? null });
});

register("user.cancelAccountDeletion", async (ctx) => {
  const user = me(ctx);
  await db.delete(schema.siteConfig).where(eq(schema.siteConfig.key, deletionKey(user.userId)));
  return ok({});
});

register("user.confirmAccountDeletion", async (ctx) => {
  const user = me(ctx);
  const pending = await db.select().from(schema.siteConfig).where(eq(schema.siteConfig.key, deletionKey(user.userId))).limit(1);
  if (pending.length === 0) return fail("no pending request");
  await db.update(schema.users).set({ deleted: true }).where(eq(schema.users.id, user.userId));
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, user.userId));
  await db.delete(schema.siteConfig).where(eq(schema.siteConfig.key, deletionKey(user.userId)));
  ctx.outCookies.push({ name: "me", value: "", maxAge: 0 });
  return ok({});
});

register("user.dataExportStatus", async (ctx) => (ctx.user ? ok({ available: true }) : fail("not logged in")));

register("user.dataExport", async (ctx) => {
  if (!ctx.user) return fail("not logged in");
  const id = ctx.user.userId;
  const [u, items, comments, messages] = await Promise.all([
    db.select().from(schema.users).where(eq(schema.users.id, id)),
    db.select().from(schema.items).where(eq(schema.items.userId, id)),
    db.select().from(schema.comments).where(eq(schema.comments.userId, id)),
    db.select().from(schema.messages).where(sql`${schema.messages.fromId} = ${id} or ${schema.messages.toId} = ${id}`),
  ]);
  const { passwordHash: _omit, ...user } = u[0]; // eslint-disable-line @typescript-eslint/no-unused-vars
  return ok({ data: { user, items, comments, messages } });
});
