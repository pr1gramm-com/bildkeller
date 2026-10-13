import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { effectiveFlags } from "./flags";
import type { SessionUser } from "./types";

export const MAX_COMMENT = 10_000;
export const MAX_TAG = 64;
export const MAX_REASON = 100;
export const MAX_MESSAGE = 2000;

/** SQL predicate: item is not deleted and the viewer's flags allow its rating. */
export const itemVisible = (user: SessionUser | null) =>
  and(eq(schema.items.deleted, false), sql`(${schema.items.flags} & ${effectiveFlags(user, 31)}) != 0`);

export async function visibleItem(user: SessionUser | null, itemId: number): Promise<boolean> {
  if (itemId <= 0) return false;
  const rows = await db
    .select({ id: schema.items.id })
    .from(schema.items)
    .where(and(eq(schema.items.id, itemId), itemVisible(user)))
    .limit(1);
  return rows.length > 0;
}

/** A comment the viewer may see: not deleted, on a visible item. */
export async function visibleComment(user: SessionUser | null, commentId: number) {
  if (commentId <= 0) return null;
  const rows = await db
    .select({ id: schema.comments.id, itemId: schema.comments.itemId, userId: schema.comments.userId })
    .from(schema.comments)
    .innerJoin(schema.items, eq(schema.items.id, schema.comments.itemId))
    .where(and(eq(schema.comments.id, commentId), eq(schema.comments.deleted, false), itemVisible(user)))
    .limit(1);
  return rows[0] ?? null;
}
