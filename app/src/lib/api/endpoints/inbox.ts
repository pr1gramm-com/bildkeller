import { ApiError } from "@/lib/api/envelope";
import { and, asc, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { fail, ok } from "@/lib/api/envelope";
import { register } from "@/lib/api/router";
import { assertNonce } from "@/lib/auth";
import { userByName } from "@/lib/collections";
import { limit } from "@/lib/limiter";
import { MAX_MESSAGE } from "@/lib/visibility";
import type { ApiCtx } from "@/lib/types";

const now = () => Math.floor(Date.now() / 1000);

function me(ctx: ApiCtx, write = false) {
  if (!ctx.user) throw new ApiError("not logged in");
  if (write) assertNonce(ctx, ctx.user);
  return ctx.user;
}

register("inbox.conversations", async (ctx) => {
  const user = me(ctx);
  const uid = user.userId;
  // One row per counterpart: newest message id and unread count, computed in SQL (no row cap to evict others).
  const grouped = await db.execute<{ peer: number; last_id: number; unread: number }>(sql`
    select peer, max(id)::int as last_id, sum(case when to_id = ${uid} and not read then 1 else 0 end)::int as unread
    from (
      select id, to_id, read, case when from_id = ${uid} then to_id else from_id end as peer
      from messages where from_id = ${uid} or to_id = ${uid}
    ) m
    group by peer order by last_id desc limit 200`);
  const rows = grouped.rows;
  if (rows.length === 0) return ok({ atEnd: true, conversations: [] });

  const lastIds = rows.map((r) => r.last_id);
  const peers = rows.map((r) => r.peer);
  const [lasts, users, blockedRows] = await Promise.all([
    db.select().from(schema.messages).where(inArray(schema.messages.id, lastIds)),
    db.select().from(schema.users).where(inArray(schema.users.id, peers)),
    db.select().from(schema.blocks).where(eq(schema.blocks.userId, uid)),
  ]);
  const lastById = new Map(lasts.map((m) => [m.id, m]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const blocked = new Set(blockedRows.map((b) => b.blockedUserId));

  return ok({
    atEnd: true,
    conversations: rows.flatMap((r) => {
      const u = userById.get(r.peer);
      const last = lastById.get(r.last_id);
      if (!u || !last) return [];
      return [{
        mark: u.mark,
        name: u.name,
        lastMessage: last.created,
        unreadCount: r.unread,
        blocked: blocked.has(u.id) ? 1 : 0,
        canReceiveMessages: 1,
        archived: 0,
        favorited: 0,
        lastMessagePreview: last.content.slice(0, 80),
        lastMessageFromMe: last.fromId === uid ? 1 : 0,
        avatar: null,
      }];
    }),
  });
});

register("inbox.messages", async (ctx) => {
  const user = me(ctx);
  const peer = await userByName(ctx.query.get("with") ?? "");
  if (!peer) return fail("not found");
  const pair = or(
    and(eq(schema.messages.fromId, user.userId), eq(schema.messages.toId, peer.id)),
    and(eq(schema.messages.fromId, peer.id), eq(schema.messages.toId, user.userId)),
  );
  const rows = await db.select().from(schema.messages).where(pair).orderBy(asc(schema.messages.id));
  await db
    .update(schema.messages)
    .set({ read: true })
    .where(and(eq(schema.messages.fromId, peer.id), eq(schema.messages.toId, user.userId)));
  return ok({
    atEnd: true,
    with: { name: peer.name, mark: peer.mark, canReceiveMessages: true },
    messages: rows.map((m) => ({
      id: m.id,
      created: m.created,
      sent: m.fromId === user.userId ? 1 : 0,
      message: m.content,
    })),
  });
});

register("inbox.post", async (ctx) => {
  const user = me(ctx, true);
  limit(`dm:${user.userId}`, 20, 60);
  const to = await userByName(ctx.form.to ?? "");
  const content = (ctx.form.comment ?? "").trim();
  if (!to || !content || content.length > MAX_MESSAGE || to.id === user.userId) return fail("invalid");
  const blockedByRecipient = await db
    .select()
    .from(schema.blocks)
    .where(and(eq(schema.blocks.userId, to.id), eq(schema.blocks.blockedUserId, user.userId)))
    .limit(1);
  if (blockedByRecipient.length > 0) return fail("blocked");
  await db.insert(schema.messages).values({ fromId: user.userId, toId: to.id, content, created: now() });
  return ok({});
});

// Notification views (comments / mentions / follows / all / system). Reading marks them as read.
const KINDS: Record<string, string[]> = {
  all: ["comment", "mention", "follow", "system"],
  comments: ["comment", "mention"],
  mentions: ["mention"],
  follows: ["follow"],
  notifications: ["system"],
};
for (const [kind, types] of Object.entries(KINDS)) {
  register(`inbox.${kind}`, async (ctx) => {
    const user = me(ctx);
    const notes = await db
      .select()
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, user.userId), inArray(schema.notifications.type, types)))
      .orderBy(desc(schema.notifications.id))
      .limit(50);

    const messages = await Promise.all(
      notes.map(async (n) => {
        if (n.type === "follow") {
          const f = (await db.select().from(schema.users).where(eq(schema.users.id, n.refId)).limit(1))[0];
          return { id: n.id, type: n.type, created: n.created, name: f?.name ?? "", read: n.read };
        }
        if (n.type === "system") {
          return { id: n.id, type: n.type, created: n.created, content: String((n as { content?: string }).content ?? ""), read: n.read };
        }
        const c = (
          await db
            .select({ content: schema.comments.content, itemId: schema.comments.itemId, name: schema.users.name, thumb: schema.items.thumb })
            .from(schema.comments)
            .innerJoin(schema.users, eq(schema.users.id, schema.comments.userId))
            .innerJoin(schema.items, eq(schema.items.id, schema.comments.itemId))
            .where(eq(schema.comments.id, n.refId))
            .limit(1)
        )[0];
        return { id: n.id, type: n.type, created: n.created, read: n.read, commentId: n.refId, ...c };
      }),
    );
    await db
      .update(schema.notifications)
      .set({ read: true })
      .where(and(eq(schema.notifications.userId, user.userId), inArray(schema.notifications.type, types)));
    return ok({ atEnd: true, messages });
  });
}

register("inbox.digests", async (ctx) => {
  const user = me(ctx);
  const since = Math.floor(Date.now() / 1000) - 86400;
  const rows = await db
    .select({
      id: schema.items.id,
      thumb: schema.items.thumb,
      user: schema.users.name,
      up: schema.items.up,
      down: schema.items.down,
      created: schema.items.created,
    })
    .from(schema.items)
    .innerJoin(schema.users, eq(schema.users.id, schema.items.userId))
    .where(and(eq(schema.items.deleted, false), eq(schema.items.junk, false), gte(schema.items.created, since)))
    .orderBy(desc(sql`${schema.items.up} - ${schema.items.down}`))
    .limit(10);
  return ok({ digests: rows.map((r) => ({ ...r, score: r.up - r.down })) });
});

/** "Stelz-Abos": recent comments written by the users this account follows. */
register("inbox.stalk", async (ctx) => {
  const user = me(ctx);
  const followed = await db
    .select({ id: schema.users.id })
    .from(schema.follows)
    .innerJoin(schema.users, eq(schema.users.id, schema.follows.followeeId))
    .where(eq(schema.follows.followerId, user.userId));
  if (followed.length === 0) return ok({ messages: [] });
  const rows = await db
    .select({
      id: schema.comments.id,
      content: schema.comments.content,
      created: schema.comments.created,
      itemId: schema.comments.itemId,
      name: schema.users.name,
      thumb: schema.items.thumb,
    })
    .from(schema.comments)
    .innerJoin(schema.users, eq(schema.users.id, schema.comments.userId))
    .innerJoin(schema.items, eq(schema.items.id, schema.comments.itemId))
    .where(
      and(
        inArray(schema.comments.userId, followed.map((f) => f.id)),
        eq(schema.comments.deleted, false),
        eq(schema.items.deleted, false),
      ),
    )
    .orderBy(desc(schema.comments.id))
    .limit(50);
  return ok({ messages: rows });
});
