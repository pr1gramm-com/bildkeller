import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { itemVisible } from "./visibility";
import type { SessionUser } from "./types";

export type ApiCollection = {
  id: number;
  name: string;
  keyword: string;
  isPublic: number;
  isDefault: number;
  itemCount: number;
  subscribed: boolean;
  items: Array<{ id: number; thumb: string; preview: string | null; flags: number }>;
};

const keyword = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");

export async function ensureDefaultCollection(userId: number): Promise<void> {
  const has = await db
    .select({ id: schema.collections.id })
    .from(schema.collections)
    .where(and(eq(schema.collections.userId, userId), eq(schema.collections.isDefault, true)))
    .limit(1);
  if (has.length === 0) {
    await db.insert(schema.collections).values({
      userId,
      name: "Favoriten",
      isDefault: true,
      isPublic: false,
      created: Math.floor(Date.now() / 1000),
    });
  }
}

export async function toApiCollection(
  c: typeof schema.collections.$inferSelect,
  viewer: SessionUser | null,
): Promise<ApiCollection> {
  const [count] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.collectionItems)
    .innerJoin(schema.items, eq(schema.items.id, schema.collectionItems.itemId))
    .where(and(eq(schema.collectionItems.collectionId, c.id), itemVisible(viewer)));
  const items = await db
    .select({ id: schema.items.id, thumb: schema.items.thumb, preview: schema.items.preview, flags: schema.items.flags })
    .from(schema.collectionItems)
    .innerJoin(schema.items, eq(schema.items.id, schema.collectionItems.itemId))
    .where(and(eq(schema.collectionItems.collectionId, c.id), itemVisible(viewer)))
    .orderBy(desc(schema.collectionItems.added))
    .limit(10);
  const subscribed = viewer ? await db.select({ id: schema.subscriptions.collectionId }).from(schema.subscriptions)
    .where(and(eq(schema.subscriptions.userId, viewer.userId), eq(schema.subscriptions.collectionId, c.id))).limit(1) : [];
  return {
    id: c.id,
    name: c.name,
    keyword: keyword(c.name),
    isPublic: c.isPublic ? 1 : 0,
    isDefault: c.isDefault ? 1 : 0,
    itemCount: Number(count.c),
    subscribed: subscribed.length > 0,
    items,
  };
}

export async function collectionsOf(
  userId: number,
  includePrivate: boolean,
  viewer: SessionUser | null,
): Promise<ApiCollection[]> {
  await ensureDefaultCollection(userId);
  const rows = await db.select().from(schema.collections).where(eq(schema.collections.userId, userId));
  return Promise.all(rows.filter((c) => includePrivate || c.isPublic).map((c) => toApiCollection(c, viewer)));
}

export async function userByName(name: string) {
  const rows = await db
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.name}) = ${name.toLowerCase()}`)
    .limit(1);
  return rows[0] ?? null;
}
