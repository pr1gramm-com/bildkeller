import { eq } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";

/** Attaches a tag to an item; the adder's implicit upvote makes new tags visible (wilson(1,0) >= 0.2). */
export async function addTag(itemId: number, userId: number, name: string): Promise<void> {
  const tag =
    (await db.select().from(schema.tags).where(eq(schema.tags.tag, name)).limit(1))[0] ??
    (await db.insert(schema.tags).values({ tag: name }).onConflictDoNothing().returning())[0] ??
    (await db.select().from(schema.tags).where(eq(schema.tags.tag, name)).limit(1))[0];
  const added = await db
    .insert(schema.itemTags)
    .values({ itemId, tagId: tag.id, up: 1 })
    .onConflictDoNothing()
    .returning();
  if (added.length > 0) {
    await db.insert(schema.itemTagVotes).values({ userId, itemId, tagId: tag.id, up: true }).onConflictDoNothing();
  }
}
