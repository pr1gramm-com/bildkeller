import { ApiError } from "@/lib/api/envelope";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { fail, ok } from "@/lib/api/envelope";
import { register } from "@/lib/api/router";
import { assertNonce } from "@/lib/auth";
import { addTag } from "@/lib/tags";
import { itemVisible, MAX_TAG, visibleItem } from "@/lib/visibility";
import { int } from "@/lib/params";
import type { ApiCtx, SessionUser } from "@/lib/types";

function requireUser(ctx: ApiCtx): SessionUser {
  if (!ctx.user) throw new ApiError("not logged in");
  assertNonce(ctx, ctx.user);
  return ctx.user;
}

async function findTag(name: string) {
  const rows = await db.select().from(schema.tags).where(eq(schema.tags.tag, name)).limit(1);
  return rows[0] ?? null;
}

register("tags.add", async (ctx) => {
  const user = requireUser(ctx);
  const itemId = int(ctx.form.itemId, 0);
  const names = (ctx.form.tags ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (names.length === 0 || names.length > 16 || names.some((n) => n.length > MAX_TAG)) return fail("invalid");
  if (!(await visibleItem(user, itemId))) return fail("not found");
  for (const name of names) await addTag(itemId, user.userId, name);
  return ok({});
});

register("tags.vote", async (ctx) => {
  const user = requireUser(ctx);
  const itemId = int(ctx.form.itemId, 0);
  const up = ctx.form.up === "1" || ctx.form.up === "true";
  const tag = await findTag((ctx.form.tag ?? "").toLowerCase());
  if (!tag || !(await visibleItem(user, itemId))) return fail("not found");

  const where = and(
    eq(schema.itemTagVotes.userId, user.userId),
    eq(schema.itemTagVotes.itemId, itemId),
    eq(schema.itemTagVotes.tagId, tag.id),
  );
  const existing = (await db.select().from(schema.itemTagVotes).where(where).limit(1))[0];
  const counters = (inc: boolean, dec: boolean | null) => ({
    ...(inc ? { up: sql`${schema.itemTags.up} + 1` } : { down: sql`${schema.itemTags.down} + 1` }),
    ...(dec === null
      ? {}
      : dec
        ? { up: sql`greatest(${schema.itemTags.up} - 1, 0)` }
        : { down: sql`greatest(${schema.itemTags.down} - 1, 0)` }),
  });
  const target = and(eq(schema.itemTags.itemId, itemId), eq(schema.itemTags.tagId, tag.id));

  if (!existing) {
    await db.insert(schema.itemTagVotes).values({ userId: user.userId, itemId, tagId: tag.id, up });
    await db.update(schema.itemTags).set(counters(up, null)).where(target);
  } else if (existing.up === up) {
    await db.delete(schema.itemTagVotes).where(where);
    await db
      .update(schema.itemTags)
      .set(up ? { up: sql`greatest(${schema.itemTags.up} - 1, 0)` } : { down: sql`greatest(${schema.itemTags.down} - 1, 0)` })
      .where(target);
  } else {
    await db.update(schema.itemTagVotes).set({ up }).where(where);
    await db.update(schema.itemTags).set(counters(up, !up)).where(target);
  }
  return ok({});
});

// shortcut: only mods/admins delete tags; per-adder grace window later.
register("tags.delete", async (ctx) => {
  const user = requireUser(ctx);
  if (!user.mod && !user.admin) return fail("forbidden");
  const itemId = int(ctx.form.itemId, 0);
  const tag = await findTag((ctx.form.tag ?? "").toLowerCase());
  if (!tag) return fail("not found");
  await db
    .delete(schema.itemTags)
    .where(and(eq(schema.itemTags.itemId, itemId), eq(schema.itemTags.tagId, tag.id)));
  return ok({});
});

register("tags.top", async (ctx) => {
  const rows = await db
    .select({ tag: schema.tags.tag, c: sql<number>`count(*)::int` })
    .from(schema.itemTags)
    .innerJoin(schema.tags, eq(schema.tags.id, schema.itemTags.tagId))
    .innerJoin(schema.items, eq(schema.items.id, schema.itemTags.itemId))
    .where(itemVisible(ctx.user))
    .groupBy(schema.tags.tag)
    .orderBy(desc(sql`count(*)`))
    .limit(100);
  const tags = rows.map((r) => r.tag);
  return ok({ tags, trending: tags.slice(0, 10), blacklist: [] });
});
