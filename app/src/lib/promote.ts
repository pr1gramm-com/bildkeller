import { eq } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { configInt } from "./config";

/** Promote an item once its net score reaches the configured threshold (spec D13). */
export async function maybePromote(itemId: number): Promise<void> {
  const threshold = await configInt("promotion.threshold");
  const rows = await db.select().from(schema.items).where(eq(schema.items.id, itemId)).limit(1);
  const item = rows[0];
  if (!item || item.promoted > 0) return;
  if (item.up - item.down >= threshold) {
    await db
      .update(schema.items)
      .set({ promoted: Math.floor(Date.now() / 1000) })
      .where(eq(schema.items.id, itemId));
  }
}
