import { and, gt, eq, sql } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { configInt } from "./config";

/** Remaining upload slots for a user inside the configured window. */
export async function uploadQuota(userId: number): Promise<number> {
  const limit = await configInt("upload.ratelimit.count");
  const hours = await configInt("upload.ratelimit.hours");
  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.items)
    .where(and(eq(schema.items.userId, userId), gt(schema.items.created, since)));
  return Math.max(0, limit - Number(rows[0]?.c ?? 0));
}
