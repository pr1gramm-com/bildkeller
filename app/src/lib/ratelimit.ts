import { and, eq, gt, lt, sql } from "drizzle-orm";
import { rm } from "node:fs/promises";
import path from "node:path";
import { db, schema } from "@bildkeller/db";
import { configInt } from "./config";

const STALE_AFTER = 3600; // staged uploads not posted within an hour are discarded

/** Remaining upload slots: posted items plus staged-but-unposted uploads inside the window. */
export async function uploadQuota(userId: number): Promise<number> {
  const limit = await configInt("upload.ratelimit.count");
  const hours = await configInt("upload.ratelimit.hours");
  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  const [items] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.items)
    .where(and(eq(schema.items.userId, userId), gt(schema.items.created, since)));
  const [staged] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.uploads)
    .where(and(eq(schema.uploads.userId, userId), gt(schema.uploads.created, since)));
  return Math.max(0, limit - Number(items.c) - Number(staged.c));
}

/** Drops stale staging rows and their files (unless an item already uses the file). */
export async function purgeStaleUploads(): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - STALE_AFTER;
  const stale = await db.delete(schema.uploads).where(lt(schema.uploads.created, cutoff)).returning();
  const root = path.resolve(process.env.MEDIA_DIR ?? "./data/media");
  for (const u of stale) {
    const used = await db.select({ id: schema.items.id }).from(schema.items).where(eq(schema.items.dhash, u.dhash)).limit(1);
    if (used.length === 0) await Promise.all([u.image, u.thumb].map((f) => rm(path.join(root, f), { force: true })));
  }
}
