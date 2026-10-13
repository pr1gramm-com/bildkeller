import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";

export async function logEvent(userId: number, type: string, payload: Record<string, unknown>): Promise<void> {
  await db.insert(schema.syncLog).values({ userId, type, payload, created: Math.floor(Date.now() / 1000) });
}

const MAX_CHUNK = 1000;

/** Events after `offset` plus the current log end (an offset beyond the end yields no events and the real end). */
export async function readLog(userId: number, offset: number, limit: number) {
  const take = Math.min(Math.max(limit, 1), MAX_CHUNK);
  const rows = await db
    .select()
    .from(schema.syncLog)
    .where(and(eq(schema.syncLog.userId, userId), gt(schema.syncLog.id, offset)))
    .orderBy(asc(schema.syncLog.id))
    .limit(take + 1);
  const end = (
    await db
      .select({ m: sql<number>`coalesce(max(${schema.syncLog.id}), 0)::int` })
      .from(schema.syncLog)
      .where(eq(schema.syncLog.userId, userId))
  )[0].m;
  const page = rows.slice(0, take);
  const hasMore = rows.length > take;
  const nextOffset = page.length > 0 ? page[page.length - 1].id : end;
  const events = page.map((r) => ({ id: r.id, type: r.type, ...(r.payload as object) }));
  return {
    log: Buffer.from(JSON.stringify(events), "utf8").toString("base64"),
    logLength: end,
    hasMore,
    nextOffset: hasMore ? nextOffset : Math.max(nextOffset, end),
  };
}
