import { ApiError } from "@/lib/api/envelope";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { fail, ok } from "@/lib/api/envelope";
import { register } from "@/lib/api/router";
import { assertNonce } from "@/lib/auth";
import { benis } from "@/lib/benis";
import { collectionsOf, toApiCollection, userByName } from "@/lib/collections";
import { effectiveFlags } from "@/lib/flags";
import { int } from "@/lib/params";
import { itemVisible } from "@/lib/visibility";
import { userStatus } from "@/lib/status";
import type { ApiCtx, SessionUser } from "@/lib/types";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/notifications";
import { avatarPath } from "@/lib/avatar-path";

const now = () => Math.floor(Date.now() / 1000);
const count = (q: Promise<Array<{ c: number }>>) => q.then((r) => Number(r[0].c));

function requireUser(ctx: ApiCtx): SessionUser {
  if (!ctx.user) throw new ApiError("not logged in");
  assertNonce(ctx, ctx.user);
  return ctx.user;
}

async function targetOf(ctx: ApiCtx, key: "name" | "tag" = "name") {
  const raw = ctx.form[key] ?? ctx.query.get(key) ?? "";
  return userByName(raw);
}

register("profile.info", async (ctx) => {
  const target = await userByName(ctx.query.get("name") ?? "");
  if (!target || target.deleted) return fail("not found");
  const mask = effectiveFlags(ctx.user, int(ctx.query.get("flags"), 31));
  const visible = and(
    eq(schema.items.userId, target.id),
    eq(schema.items.deleted, false),
    sql`(${schema.items.flags} & ${mask}) != 0`,
  );
  const viewer = ctx.user?.userId ?? 0;
  const isSelf = viewer === target.id;
  const preferences = await getSettings(target.id);

  const [uploads, uploadCount, commentCount, favCount, followers, updown, comments, isFollowing, isBlocked, collections, collectedCount] =
    await Promise.all([
      db
        .select({ id: schema.items.id, thumb: schema.items.thumb, preview: schema.items.preview, flags: schema.items.flags })
        .from(schema.items)
        .where(visible)
        .orderBy(desc(schema.items.id))
        .limit(32),
      count(db.select({ c: sql<number>`count(*)::int` }).from(schema.items).where(visible)),
      count(
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.comments)
          .where(and(eq(schema.comments.userId, target.id), eq(schema.comments.deleted, false))),
      ),
      count(
        db.select({ c: sql<number>`count(*)::int` }).from(schema.commentFavorites).where(eq(schema.commentFavorites.userId, target.id)),
      ),
      count(db.select({ c: sql<number>`count(*)::int` }).from(schema.follows).where(eq(schema.follows.followeeId, target.id))),
      db
        .select({
          up: sql<number>`coalesce(sum(${schema.items.up}), 0)::int`,
          down: sql<number>`coalesce(sum(${schema.items.down}), 0)::int`,
        })
        .from(schema.items)
        .where(eq(schema.items.userId, target.id)),
      db
        .select({
          id: schema.comments.id,
          up: schema.comments.up,
          down: schema.comments.down,
          content: schema.comments.content,
          created: schema.comments.created,
          itemId: schema.comments.itemId,
          thumb: schema.items.thumb,
        })
        .from(schema.comments)
        .innerJoin(schema.items, eq(schema.items.id, schema.comments.itemId))
        .where(
          and(
            eq(schema.comments.userId, target.id),
            eq(schema.comments.deleted, false),
            eq(schema.items.deleted, false),
            sql`(${schema.items.flags} & ${mask}) != 0`,
          ),
        )
        .orderBy(desc(schema.comments.id))
        .limit(20),
      count(
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.follows)
          .where(and(eq(schema.follows.followerId, viewer), eq(schema.follows.followeeId, target.id))),
      ),
      count(
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.blocks)
          .where(and(eq(schema.blocks.userId, viewer), eq(schema.blocks.blockedUserId, target.id))),
      ),
      collectionsOf(target.id, isSelf, ctx.user),
      count(
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.collectionItems)
          .innerJoin(schema.collections, eq(schema.collections.id, schema.collectionItems.collectionId))
          .where(eq(schema.collections.userId, target.id)),
      ),
    ]);

  return ok({
    user: {
      id: target.id,
      name: target.name,
      isSameTeam: false,
      registered: target.created,
      score: await benis(target.id),
      up: updown[0].up,
      down: updown[0].down,
      mark: target.mark,
      banned: 0,
      bannedUntil: target.bannedUntil,
      inactive: target.inactiveUntil && target.inactiveUntil > now() ? 1 : 0,
      commentDelete: 0,
      itemDelete: 0,
      canReceiveMessages: true,
      avatar: avatarPath(preferences.avatar),
      avatarId: 0,
    },
    badges: [],
    background: target.background ?? "",
    status: userStatus(target.created).label,
    blocked: isBlocked > 0,
    collectedCount,
    collections,
    commentCount,
    commentLikesCount: favCount,
    comments,
    comments_likes: [],
    curatorCollections: [],
    followCount: followers,
    following: isFollowing > 0,
    subscribed: isFollowing > 0, // shortcut: subscribe == follow, split when notification prefs exist
    likesArePublic: preferences.likesArePublic,
    pr0mium: false,
    pr0miumGift: false,
    tagCount: 0, // shortcut: tag authorship is not tracked yet
    uploadCount,
    uploads,
  });
});

register("profile.comments", async (ctx) => {
  const target = await userByName(ctx.query.get("name") ?? "");
  if (!target) return fail("not found");
  const mask = effectiveFlags(ctx.user, int(ctx.query.get("flags"), 31));
  const before = int(ctx.query.get("before"), 0);
  const rows = await db
    .select({
      id: schema.comments.id,
      up: schema.comments.up,
      down: schema.comments.down,
      content: schema.comments.content,
      created: schema.comments.created,
      itemId: schema.comments.itemId,
      thumb: schema.items.thumb,
    })
    .from(schema.comments)
    .innerJoin(schema.items, eq(schema.items.id, schema.comments.itemId))
    .where(
      and(
        eq(schema.comments.userId, target.id),
        eq(schema.comments.deleted, false),
        eq(schema.items.deleted, false),
        sql`(${schema.items.flags} & ${mask}) != 0`,
        before > 0 ? sql`${schema.comments.id} < ${before}` : undefined,
      ),
    )
    .orderBy(desc(schema.comments.id))
    .limit(21);
  return ok({ comments: rows.slice(0, 20), hasOlder: rows.length > 20 });
});

// The owner controls whether their comment favorites are public.
register("profile.commentlikes", async (ctx) => {
  const name = ctx.query.get("name") ?? ctx.user?.name;
  if (!name) return fail("not logged in");
  const owner = await userByName(name);
  if (!owner || owner.deleted) return fail("not found");
  if (owner.id !== ctx.user?.userId && !(await getSettings(owner.id)).likesArePublic) return fail("forbidden");
  const before = int(ctx.query.get("before"), 0);
  const rows = await db
    .select({
      id: schema.comments.id,
      up: schema.comments.up,
      down: schema.comments.down,
      content: schema.comments.content,
      created: schema.comments.created,
      itemId: schema.comments.itemId,
      thumb: schema.items.thumb,
    })
    .from(schema.commentFavorites)
    .innerJoin(schema.comments, eq(schema.comments.id, schema.commentFavorites.commentId))
    .innerJoin(schema.items, eq(schema.items.id, schema.comments.itemId))
    .where(and(eq(schema.commentFavorites.userId, owner.id), eq(schema.comments.deleted, false), itemVisible(ctx.user), before > 0 ? sql`${schema.comments.id} < ${before}` : undefined))
    .orderBy(desc(schema.comments.id))
    .limit(21);
  return ok({ comments: rows.slice(0, 20), hasOlder: rows.length > 20 });
});

async function setFollow(ctx: ApiCtx, on: boolean) {
  const me = requireUser(ctx);
  const target = await targetOf(ctx);
  if (!target || target.id === me.userId) return fail("invalid");
  if (on) {
    const res = await db
      .insert(schema.follows)
      .values({ followerId: me.userId, followeeId: target.id })
      .onConflictDoNothing()
      .returning();
    if (res.length > 0) {
      await notify(target.id, "follow", me.userId, me.userId);
    }
  } else {
    await db
      .delete(schema.follows)
      .where(and(eq(schema.follows.followerId, me.userId), eq(schema.follows.followeeId, target.id)));
  }
  return ok({});
}
register("profile.follow", (ctx) => setFollow(ctx, true));
register("profile.subscribe", (ctx) => setFollow(ctx, true));
register("profile.unfollow", (ctx) => setFollow(ctx, false));
register("profile.unsubscribe", (ctx) => setFollow(ctx, false));

async function setBlock(ctx: ApiCtx, on: boolean) {
  const me = requireUser(ctx);
  const target = await targetOf(ctx);
  if (!target || target.id === me.userId) return fail("invalid");
  if (on) {
    await db.insert(schema.blocks).values({ userId: me.userId, blockedUserId: target.id }).onConflictDoNothing();
  } else {
    await db
      .delete(schema.blocks)
      .where(and(eq(schema.blocks.userId, me.userId), eq(schema.blocks.blockedUserId, target.id)));
  }
  return ok({});
}
register("profile.block", (ctx) => setBlock(ctx, true));
register("profile.unblock", (ctx) => setBlock(ctx, false));

async function setTagBlock(ctx: ApiCtx, on: boolean) {
  const me = requireUser(ctx);
  const name = (ctx.form.tag ?? "").trim().toLowerCase();
  if (!name) return fail("invalid");
  const tag =
    (await db.select().from(schema.tags).where(eq(schema.tags.tag, name)).limit(1))[0] ??
    (on ? (await db.insert(schema.tags).values({ tag: name }).returning())[0] : null);
  if (!tag) return ok({});
  if (on) await db.insert(schema.blockedTags).values({ userId: me.userId, tagId: tag.id }).onConflictDoNothing();
  else
    await db
      .delete(schema.blockedTags)
      .where(and(eq(schema.blockedTags.userId, me.userId), eq(schema.blockedTags.tagId, tag.id)));
  return ok({});
}
register("profile.blockTag", (ctx) => setTagBlock(ctx, true));
register("profile.unblockTag", (ctx) => setTagBlock(ctx, false));

register("user.blocklist", async (ctx) => {
  if (!ctx.user) return fail("not logged in");
  const rows = await db
    .select({ name: schema.users.name, mark: schema.users.mark })
    .from(schema.blocks)
    .innerJoin(schema.users, eq(schema.users.id, schema.blocks.blockedUserId))
    .where(eq(schema.blocks.userId, ctx.user.userId));
  return ok({ blocked: rows });
});

register("user.blockedTags", async (ctx) => {
  if (!ctx.user) return fail("not logged in");
  const rows = await db
    .select({ tag: schema.tags.tag })
    .from(schema.blockedTags)
    .innerJoin(schema.tags, eq(schema.tags.id, schema.blockedTags.tagId))
    .where(eq(schema.blockedTags.userId, ctx.user.userId));
  return ok({ tags: rows.map((r) => r.tag) });
});

register("user.followlist", async (ctx) => {
  if (!ctx.user) return fail("not logged in");
  const rows = await db
    .select({ name: schema.users.name, mark: schema.users.mark })
    .from(schema.follows)
    .innerJoin(schema.users, eq(schema.users.id, schema.follows.followeeId))
    .where(eq(schema.follows.followerId, ctx.user.userId));
  return ok({ list: rows });
});

register("user.collectionfollowlist", async (ctx) => {
  if (!ctx.user) return fail("not logged in");
  const cols = await db
    .select({ c: schema.collections, owner: schema.users.name })
    .from(schema.subscriptions)
    .innerJoin(schema.collections, eq(schema.collections.id, schema.subscriptions.collectionId))
    .innerJoin(schema.users, eq(schema.users.id, schema.collections.userId))
    .where(eq(schema.subscriptions.userId, ctx.user.userId));
  const viewer = ctx.user;
  const readable = cols.filter((r) => r.c.isPublic || r.c.userId === viewer.userId);
  const collections = await Promise.all(
    readable.map(async (r) => ({ ...(await toApiCollection(r.c, viewer)), owner: { name: r.owner } })),
  );
  return ok({ collections });
});
