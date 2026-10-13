import { eq, sql } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";

/** Benis = 2 × net votes on own items + net votes on own comments (own definition, see docs). */
export async function benis(userId: number): Promise<number> {
  const items = await db
    .select({ s: sql<number>`coalesce(sum(${schema.items.up} - ${schema.items.down}), 0)::int` })
    .from(schema.items)
    .where(eq(schema.items.userId, userId));
  const comments = await db
    .select({ s: sql<number>`coalesce(sum(${schema.comments.up} - ${schema.comments.down}), 0)::int` })
    .from(schema.comments)
    .where(eq(schema.comments.userId, userId));
  return 2 * Number(items[0].s) + Number(comments[0].s);
}
