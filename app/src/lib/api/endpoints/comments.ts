import { ApiError } from "@/lib/api/envelope";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { fail, ok } from "@/lib/api/envelope";
import { register } from "@/lib/api/router";
import { assertNonce } from "@/lib/auth";
import { wilson } from "@/lib/wilson";
import { int } from "@/lib/params";
import { limit } from "@/lib/limiter";
import { MAX_COMMENT, visibleComment, visibleItem } from "@/lib/visibility";
import { notify } from "@/lib/notifications";
import type { ApiCtx, SessionUser } from "@/lib/types";

const now = () => Math.floor(Date.now() / 1000);

function requireUser(ctx: ApiCtx): SessionUser {
  if (!ctx.user) throw new ApiError("not logged in");
  assertNonce(ctx, ctx.user);
  return ctx.user;
}

register("comments.post", async (ctx) => {
  const user = requireUser(ctx);
  limit(`comment:${user.userId}`, 30, 60);
  const content = (ctx.form.content ?? "").trim();
  const itemId = int(ctx.form.itemId, 0);
  if (ctx.form.parent !== undefined && !/^\d+$/.test(ctx.form.parent)) return fail("invalid");
  const parentId = int(ctx.form.parent, 0);
  if (!content || content.length > MAX_COMMENT) return fail("invalid");
  if (!(await visibleItem(user, itemId))) return fail("not found");
  if (parentId > 0) {
    const parent = await visibleComment(user, parentId);
    if (!parent || parent.itemId !== itemId) return fail("invalid");
  }

  const [c] = await db
    .insert(schema.comments)
    .values({ itemId, parentId, userId: user.userId, content, created: now() })
    .returning();

  const notified = new Set<number>();
  if (parentId > 0) {
    const parent = (await db.select().from(schema.comments).where(eq(schema.comments.id, parentId)).limit(1))[0];
    if (parent) {
      await notify(parent.userId, "comment", c.id, user.userId);
      notified.add(parent.userId);
    }
  }
  // The owner of the post is notified about every new comment on it.
  const owner = (await db.select({ userId: schema.items.userId }).from(schema.items).where(eq(schema.items.id, itemId)).limit(1))[0];
  if (owner && !notified.has(owner.userId)) {
    await notify(owner.userId, "comment", c.id, user.userId);
    notified.add(owner.userId);
  }
  for (const name of new Set([...content.matchAll(/@([\w-]{2,32})/g)].map((m) => m[1].toLowerCase()))) {
    const target = (
      await db.select().from(schema.users).where(sql`lower(${schema.users.name}) = ${name}`).limit(1)
    )[0];
    if (target && !notified.has(target.id)) await notify(target.id, "mention", c.id, user.userId);
  }

  return ok({
    commentId: c.id,
    comments: [
      {
        id: c.id,
        parent: c.parentId,
        content: c.content,
        created: c.created,
        editedAt: c.editedAt,
        editCount: c.editCount,
        up: 0,
        down: 0,
        confidence: wilson(0, 0),
        name: user.name,
        mark: user.mark,
        blocked: false,
      },
    ],
  });
});

register("comments.edit", async (ctx) => {
  const user = requireUser(ctx);
  const id = int(ctx.form.id, 0);
  const content = (ctx.form.content ?? "").trim();
  if (!content || content.length > MAX_COMMENT) return fail("invalid");
  const visible = await visibleComment(user, id);
  if (!visible) return fail("not found");
  const c = (await db.select().from(schema.comments).where(eq(schema.comments.id, id)).limit(1))[0];
  if (!c) return fail("not found");
  if (c.userId !== user.userId) return fail("forbidden");
  await db.insert(schema.commentEdits).values({ commentId: id, content: c.content, edited: now() });
  await db
    .update(schema.comments)
    .set({ content, editedAt: now(), editCount: c.editCount + 1 })
    .where(eq(schema.comments.id, id));
  return ok({});
});

register("comments.getEditHistory", async (ctx) => {
  const id = int(ctx.query.get("id"), 0);
  if (!(await visibleComment(ctx.user, id))) return fail("not found");
  const history = await db
    .select({ content: schema.commentEdits.content, edited: schema.commentEdits.edited })
    .from(schema.commentEdits)
    .where(eq(schema.commentEdits.commentId, id))
    .orderBy(desc(schema.commentEdits.id));
  return ok({ history });
});

register("comments.fav", async (ctx) => {
  const user = requireUser(ctx);
  if (!(await visibleComment(user, int(ctx.form.id, 0)))) return fail("not found");
  await db
    .insert(schema.commentFavorites)
    .values({ userId: user.userId, commentId: int(ctx.form.id, 0) })
    .onConflictDoNothing();
  return ok({});
});

register("comments.unfav", async (ctx) => {
  const user = requireUser(ctx);
  await db
    .delete(schema.commentFavorites)
    .where(
      and(
        eq(schema.commentFavorites.userId, user.userId),
        eq(schema.commentFavorites.commentId, int(ctx.form.id, 0)),
      ),
    );
  return ok({});
});
