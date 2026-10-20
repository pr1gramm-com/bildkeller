import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createSession } from "@/lib/auth";
import { updateSettings } from "@/lib/settings";
import { createItem, createTestUser, cookieFor } from "./helpers";
import { voteTarget } from "@/lib/api/endpoints/items";

let owner = 0, token = "", other = "";
let first = 0, second = 0, unseen = 0;
beforeAll(async () => {
  owner = (await createTestUser("history-owner")).id;
  token = await createSession(owner);
  other = await createSession((await createTestUser("history-other")).id);
  first = (await createItem(owner)).id;
  second = (await createItem(owner)).id;
  unseen = (await createItem(owner)).id;
});

async function get(path: string, session = token) {
  return (await handle(new NextRequest(`http://localhost/api/${path}`, { headers: session ? cookieFor(session) : {} }), path.split("?")[0].split("/"))).json();
}

describe("account viewing history", () => {
  it("handles an empty history and records nothing while disabled", async () => {
    expect((await get(`items/info?itemId=${first}`)).seen).toBe(false);
    expect((await get("items/get?history=1")).items).toEqual([]);
    expect((await get("items/get?history=1", "")).error).toBe("not logged in");
  });

  it("records unique items in viewing order, marks them, and paginates", async () => {
    await updateSettings(owner, { enableItemHistory: "true", markSeenItems: "true" });
    await get(`items/info?itemId=${second}`);
    expect((await get("items/get?history=1")).items.map((i: { id: number }) => i.id)).toEqual([second]);
    await get(`items/info?itemId=${first}`);
    await get(`items/info?itemId=${first}`);
    const page = await get("items/get?history=1&limit=1");
    expect(page.items.map((i: { id: number }) => i.id)).toEqual([first]);
    expect(page.seen).toEqual([first]);
    expect(page.atEnd).toBe(false);
    expect((await get(`items/get?history=1&older=${first}`)).items.map((i: { id: number }) => i.id)).toEqual([second]);
    expect((await get("items/get?history=1", other)).items).toEqual([]);
  });

  it("stops recording when disabled and clears only the authenticated owner's history", async () => {
    await updateSettings(owner, { enableItemHistory: "false" });
    await get(`items/info?itemId=${unseen}`);
    expect((await get("items/get?history=1")).items.map((i: { id: number }) => i.id)).not.toContain(unseen);
    const request = (nonce: boolean) => handle(new NextRequest("http://localhost/api/user/clearHistory", {
      method: "POST", headers: cookieFor(token), body: new URLSearchParams(nonce ? { _nonce: token.slice(0, 16) } : {}),
    }), ["user", "clearHistory"]);
    expect((await (await request(false)).json()).error).toBeTruthy();
    expect((await (await request(true)).json()).error).toBeNull();
    expect((await get("items/get?history=1")).items).toEqual([]);
  });

  it("makes automatic upvotes idempotent under concurrent requests", async () => {
    const target = (await createItem(owner)).id;
    const changed = await Promise.all(Array.from({ length: 8 }, () => voteTarget("items", target, true, owner, false)));
    expect(changed.filter(Boolean)).toHaveLength(1);
    const body = await get(`items/get?id=${target}`);
    expect(body.items.find((i: { id: number }) => i.id === target).up).toBe(1);
    expect((await get(`items/info?itemId=${target}`)).vote).toBe(true);
  });
});
