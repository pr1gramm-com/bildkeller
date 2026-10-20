import { ApiError } from "@/lib/api/envelope";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { fail, ok } from "@/lib/api/envelope";
import { register } from "@/lib/api/router";
import { assertNonce } from "@/lib/auth";
import { collectionsOf, toApiCollection, userByName } from "@/lib/collections";
import { int } from "@/lib/params";
import { limit } from "@/lib/limiter";
import { itemVisible, visibleItem } from "@/lib/visibility";
import type { ApiCtx, SessionUser } from "@/lib/types";

const now = () => Math.floor(Date.now() / 1000);

function me(ctx: ApiCtx): SessionUser {
  if (!ctx.user) throw new ApiError("not logged in");
  assertNonce(ctx, ctx.user);
  return ctx.user;
}

const idOf = (ctx: ApiCtx) => Number(ctx.form.collectionId ?? ctx.form.id ?? 0);

async function load(id: number) {
  return (await db.select().from(schema.collections).where(eq(schema.collections.id, id)).limit(1))[0] ?? null;
}

async function canWrite(id: number, userId: number): Promise<boolean> {
  const c = await load(id);
  if (!c) return false;
  if (c.userId === userId) return true;
  const cur = await db
    .select()
    .from(schema.collectionCurators)
    .where(and(eq(schema.collectionCurators.collectionId, id), eq(schema.collectionCurators.userId, userId)))
    .limit(1);
  return cur.length > 0;
}

register("collections.get", async (ctx) => {
  if (!ctx.user) return fail("not logged in");
  const single = int(ctx.query.get("id") ?? ctx.query.get("collectionId"), 0);
  if (single > 0) {
    const c = await load(single);
    if (!c) return fail("not found");
    if (!c.isPublic && c.userId !== ctx.user.userId) return fail("forbidden");
    const items = await db
      .select({ id: schema.items.id, thumb: schema.items.thumb, preview: schema.items.preview, flags: schema.items.flags })
      .from(schema.collectionItems)
      .innerJoin(schema.items, eq(schema.items.id, schema.collectionItems.itemId))
      .where(and(eq(schema.collectionItems.collectionId, c.id), itemVisible(ctx.user)))
      .orderBy(desc(schema.collectionItems.added))
      .limit(50);
    return ok({ collections: [{ ...(await toApiCollection(c, ctx.user)), items }] });
  }
  return ok({ collections: await collectionsOf(ctx.user.userId, true, ctx.user), curatorCollections: [] });
});

register("collections.create", async (ctx) => {
  const user = me(ctx);
  limit(`collection:${user.userId}`, 20, 3600);
  const name = (ctx.form.name ?? "").trim();
  if (!name || name.length > 100) return fail("invalid");
  const owned = await db.select({ id: schema.collections.id }).from(schema.collections).where(eq(schema.collections.userId, user.userId));
  if (owned.length >= 50) return fail("collection limit");
  const [c] = await db
    .insert(schema.collections)
    .values({
      userId: user.userId,
      name,
      isPublic: !["0", "false"].includes(ctx.form.isPublic ?? ""),
      created: now(),
    })
    .returning();
  return ok({ collectionId: c.id });
});

register("collections.edit", async (ctx) => {
  const user = me(ctx);
  const c = await load(idOf(ctx));
  if (!c) return fail("not found");
  if (c.userId !== user.userId) return fail("forbidden");
  const name = (ctx.form.name ?? c.name).trim() || c.name;
  const isPublic = ctx.form.isPublic === undefined ? c.isPublic : ctx.form.isPublic === "1" || ctx.form.isPublic === "true";
  await db.update(schema.collections).set({ name, isPublic }).where(eq(schema.collections.id, c.id));
  return ok({});
});

register("collections.delete", async (ctx) => {
  const user = me(ctx);
  const c = await load(idOf(ctx));
  if (!c) return fail("not found");
  if (c.userId !== user.userId) return fail("forbidden");
  if (c.isDefault) return fail("invalid");
  await db.delete(schema.collectionItems).where(eq(schema.collectionItems.collectionId, c.id));
  await db.delete(schema.subscriptions).where(eq(schema.subscriptions.collectionId, c.id));
  await db.delete(schema.collectionCurators).where(eq(schema.collectionCurators.collectionId, c.id));
  await db.delete(schema.collections).where(eq(schema.collections.id, c.id));
  return ok({});
});

register("collections.add", async (ctx) => {
  const user = me(ctx);
  const id = idOf(ctx);
  if (!(await canWrite(id, user.userId))) return fail("forbidden");
  if (!(await visibleItem(user, int(ctx.form.itemId, 0)))) return fail("not found");
  await db
    .insert(schema.collectionItems)
    .values({ collectionId: id, itemId: int(ctx.form.itemId, 0), added: now() })
    .onConflictDoNothing();
  return ok({});
});

register("collections.remove", async (ctx) => {
  const user = me(ctx);
  const id = idOf(ctx);
  if (!(await canWrite(id, user.userId))) return fail("forbidden");
  await db
    .delete(schema.collectionItems)
    .where(and(eq(schema.collectionItems.collectionId, id), eq(schema.collectionItems.itemId, int(ctx.form.itemId, 0))));
  return ok({});
});

register("collections.follow", async (ctx) => {
  const user = me(ctx);
  const c = await load(idOf(ctx));
  if (!c || (!c.isPublic && c.userId !== user.userId)) return fail("not found");
  await db.insert(schema.subscriptions).values({ userId: user.userId, collectionId: c.id }).onConflictDoNothing();
  return ok({});
});

register("collections.unfollow", async (ctx) => {
  const user = me(ctx);
  await db
    .delete(schema.subscriptions)
    .where(and(eq(schema.subscriptions.userId, user.userId), eq(schema.subscriptions.collectionId, idOf(ctx))));
  return ok({});
});

// shortcut: curators are added directly (no accept/allow/ignore handshake), add one when abuse shows up.
register("collections.addCurator", async (ctx) => {
  const user = me(ctx);
  const c = await load(idOf(ctx));
  const target = await userByName(ctx.form.name ?? "");
  if (!c || !target) return fail("not found");
  if (c.userId !== user.userId) return fail("forbidden");
  await db.insert(schema.collectionCurators).values({ collectionId: c.id, userId: target.id }).onConflictDoNothing();
  return ok({});
});

register("collections.removeCurator", async (ctx) => {
  const user = me(ctx);
  const c = await load(idOf(ctx));
  const target = await userByName(ctx.form.name ?? "");
  if (!c || !target) return fail("not found");
  if (c.userId !== user.userId && target.id !== user.userId) return fail("forbidden");
  await db
    .delete(schema.collectionCurators)
    .where(and(eq(schema.collectionCurators.collectionId, c.id), eq(schema.collectionCurators.userId, target.id)));
  return ok({});
});

// Item bookmarks (own definition; see docs/api-spec.md).
register("bookmarks.add", async (ctx) => {
  const user = me(ctx);
  if (!(await visibleItem(user, int(ctx.form.itemId, 0)))) return fail("not found");
  await db
    .insert(schema.bookmarks)
    .values({ userId: user.userId, itemId: int(ctx.form.itemId, 0), created: now() })
    .onConflictDoNothing();
  return ok({});
});

register("bookmarks.delete", async (ctx) => {
  const user = me(ctx);
  await db
    .delete(schema.bookmarks)
    .where(and(eq(schema.bookmarks.userId, user.userId), eq(schema.bookmarks.itemId, int(ctx.form.itemId, 0))));
  return ok({});
});

register("bookmarks.get", async (ctx) => {
  if (!ctx.user) return fail("not logged in");
  const rows = await db.select().from(schema.bookmarks).where(eq(schema.bookmarks.userId, ctx.user.userId));
  return ok({ bookmarks: rows.map((b) => ({ itemId: b.itemId, created: b.created })) });
});
