import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { addTag } from "@/lib/tags";
import { createItem, createTestUser } from "./helpers";

let owner = "", original = 0, oc = 0, excluded = 0;
beforeAll(async () => {
  const user = await createTestUser("grouped-feed-owner"); owner = user.name;
  for (const tags of [["nsfw", "original content"], ["nsfw", "oc"], ["nsfw", "oc", "spam"], ["oc"]]) {
    const item = await createItem(user.id);
    if (!original) original = item.id; else if (!oc) oc = item.id; else if (!excluded) excluded = item.id;
    for (const tag of tags) await addTag(item.id, user.id, tag);
  }
});
async function get(tags: string, extra: Record<string, string> = {}) {
  const query = new URLSearchParams({ tags, user: owner, ...extra });
  return (await handle(new NextRequest(`http://localhost/api/items/get?${query}`), ["items", "get"])).json();
}
describe("grouped and random feed queries", () => {
  it("evaluates AND, nested OR and negated groups in SQL", async () => {
    const page = await get("! nsfw ('original content' | oc) -(spam | repost)");
    expect(page.items.map((i: { id: number }) => i.id)).toEqual([oc, original]);
    expect((await get("! (nsfw | oc")).error).toBe("invalid query");
  });
  it("keeps a seeded random order stable through pagination and deep links", async () => {
    const query = "!-(x:random | x:1792521169)";
    const all = (await get(query)).items.map((i: { id: number }) => i.id);
    expect(all).toHaveLength(4);
    const first = await get(query, { limit: "2" });
    const rest = await get(query, { older: String(first.items[1].id) });
    expect([...first.items, ...rest.items].map((i: { id: number }) => i.id)).toEqual(all);
    expect((await get(query, { id: String(all[1]) })).items.map((i: { id: number }) => i.id)).toEqual(all.slice(1));
    expect((await get(query)).items.map((i: { id: number }) => i.id)).toEqual(all);
  });
});
