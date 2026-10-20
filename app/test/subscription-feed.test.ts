import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@bildkeller/db";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createSession } from "@/lib/auth";
import { createItem, createTestUser, cookieFor } from "./helpers";

let token = "", viewer = 0, followed = 0, collection = 0, privateCollection = 0;
let upload = 0, collected = 0;
beforeAll(async () => {
  viewer = (await createTestUser("subscriber-feed")).id; token = await createSession(viewer);
  followed = (await createTestUser("followed-feed")).id;
  const curator = (await createTestUser("curator-feed")).id;
  const contributor = (await createTestUser("contributor-feed")).id;
  upload = (await createItem(followed, { created: 100 })).id;
  collected = (await createItem(contributor, { created: 50 })).id;
  const secret = (await createItem(contributor, { created: 40 })).id;
  const hidden = (await createItem(contributor, { created: 60, flags: 2 })).id;
  await createItem(contributor, { created: 999 });
  const [pub] = await db.insert(schema.collections).values({ userId: curator, name: "Public feed", isPublic: true, created: 1 }).returning(); collection = pub.id;
  const [priv] = await db.insert(schema.collections).values({ userId: curator, name: "Private feed", isPublic: false, created: 1 }).returning(); privateCollection = priv.id;
  await db.insert(schema.collectionItems).values([{ collectionId: collection, itemId: collected, added: 300 }, { collectionId: collection, itemId: hidden, added: 400 }, { collectionId: privateCollection, itemId: secret, added: 500 }]);
  await db.insert(schema.subscriptions).values([{ userId: viewer, collectionId: collection }, { userId: viewer, collectionId: privateCollection }]);
  await db.insert(schema.follows).values({ followerId: viewer, followeeId: followed });
});
async function get(path: string, session = token) {
  return (await handle(new NextRequest(`http://localhost/api/${path}`, { headers: session ? cookieFor(session) : {} }), path.split("?")[0].split("/"))).json();
}
describe("subscription feed", () => {
  it("requires login and lists only accessible subscribed collections", async () => {
    expect((await get("items/get?subscribed=1", "")).error).toBe("not logged in");
    expect((await get("collections/subscriptions", "")).error).toBe("not logged in");
    expect((await get("collections/subscriptions")).subscriptions.map((c: { id: number }) => c.id)).toEqual([collection]);
    expect((await get(`collections/get?id=${collection}`)).collections[0].subscribed).toBe(true);
  });
  it("combines followed users and collection additions with stable pagination", async () => {
    const first = await get("items/get?subscribed=1&limit=1");
    expect(first.items.map((i: { id: number }) => i.id)).toEqual([collected]);
    expect(first.atEnd).toBe(false);
    expect((await get(`items/get?subscribed=1&older=${collected}`)).items.map((i: { id: number }) => i.id)).toEqual([upload]);
    expect((await get(`items/get?subscribed=1&id=${collected}`)).items.map((i: { id: number }) => i.id)).toEqual([collected, upload]);
  });
  it("immediately excludes collections made private and blocked uploaders", async () => {
    await db.update(schema.collections).set({ isPublic: false }).where(eq(schema.collections.id, collection));
    expect((await get("items/get?subscribed=1")).items.map((i: { id: number }) => i.id)).toEqual([upload]);
    await db.insert(schema.blocks).values({ userId: viewer, blockedUserId: followed });
    expect((await get("items/get?subscribed=1")).items).toEqual([]);
    await db.delete(schema.blocks).where(and(eq(schema.blocks.userId, viewer), eq(schema.blocks.blockedUserId, followed)));
  });
  it("shows no unrelated global uploads after the final subscription is removed", async () => {
    await db.delete(schema.follows).where(eq(schema.follows.followerId, viewer));
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.userId, viewer));
    expect((await get("items/get?subscribed=1")).items).toEqual([]);
    expect((await get("collections/subscriptions")).subscriptions).toEqual([]);
  });
});
