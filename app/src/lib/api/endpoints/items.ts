import { ApiError } from "@/lib/api/envelope";
import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { and, asc, desc, eq, gte, gt, inArray, lt, or, sql, notInArray, type SQL } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { ok, fail } from "@/lib/api/envelope";
import { register } from "@/lib/api/router";
import { int } from "@/lib/params";
import type { ApiCtx, SessionUser } from "@/lib/types";
import { effectiveFlags } from "@/lib/flags";
import { wilson } from "@/lib/wilson";
import { maybePromote } from "@/lib/promote";
import { assertNonce } from "@/lib/auth";
import { fetchRemote } from "@/lib/fetchurl";
import { limit } from "@/lib/limiter";
import { uploadQuota } from "@/lib/ratelimit";
import { parseTagQuery, type Term, type QueryExpression } from "@/lib/tagquery";
import { logEvent } from "@/lib/sync";
import { visibleComment, visibleItem } from "@/lib/visibility";
import { addTag } from "@/lib/tags";
import { changeSettings, getSettings } from "@/lib/settings";
import { itemHistory } from "@/lib/item-history";
import { avatarPath } from "@/lib/avatar-path";

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

const MAX_PAGE = 50;

export async function itemsGet(ctx: ApiCtx) {  const user = ctx.user;
  const flags = effectiveFlags(user, int(ctx.query.get("flags"), 31));
  const promoted = int(ctx.query.get("promoted"), 0);
  const showJunk = ctx.query.get("show_junk") === "1";
  const idParam = int(ctx.query.get("id"), 0);
  const older = idParam > 0 ? idParam + 1 : int(ctx.query.get("older"), 0);
  const pageSize = Math.min(Math.max(int(ctx.query.get("limit"), MAX_PAGE), 1), MAX_PAGE);
  const junkOnly = ctx.query.get("junk") === "1";
  const tq = parseTagQuery(ctx.query.get("tags") ?? "");
  if (tq.invalid) return fail("invalid query");
  const userList = ctx.query.get("users")
    ? ctx.query.get("users")!.split(",").map((u) => u.trim()).filter(Boolean)
    : [];
  const singleUser = (ctx.query.get("user") ?? "").trim();
  const preferences = user ? await getSettings(user.userId) : null;
  const history = itemHistory(preferences?.seenItems ?? "[]");
  const historyFeed = ctx.query.get("history") === "1";
  const collectionId = int(ctx.query.get("collection"), 0);
  const subscriptionsFeed = ctx.query.get("subscribed") === "1";
  if (subscriptionsFeed && !user) return fail("not logged in");
  if (historyFeed && !user) return fail("not logged in");
  if (collectionId) {
    const [collection] = await db.select().from(schema.collections).where(eq(schema.collections.id, collectionId)).limit(1);
    if (!collection || (!collection.isPublic && collection.userId !== user?.userId)) return fail("not found");
  }

  const hasTag = (tag: string) =>
    sql`exists (select 1 from item_tags it join tags t on t.id = it.tag_id where it.item_id = ${schema.items.id} and t.tag = ${tag})`;
  const hasTagLike = (tag: string) =>
    sql`exists (select 1 from item_tags it join tags t on t.id = it.tag_id where it.item_id = ${schema.items.id} and t.tag ilike ${`%${tag}%`})`;

  // One criterion per term; "exclude" terms are negated inside their AND-group.
  const termSql = (t: Term) => {
    switch (t.kind) {
      case "tag":
        return t.exclude ? sql`not ${t.exact ? hasTag(t.value) : hasTagLike(t.value)}` : t.exact ? hasTag(t.value) : hasTagLike(t.value);
      case "user":
        return t.exclude
          ? sql`lower(${schema.users.name}) != ${t.value.toLowerCase()}`
          : sql`lower(${schema.users.name}) = ${t.value.toLowerCase()}`;
      case "score":
        return t.exclude
          ? sql`(${schema.items.up} - ${schema.items.down}) < ${t.value}`
          : sql`(${schema.items.up} - ${schema.items.down}) >= ${t.value}`;
      case "mark":
        return t.exclude
          ? sql`${schema.users.mark} != ${t.value}`
          : sql`${schema.users.mark} >= ${t.value}`;
      case "date": {
        const inRange =
          t.from !== null && t.to !== null
            ? sql`${schema.items.created} between ${t.from} and ${t.to}`
            : t.from !== null
              ? sql`${schema.items.created} >= ${t.from}`
              : sql`${schema.items.created} <= ${t.to}`;
        return t.exclude ? sql`not (${inRange})` : inRange;
      }
      case "res":
        return t.exclude
          ? sql`(${schema.items.width} < ${t.width} or ${schema.items.height} < ${t.height})`
          : sql`(${schema.items.width} >= ${t.width} and ${schema.items.height} >= ${t.height})`;
      case "media":
        if (t.value === "video") return sql`${schema.items.image} !~ '\\.(webm|mp4|mov)$'`;
        if (t.value === "sound") return eq(schema.items.audio, false);
        return eq(schema.items.repost, false);
    }
  };

  const groups = tq.groups.map((g) => and(...g.map(termSql)) as SQL).filter(Boolean);
  const conds = [
    eq(schema.items.deleted, false),
    sql`(${schema.items.flags} & ${flags}) != 0`,
  ];
  if (ctx.query.get("media") === "video") conds.push(sql`${schema.items.image} ~ '\\.(webm|mp4|mov)$'`);
  const expressionSql = (expression: QueryExpression): SQL => {
    if (expression.type === "term") return termSql(expression.term);
    if (expression.type === "not") return sql`not (${expressionSql(expression.child)})`;
    const parts = expression.children.map(expressionSql);
    return (expression.type === "and" ? and(...parts) : or(...parts)) as SQL;
  };
  if (tq.expression) conds.push(expressionSql(tq.expression));
  if (groups.length === 1) conds.push(groups[0]);
  else if (groups.length > 1) conds.push(or(...groups) as SQL);
  if (!showJunk && !junkOnly) conds.push(eq(schema.items.junk, false));
  if (junkOnly) {
    // The trash holds your own junk posts; moderators see everyone's.
    conds.push(eq(schema.items.junk, true));
    if (!user?.mod && !user?.admin) conds.push(eq(schema.items.userId, user?.userId ?? 0));
  }
  if (promoted === 1) conds.push(gt(schema.items.promoted, 0));
  const collectionAdded = sql`(select ci.added from collection_items ci where ci.collection_id = ${collectionId} and ci.item_id = ${schema.items.id})`;
  const randomOrder = sql`md5(${schema.items.id}::text || ':' || ${tq.randomSeed ?? ""})`;
  const subscribedAddition = sql`(select max(ci.added) from collection_items ci
    join subscriptions s on s.collection_id = ci.collection_id
    join collections c on c.id = ci.collection_id
    where ci.item_id = ${schema.items.id} and s.user_id = ${user?.userId ?? 0}
    and (c.is_public or c.user_id = ${user?.userId ?? 0}))`;
  const subscriptionOrder = sql`greatest(${schema.items.created}, coalesce(${subscribedAddition}, ${schema.items.created}))`;
  if (subscriptionsFeed) conds.push(sql`(${subscribedAddition} is not null or exists (
    select 1 from follows f where f.follower_id = ${user!.userId} and f.followee_id = ${schema.items.userId}))`);
  if (collectionId) conds.push(sql`exists (select 1 from collection_items ci where ci.collection_id = ${collectionId} and ci.item_id = ${schema.items.id})`);
  if (historyFeed) {
    const start = idParam ? history.indexOf(idParam) : older ? history.indexOf(older) + 1 : 0;
    conds.push(inArray(schema.items.id, start < 0 ? [] : history.slice(start)));
  } else if (subscriptionsFeed && older > 0) {
    const cursor = idParam || older;
    const [entry] = await db.select({ time: subscriptionOrder }).from(schema.items).where(eq(schema.items.id, cursor)).limit(1);
    conds.push(entry ? idParam
      ? sql`(${subscriptionOrder}, ${schema.items.id}) <= (${entry.time}, ${cursor})`
      : sql`(${subscriptionOrder}, ${schema.items.id}) < (${entry.time}, ${cursor})` : sql`false`);
  } else if (tq.randomSeed && older > 0) {
    const cursor = idParam || older;
    const cursorHash = sql`md5(${String(cursor)} || ':' || ${tq.randomSeed})`;
    conds.push(idParam
      ? sql`(${randomOrder}, ${schema.items.id}) >= (${cursorHash}, ${cursor})`
      : sql`(${randomOrder}, ${schema.items.id}) > (${cursorHash}, ${cursor})`);
  } else if (collectionId && older > 0) {
    const cursor = idParam || older;
    const [entry] = await db.select().from(schema.collectionItems).where(and(eq(schema.collectionItems.collectionId, collectionId), eq(schema.collectionItems.itemId, cursor))).limit(1);
    conds.push(entry
      ? idParam ? sql`(${collectionAdded}, ${schema.items.id}) <= (${entry.added}, ${cursor})` : sql`(${collectionAdded}, ${schema.items.id}) < (${entry.added}, ${cursor})`
      : sql`false`);
  } else if (older > 0 && promoted === 1) {
    // Popular feed is ordered by (promoted, id): page by that pair, not by id alone.
    const cursor = idParam || older;
    const cur = (await db.select({ p: schema.items.promoted }).from(schema.items).where(eq(schema.items.id, cursor)).limit(1))[0];
    conds.push(cur
      ? idParam > 0
        ? sql`(${schema.items.promoted}, ${schema.items.id}) <= (${cur.p}, ${cursor})`
        : sql`(${schema.items.promoted}, ${schema.items.id}) < (${cur.p}, ${cursor})`
      : lt(schema.items.id, older));
  } else if (older > 0) conds.push(lt(schema.items.id, older));
  if (userList.length > 0) {
    conds.push(inArray(sql`lower(${schema.users.name})`, userList.map((u) => u.toLowerCase())));
  } else if (singleUser) {
    conds.push(sql`lower(${schema.users.name}) = ${singleUser.toLowerCase()}`);
  }
  const blocked = await blockedUserIds(user);
  if (blocked.length > 0) conds.push(notInArray(schema.items.userId, blocked));
  if (user) conds.push(sql`not exists (
    select 1 from item_tags it join blocked_tags bt on bt.tag_id = it.tag_id
    where it.item_id = ${schema.items.id} and bt.user_id = ${user.userId}
  )`);

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
      ...(historyFeed ? [sql`array_position(${`{${history.join(",")}}`}::bigint[], ${schema.items.id})`] : subscriptionsFeed ? [desc(subscriptionOrder), desc(schema.items.id)] : tq.randomSeed ? [asc(randomOrder), asc(schema.items.id)] : collectionId ? [desc(collectionAdded), desc(schema.items.id)] : promoted === 1 ? [desc(schema.items.promoted), desc(schema.items.id)] : [desc(schema.items.id)]),
    )
    .limit(pageSize + 1);

  const page = rows.slice(0, pageSize);
  return ok({
    items: page.map(toItem),
    atStart: older === 0,
    atEnd: rows.length <= pageSize,
    seen: preferences?.markSeenItems ? page.map((r) => r.item.id).filter((id) => history.includes(id)) : [],
  });
}

export async function requireUser(ctx: ApiCtx): Promise<SessionUser> {
  if (!ctx.user) throw new ApiError("not logged in");
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
  toggle = true,
): Promise<boolean> {
  const idCol = table === "items" ? schema.votes.itemId : schema.votes.commentId;
  const target = table === "items" ? schema.items : schema.comments;
  const upCol = table === "items" ? schema.items.up : schema.comments.up;
  const downCol = table === "items" ? schema.items.down : schema.comments.down;

  // Serialize per (user, target): the vote row and the denormalized counters change atomically.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`vote:${table}:${userId}:${id}`}))`);
    const existing = (await tx.select().from(schema.votes).where(and(eq(schema.votes.userId, userId), eq(idCol, id))).limit(1))[0];
    if (!toggle && existing?.up === up) return false;
    if (!existing) {
      await tx.insert(schema.votes).values(
        table === "items"
          ? { userId, itemId: id, up, created: Math.floor(Date.now() / 1000) }
          : { userId, commentId: id, up, created: Math.floor(Date.now() / 1000) },
      );
      await tx.update(target).set(up ? { up: sql`${upCol} + 1` } : { down: sql`${downCol} + 1` }).where(eq(target.id, id));
    } else if (existing.up === up) {
      await tx.delete(schema.votes).where(eq(schema.votes.id, existing.id));
      await tx.update(target).set(up ? { up: sql`greatest(${upCol} - 1, 0)` } : { down: sql`greatest(${downCol} - 1, 0)` }).where(eq(target.id, id));
    } else {
      await tx.update(schema.votes).set({ up }).where(eq(schema.votes.id, existing.id));
      await tx
        .update(target)
        .set(up ? { up: sql`${upCol} + 1`, down: sql`greatest(${downCol} - 1, 0)` } : { down: sql`${downCol} + 1`, up: sql`greatest(${upCol} - 1, 0)` })
        .where(eq(target.id, id));
    }
    return true;
  });
}

export async function itemsInfo(ctx: ApiCtx) {
  const id = int(ctx.query.get("itemId"), 0);
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
  const preferences = ctx.user ? await getSettings(ctx.user.userId) : null;
  if (ctx.user && preferences?.enableItemHistory) {
    await changeSettings(ctx.user.userId, (current) => ({ ...current, seenItems: JSON.stringify([id, ...itemHistory(current.seenItems).filter((seen) => seen !== id)].slice(0, 1000)) }));
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
    .select({ comment: schema.comments, userName: schema.users.name, userMark: schema.users.mark, settings: schema.userSettings.settings })
    .from(schema.comments)
    .innerJoin(schema.users, eq(schema.users.id, schema.comments.userId))
    .leftJoin(schema.userSettings, eq(schema.userSettings.userId, schema.users.id))
    .where(and(eq(schema.comments.itemId, id), eq(schema.comments.deleted, false)))
    .orderBy(asc(schema.comments.id));

  const blocked = new Set(await blockedUserIds(ctx.user));
  const votes = ctx.user ? await db.select({ itemId: schema.votes.itemId, commentId: schema.votes.commentId, up: schema.votes.up })
    .from(schema.votes).where(and(eq(schema.votes.userId, ctx.user.userId), or(
      eq(schema.votes.itemId, id),
      inArray(schema.votes.commentId, commentRows.map((r) => r.comment.id)),
    ))) : [];
  const commentVotes = new Map(votes.filter((v) => v.commentId !== null).map((v) => [v.commentId, v.up]));
  const favorites = ctx.user
    ? await db
        .select({ commentId: schema.commentFavorites.commentId })
        .from(schema.commentFavorites)
        .where(eq(schema.commentFavorites.userId, ctx.user.userId))
        .then((rows) => rows.map((r) => r.commentId))
    : [];
  const collectionIds = ctx.user ? await db
    .select({ id: schema.collections.id })
    .from(schema.collectionItems)
    .innerJoin(schema.collections, eq(schema.collections.id, schema.collectionItems.collectionId))
    .where(and(eq(schema.collectionItems.itemId, id), eq(schema.collections.userId, ctx.user.userId)))
    .then((rows) => rows.map((r) => r.id)) : [];
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
      avatar: avatarPath((c.settings as Record<string, unknown> | null)?.avatar),
      blocked: blocked.has(c.comment.userId),
      vote: commentVotes.get(c.comment.id) ?? null,
    })),
    views: Number(viewsRows[0]?.total ?? 0),
    favorites,
    collectionIds,
    vote: votes.find((v) => v.itemId === id)?.up ?? null,
    seen: preferences?.enableItemHistory ?? false,
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

  const source = (ctx.form.source ?? "").trim();
  if (source && (source.length > 500 || !/^https?:\/\//i.test(source))) return fail("invalid");
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
      source,
      created: Math.floor(Date.now() / 1000),
      key: up.key,
      dhash: up.dhash,
    })
    .returning();

  for (const name of tagNames) await addTag(item.id, user.userId, name);

  const collectionId = int(ctx.form.targetCollectionId, 0);
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
  const comment = (ctx.form.comment ?? "").trim();
  if (comment && comment.length <= 2000) {
    await db.insert(schema.comments).values({ itemId: item.id, parentId: 0, userId: user.userId, content: comment, created: Math.floor(Date.now() / 1000) });
  }
  await db.insert(schema.notifications).values({
    userId: user.userId,
    type: "system",
    refId: item.id,
    content: `Dein Hochlad wurde veröffentlicht: /item/${item.id}`,
    created: Math.floor(Date.now() / 1000),
  });
  return ok({ itemId: item.id, promoted: item.promoted, flags: item.flags });
});

register("items.vote", async (ctx) => {
  const user = await requireUser(ctx);
  assertNonce(ctx, user);
  const id = int(ctx.form.id, 0);
  const up = ctx.form.up === "1" || ctx.form.up === "true";
  if (!(await visibleItem(user, id))) return fail("not found");
  await voteTarget("items", id, up, user.userId);
  await logEvent(user.userId, "vote", { target: "item", id, up });
  await maybePromote(id);
  return ok({});
});

register("comments.vote", async (ctx) => {
  const user = await requireUser(ctx);
  assertNonce(ctx, user);
  const id = int(ctx.form.id, 0);
  const up = ctx.form.up === "1" || ctx.form.up === "true";
  if (!(await visibleComment(user, id))) return fail("not found");
  await voteTarget("comments", id, up, user.userId);
  await logEvent(user.userId, "vote", { target: "comment", id, up });
  return ok({});
});

register("items.ratelimited", async (ctx) => {
  const user = await requireUser(ctx);
  return ok({ left: await uploadQuota(user.userId) });
});

/** Mülltrennung: the owner (or a moderator) marks a post as junk so it leaves the normal feed. */
register("items.setjunk", async (ctx) => {
  const user = await requireUser(ctx);
  assertNonce(ctx, user);
  const id = int(ctx.form.id, 0);
  const junk = ctx.form.junk === "1" || ctx.form.junk === "true";
  const rows = await db.select().from(schema.items).where(eq(schema.items.id, id)).limit(1);
  const item = rows[0];
  if (!item) return fail("not found");
  if (item.userId !== user.userId && !user.mod && !user.admin) return fail("forbidden");
  await db.update(schema.items).set({ junk }).where(eq(schema.items.id, id));
  return ok({ junk });
});

/** Number of uploads per day, for the calendar. */
register("items.calendar", async (ctx) => {
  const mask = effectiveFlags(ctx.user, int(ctx.query.get("flags"), 31));
  const year = int(ctx.query.get("year"), 0);
  const month = int(ctx.query.get("month"), 0);
  if (!year || !month) return fail("invalid");
  const from = Math.floor(Date.UTC(year, month - 1, 1) / 1000);
  const to = Math.floor(Date.UTC(year, month, 1) / 1000);
  const rows = await db
    .select({ day: sql<number>`to_char(to_timestamp(${schema.items.created}), 'YYYY-MM-DD')`, count: sql<number>`count(*)::int` })
    .from(schema.items)
    .where(and(eq(schema.items.deleted, false), gte(schema.items.created, from), lt(schema.items.created, to), sql`(${schema.items.flags} & ${mask}) != 0`))
    .groupBy(sql`1`);
  return ok({ days: rows });
});

/** Reverse image search: finds posts with the same file (the reference board matches by image hash). */
register("items.reverse", async (ctx) => {
  const user = await requireUser(ctx);
  assertNonce(ctx, user);
  limit(`reverse:${user.userId}`, 10, 60);
  const url = (ctx.form.url ?? "").trim();
  if (!url) return fail("invalid");
  const max = Number(process.env.MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024);
  let buf: Buffer;
  try {
    buf = await fetchRemote(url, max);
  } catch {
    return fail("invalid url");
  }
  const dhash = createHash("sha256").update(buf).digest("hex");
  const rows = await db
    .select({ item: schema.items, userName: schema.users.name, userMark: schema.users.mark })
    .from(schema.items)
    .innerJoin(schema.users, eq(schema.users.id, schema.items.userId))
    .where(and(eq(schema.items.dhash, dhash), eq(schema.items.deleted, false)))
    .orderBy(desc(schema.items.id))
    .limit(20);
  return ok({ items: rows.map(toItem) });
});

register("items.delete", async (ctx) => {
  const user = await requireUser(ctx);
  assertNonce(ctx, user);
  const id = int(ctx.form.id, 0);
  const rows = await db.select().from(schema.items).where(eq(schema.items.id, id)).limit(1);
  const item = rows[0];
  if (!item) return fail("not found");
  if (item.userId !== user.userId && !user.mod && !user.admin) return fail("forbidden");
  await db.update(schema.items).set({ deleted: true }).where(eq(schema.items.id, id));
  // Removed content must not stay reachable under its immutable-cached media URL.
  const root = path.resolve(process.env.MEDIA_DIR ?? "./data/media");
  await Promise.all([item.image, item.thumb].map((f) => rm(path.join(root, f), { force: true })));
  return ok({});
});
