import { ApiError } from "@/lib/api/envelope";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { fail, ok } from "@/lib/api/envelope";
import { register } from "@/lib/api/router";
import { assertNonce } from "@/lib/auth";
import { userByName } from "@/lib/collections";
import { int } from "@/lib/params";
import type { ApiCtx, SessionUser } from "@/lib/types";

const now = () => Math.floor(Date.now() / 1000);

function modOnly(ctx: ApiCtx, write: boolean): SessionUser {
  if (!ctx.user) throw new ApiError("not logged in");
  if (!ctx.user.mod && !ctx.user.admin) throw new ApiError("forbidden");
  if (write) assertNonce(ctx, ctx.user);
  return ctx.user;
}

register("admin.reports", async (ctx) => {
  modOnly(ctx, false);
  const rows = await db
    .select({ r: schema.reports, reporter: schema.users.name })
    .from(schema.reports)
    .innerJoin(schema.users, eq(schema.users.id, schema.reports.userId))
    .where(eq(schema.reports.status, "open"))
    .orderBy(desc(schema.reports.id))
    .limit(200);
  return ok({
    reports: rows.map(({ r, reporter }) => ({
      id: r.id,
      reporter,
      itemId: r.itemId,
      commentId: r.commentId,
      reason: r.reason,
      message: r.message,
      created: r.created,
    })),
  });
});

register("admin.resolveReport", async (ctx) => {
  modOnly(ctx, true);
  await db.update(schema.reports).set({ status: "closed" }).where(eq(schema.reports.id, int(ctx.form.id, 0)));
  return ok({});
});

register("admin.ban", async (ctx) => {
  const mod = modOnly(ctx, true);
  const target = await userByName(ctx.form.name ?? "");
  if (!target) return fail("not found");
  if (target.admin || target.id === mod.userId) return fail("forbidden");
  const rawDays = ctx.form.days ?? "";
  if (rawDays !== "" && !/^[1-9]\d{0,4}$/.test(rawDays)) return fail("invalid");
  const days = int(rawDays, 0);
  await db.insert(schema.bans).values({
    userId: target.id,
    reason: ctx.form.reason ?? "",
    until: days > 0 ? now() + days * 86400 : null,
    createdBy: mod.userId,
    created: now(),
  });
  return ok({});
});

register("admin.unban", async (ctx) => {
  modOnly(ctx, true);
  const target = await userByName(ctx.form.name ?? "");
  if (!target) return fail("not found");
  await db.delete(schema.bans).where(eq(schema.bans.userId, target.id));
  return ok({});
});
