import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { db, schema } from "@bildkeller/db";
import { eq } from "drizzle-orm";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createSession } from "@/lib/auth";
import { createItem, createTestUser, cookieFor } from "./helpers";

let collection = 0, token = "", stranger = "";
let first = 0, second = 0, third = 0;
beforeAll(async () => {
  const user = await createTestUser("collection-feed-owner");
  token = await createSession(user.id);
  stranger = await createSession((await createTestUser("collection-feed-stranger")).id);
  first = (await createItem(user.id)).id;
  second = (await createItem(user.id)).id;
  third = (await createItem(user.id)).id;
  const [row] = await db.insert(schema.collections).values({ userId: user.id, name: "Feed", isPublic: false, created: 1 }).returning();
  collection = row.id;
  await db.insert(schema.collectionItems).values([
    { collectionId: collection, itemId: second, added: 1 },
    { collectionId: collection, itemId: third, added: 2 },
    { collectionId: collection, itemId: first, added: 3 },
  ]);
});
async function get(query: string, session = token) {
  return (await handle(new NextRequest(`http://localhost/api/items/get?collection=${collection}&${query}`, { headers: session ? cookieFor(session) : {} }), ["items", "get"])).json();
}
describe("collection item feeds", () => {
  it("restricts private collections to their owner", async () => {
    expect((await get("", "")).error).toBe("not found");
    expect((await get("", stranger)).error).toBe("not found");
  });
  it("paginates by addition order and resumes deep links including the selected item", async () => {
    const page = await get("limit=1");
    expect(page.items.map((i: { id: number }) => i.id)).toEqual([first]);
    expect(page.atEnd).toBe(false);
    expect((await get(`older=${first}`)).items.map((i: { id: number }) => i.id)).toEqual([third, second]);
    expect((await get(`id=${third}`)).items.map((i: { id: number }) => i.id)).toEqual([third, second]);
    expect((await get("older=999999999")).items).toEqual([]);
  });
  it("allows guest access when public while retaining content visibility", async () => {
    await db.update(schema.collections).set({ isPublic: true }).where(eq(schema.collections.id, collection));
    await db.update(schema.items).set({ flags: 2 }).where(eq(schema.items.id, third));
    expect((await get("", "")).items.map((i: { id: number }) => i.id)).toEqual([first, second]);
  });
});
