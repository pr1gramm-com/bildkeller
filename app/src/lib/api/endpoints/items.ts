import { and, asc, desc, eq, gt, lt, sql, notInArray } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { ok, fail } from "@/lib/api/envelope";
import { register } from "@/lib/api/router";
import type { ApiCtx, SessionUser } from "@/lib/types";
import { effectiveFlags } from "@/lib/flags";
import { wilson } from "@/lib/wilson";
import { maybePromote } from "@/lib/promote";
import { assertNonce } from "@/lib/auth";
import { uploadQuota } from "@/lib/ratelimit";

export type ApiItem = {
  id: number;
  promoted: number;
  userId: number;
  up: number;
  down: number;
  created: number;
  image: string;
  thumb: string;
  fullsize: string;
  preview: string | null;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  audio: boolean;
  source: string;
  flags: number;
  user: string;
  mark: number;
  repost: boolean;
  variants: unknown[];
};

type JoinedItemRow = {
  item: typeof schema.items.$inferSelect;
  userName: string;
  userMark: number;
};

export function toItem(row: JoinedItemRow): ApiItem {
  const it = row.item;
  return {
    id: it.id,
    promoted: it.promoted,
    userId: it.userId,
    up: it.up,
    down: it.down,
    created: it.created,
    image: it.image,
    thumb: it.thumb,
    fullsize: it.fullsize,
    preview: it.preview,
    width: it.width,
    height: it.height,
    originalWidth: it.originalWidth,
    originalHeight: it.originalHeight,
    audio: it.audio,
    source: it.source,
    flags: it.flags,
    user: row.userName,
    mark: row.userMark,
    repost: it.repost,
    variants: [],
  };
}

export async function blockedUserIds(user: SessionUser | null): Promise<number[]> {
  if (!user) return [];
  const rows = await db
    .select({ id: schema.blocks.blockedUserId })
    .from(schema.blocks)
    .where(eq(schema.blocks.userId, user.userId));
  return rows.map((r) => r.id);
}

const PAGE = 50;

export async function itemsGet(ctx: ApiCtx) {  const user = ctx.user;
  const flags = effectiveFlags(user, Number(ctx.query.get("flags") ?? 31) || 31);
  const promoted = Number(ctx.query.get("promoted") ?? 0);
  const showJunk = ctx.query.get("show_junk") === "1";
  const older = Number(ctx.query.get("older") ?? 0);
  const userName = ctx.query.get("user");

  const conds = [
    eq(schema.items.deleted, false),
    sql`(${schema.items.flags} & ${flags}) != 0`,
  ];
  if (!showJunk) conds.push(eq(schema.items.junk, false));
  if (promoted === 1) conds.push(gt(schema.items.promoted, 0));
  if (older > 0) conds.push(lt(schema.items.id, older));
  if (userName) conds.push(sql`lower(${schema.users.name}) = ${userName.toLowerCase()}`);
  const blocked = await blockedUserIds(user);
  if (blocked.length > 0) conds.push(notInArray(schema.items.userId, blocked));

  const rows = await db
    .select({
      item: schema.items,
      userName: schema.users.name,
      userMark: schema.users.mark,
    })
    .from(schema.items)
    .innerJoin(schema.users, eq(schema.users.id, schema.items.userId))
    .where(and(...conds))
    .orderBy(
      ...(promoted === 1 ? [desc(schema.items.promoted), desc(schema.items.id)] : [desc(schema.items.id)]),
    )
    .limit(PAGE + 1);

  const page = rows.slice(0, PAGE);
  return ok({
    items: page.map(toItem),
    atStart: older === 0,
    atEnd: rows.length <= PAGE,
  });
}

export async function requireUser(ctx: ApiCtx): Promise<SessionUser> {
  if (!ctx.user) throw new Error("not logged in");
  return ctx.user;
}

const day = () => {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

export async function voteTarget(
  table: "items" | "comments",
  id: number,
  up: boolean,
  userId: number,
): Promise<void> {
  const idCol = table === "items" ? schema.votes.itemId : schema.votes.commentId;
  const existing = await db
    .select()
    .from(schema.votes)
    .where(and(eq(schema.votes.userId, userId), eq(idCol, id)))
    .limit(1);

  const upCol = table === "items" ? schema.items.up : schema.comments.up;
  const downCol = table === "items" ? schema.items.down : schema.comments.down;

  if (existing.length === 0) {
    await db.insert(schema.votes).values(
      table === "items"
        ? { userId, itemId: id, up, created: Math.floor(Date.now() / 1000) }
        : { userId, commentId: id, up, created: Math.floor(Date.now() / 1000) },
    );
    await db
      .update(table === "items" ? schema.items : schema.comments)
      .set(up ? { up: sql`${upCol} + 1` } : { down: sql`${downCol} + 1` })
      .where(eq(table === "items" ? schema.items.id : schema.comments.id, id));
  } else if (existing[0].up === up) {
    await db.delete(schema.votes).where(eq(schema.votes.id, existing[0].id));
    await db
      .update(table === "items" ? schema.items : schema.comments)
      .set(up ? { up: sql`greatest(${upCol} - 1, 0)` } : { down: sql`greatest(${downCol} - 1, 0)` })
      .where(eq(table === "items" ? schema.items.id : schema.comments.id, id));
  } else {
    await db.update(schema.votes).set({ up }).where(eq(schema.votes.id, existing[0].id));
    await db
      .update(table === "items" ? schema.items : schema.comments)
      .set(
        up
          ? { up: sql`${upCol} + 1`, down: sql`greatest(${downCol} - 1, 0)` }
          : { down: sql`${downCol} + 1`, up: sql`greatest(${upCol} - 1, 0)` },
      )
      .where(eq(table === "items" ? schema.items.id : schema.comments.id, id));
  }
}

export async function itemsInfo(ctx: ApiCtx) {
  const id = Number(ctx.query.get("itemId") ?? 0);
  const rows = await db
    .select({ item: schema.items, userName: schema.users.name, userMark: schema.users.mark })
    .from(schema.items)
    .innerJoin(schema.users, eq(schema.users.id, schema.items.userId))
    .where(and(eq(schema.items.id, id), eq(schema.items.deleted, false)))
    .limit(1);
  const row = rows[0];
  if (!row || (row.item.flags & effectiveFlags(ctx.user, 31)) === 0) {
    return fail("not found");
  }

  // views: one row per day, incremented per info request
  await db
    .insert(schema.itemViews)
    .values({ itemId: id, day: day(), count: 1 })
    .onConflictDoUpdate({
      target: [schema.itemViews.itemId, schema.itemViews.day],
      set: { count: sql`${schema.itemViews.count} + 1` },
    });
  const viewsRows = await db
    .select({ total: sql<number>`coalesce(sum(${schema.itemViews.count}), 0)::int` })
    .from(schema.itemViews)
    .where(eq(schema.itemViews.itemId, id));

  const tagRows = await db
    .select({
      id: schema.itemTags.tagId,
      up: schema.itemTags.up,
      down: schema.itemTags.down,
      tag: schema.tags.tag,
    })
    .from(schema.itemTags)
    .innerJoin(schema.tags, eq(schema.tags.id, schema.itemTags.tagId))
    .where(eq(schema.itemTags.itemId, id))
    .orderBy(desc(sql`${schema.itemTags.up} - ${schema.itemTags.down}`));

  const commentRows = await db
    .select({ comment: schema.comments, userName: schema.users.name, userMark: schema.users.mark })
    .from(schema.comments)
    .innerJoin(schema.users, eq(schema.users.id, schema.comments.userId))
    .where(and(eq(schema.comments.itemId, id), eq(schema.comments.deleted, false)))
    .orderBy(asc(schema.comments.id));

  return ok({
    tags: tagRows.map((t) => ({ id: t.id, tag: t.tag, confidence: wilson(t.up, t.down) })),
    comments: commentRows.map((c) => ({
      id: c.comment.id,
      parent: c.comment.parentId,
      content: c.comment.content,
      created: c.comment.created,
      editedAt: c.comment.editedAt,
      editCount: c.comment.editCount,
      up: c.comment.up,
      down: c.comment.down,
      confidence: wilson(c.comment.up, c.comment.down),
      name: c.userName,
      mark: c.userMark,
      blocked: false,
    })),
    views: Number(viewsRows[0]?.total ?? 0),
  });
}

register("items.get", itemsGet);
register("items.info", itemsInfo);

register("items.post", async (ctx) => {
  const user = await requireUser(ctx);
  assertNonce(ctx, user);

  const flagsMap: Record<string, number> = { sfw: 1, nsfw: 2, nsfl: 4, nsfp: 8, pol: 16 };
  const flags = flagsMap[ctx.form.sfwstatus ?? "sfw"] ?? 1;
  if ((flags & 6) !== 0 && !user.verified) return fail("verification required");

  const tagNames = (ctx.form.tags ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tagNames.length > 16) return fail("taglimit");

  const key = ctx.form.key ?? "";
  const upRows = await db
    .select()
    .from(schema.uploads)
    .where(and(eq(schema.uploads.key, key), eq(schema.uploads.userId, user.userId)))
    .limit(1);
  const up = upRows[0];
  if (!up) return fail("invalid key");

  const dup = await db
    .select({ id: schema.items.id })
    .from(schema.items)
    .where(and(eq(schema.items.dhash, up.dhash), eq(schema.items.deleted, false)))
    .limit(1);
  if (dup.length > 0) return fail("similar");

  const [item] = await db
    .insert(schema.items)
    .values({
      userId: user.userId,
      flags,
      image: up.image,
      thumb: up.thumb,
      fullsize: up.fullsize,
      width: up.width,
      height: up.height,
      originalWidth: up.originalWidth,
      originalHeight: up.originalHeight,
      audio: up.audio,
      source: ctx.form.source ?? "",
      created: Math.floor(Date.now() / 1000),
      key: up.key,
      dhash: up.dhash,
    })
    .returning();

  for (const name of tagNames) {
    const existing = await db.select().from(schema.tags).where(eq(schema.tags.tag, name)).limit(1);
    const tag =
      existing[0] ??
      (await db.insert(schema.tags).values({ tag: name }).returning())[0];
    await db
      .insert(schema.itemTags)
      .values({ itemId: item.id, tagId: tag.id })
      .onConflictDoNothing();
  }

  const collectionId = Number(ctx.form.targetCollectionId ?? 0);
  if (collectionId > 0) {
    const col = await db
      .select()
      .from(schema.collections)
      .where(and(eq(schema.collections.id, collectionId), eq(schema.collections.userId, user.userId)))
      .limit(1);
    if (col[0]) {
      await db
        .insert(schema.collectionItems)
        .values({ collectionId, itemId: item.id, added: item.created })
        .onConflictDoNothing();
    }
  }

  await db.delete(schema.uploads).where(eq(schema.uploads.key, key));
  return ok({ itemId: item.id, promoted: item.promoted, flags: item.flags });
});

register("items.vote", async (ctx) => {
  const user = await requireUser(ctx);
  assertNonce(ctx, user);
  const id = Number(ctx.form.id ?? 0);
  const up = ctx.form.up === "1" || ctx.form.up === "true";
  await voteTarget("items", id, up, user.userId);
  await maybePromote(id);
  return ok({});
});

register("comments.vote", async (ctx) => {
  const user = await requireUser(ctx);
  assertNonce(ctx, user);
  const id = Number(ctx.form.id ?? 0);
  const up = ctx.form.up === "1" || ctx.form.up === "true";
  await voteTarget("comments", id, up, user.userId);
  return ok({});
});

register("items.ratelimited", async (ctx) => {
  const user = await requireUser(ctx);
  return ok({ left: await uploadQuota(user.userId) });
});

register("items.delete", async (ctx) => {
  const user = await requireUser(ctx);
  assertNonce(ctx, user);
  const id = Number(ctx.form.id ?? 0);
  const rows = await db.select().from(schema.items).where(eq(schema.items.id, id)).limit(1);
  const item = rows[0];
  if (!item) return fail("not found");
  if (item.userId !== user.userId && !user.mod && !user.admin) return fail("forbidden");
  await db.update(schema.items).set({ deleted: true }).where(eq(schema.items.id, id));
  return ok({});
});
