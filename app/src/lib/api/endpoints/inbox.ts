import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { fail, ok } from "@/lib/api/envelope";
import { register } from "@/lib/api/router";
import { assertNonce } from "@/lib/auth";
import { userByName } from "@/lib/collections";
import type { ApiCtx } from "@/lib/types";

const now = () => Math.floor(Date.now() / 1000);

function me(ctx: ApiCtx, write = false) {
  if (!ctx.user) throw new Error("not logged in");
  if (write) assertNonce(ctx, ctx.user);
  return ctx.user;
}

register("inbox.conversations", async (ctx) => {
  const user = me(ctx);
  const rows = await db
    .select()
    .from(schema.messages)
    .where(or(eq(schema.messages.fromId, user.userId), eq(schema.messages.toId, user.userId)))
    .orderBy(desc(schema.messages.id))
    .limit(1000);

  const byPeer = new Map<number, { last: (typeof rows)[number]; unread: number }>();
  for (const m of rows) {
    const peer = m.fromId === user.userId ? m.toId : m.fromId;
    const entry = byPeer.get(peer) ?? { last: m, unread: 0 };
    if (m.toId === user.userId && !m.read) entry.unread += 1;
    byPeer.set(peer, entry);
  }
  const peers = [...byPeer.keys()];
  const users = peers.length
    ? await db.select().from(schema.users).where(inArray(schema.users.id, peers))
    : [];
  const blocked = new Set(
    (await db.select().from(schema.blocks).where(eq(schema.blocks.userId, user.userId))).map((b) => b.blockedUserId),
  );

  return ok({
    atEnd: true,
    conversations: users.map((u) => {
      const e = byPeer.get(u.id)!;
      return {
        mark: u.mark,
        name: u.name,
        lastMessage: e.last.created,
        unreadCount: e.unread,
        blocked: blocked.has(u.id) ? 1 : 0,
        canReceiveMessages: 1,
        archived: 0,
        favorited: 0,
        lastMessagePreview: e.last.content.slice(0, 80),
        lastMessageFromMe: e.last.fromId === user.userId ? 1 : 0,
        avatar: null,
      };
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
  const to = await userByName(ctx.form.to ?? "");
  const content = (ctx.form.comment ?? "").trim();
  if (!to || !content || to.id === user.userId) return fail("invalid");
  const blockedByRecipient = await db
    .select()
    .from(schema.blocks)
    .where(and(eq(schema.blocks.userId, to.id), eq(schema.blocks.blockedUserId, user.userId)))
    .limit(1);
  if (blockedByRecipient.length > 0) return fail("blocked");
  await db.insert(schema.messages).values({ fromId: user.userId, toId: to.id, content, created: now() });
  return ok({});
});

// Notification views (comments / mentions / follows / all). Reading marks them as read.
const KINDS: Record<string, string[]> = {
  comments: ["comment"],
  mentions: ["mention"],
  follows: ["follow"],
  notifications: ["comment", "mention", "follow"],
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
  me(ctx);
  return ok({ digests: [] }); // digests are a pr0mium feature: not implemented
});
