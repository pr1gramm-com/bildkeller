import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db, schema } from "@bildkeller/db";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createItem, createTestUser, cookieFor, NOW } from "./helpers";
import { createSession } from "@/lib/auth";

type ReqInit = { method?: string; body?: BodyInit; headers?: Record<string, string> };
function req(path: string, init?: ReqInit) {
  return new NextRequest(`http://localhost:3000${path}`, init);
}
async function json(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

let modToken = "";
let userToken = "";
let itemId = 0;

function post(path: string, form: Record<string, string>, token: string) {
  return handle(
    req(path, {
      method: "POST",
      body: new URLSearchParams({ ...form, _nonce: token.slice(0, 16) }),
      headers: { "content-type": "application/x-www-form-urlencoded", ...cookieFor(token) },
    }),
    path.replace("/api/", "").split("/"),
  );
}

beforeAll(async () => {
  const mod = await createTestUser("tagmod", { verified: true, mod: true });
  const user = await createTestUser("taguser", { verified: true });
  modToken = await createSession(mod.id);
  userToken = await createSession(user.id);

  const owner = await createTestUser("tagowner", { verified: true });
  const withVideo = await createItem(owner.id, { image: "2026/01/01/vid.webm", audio: true, created: NOW() });
  itemId = withVideo.id;
  await post("/api/tags/add", { itemId: String(itemId), tags: "katzen" }, userToken);

  const img = await createItem(owner.id, { created: NOW() });
  await post("/api/tags/add", { itemId: String(img.id), tags: "hunde" }, userToken);
  void eq; void and;
});

describe("tags.add / tags.vote", () => {
  it("adds tags to an item (comma separated, normalized)", async () => {
    await post("/api/tags/add", { itemId: String(itemId), tags: "Süß, Niedlich" }, userToken);
    const body = await json(await handle(req(`/api/items/info?itemId=${itemId}`), ["items", "info"]));
    const tags = body.tags as Array<{ tag: string }>;
    expect(tags.map((t) => t.tag).sort()).toEqual(["katzen", "niedlich", "süß"]);
  });

  it("voting a tag updates confidence", async () => {
    await post("/api/tags/vote", { itemId: String(itemId), tag: "katzen", up: "1" }, userToken);
    const body = await json(await handle(req(`/api/items/info?itemId=${itemId}`), ["items", "info"]));
    const katzen = (body.tags as Array<{ tag: string; confidence: number }>).find((t) => t.tag === "katzen");
    expect(katzen?.confidence).toBeGreaterThan(0);
  });

  it("mod can delete a tag", async () => {
    await post("/api/tags/delete", { itemId: String(itemId), tag: "niedlich" }, modToken);
    const body = await json(await handle(req(`/api/items/info?itemId=${itemId}`), ["items", "info"]));
    const tags = (body.tags as Array<{ tag: string }>).map((t) => t.tag);
    expect(tags).not.toContain("niedlich");
  });
});

describe("tags.top", () => {
  it("lists top tags with counts", async () => {
    const body = await json(await handle(req("/api/tags/top"), ["tags", "top"]));
    const tags = body.tags as string[];
    expect(tags.length).toBeGreaterThan(0);
    expect(typeof tags[0]).toBe("string");
    expect(Array.isArray(body.trending)).toBe(true);
    expect(Array.isArray(body.blacklist)).toBe(true);
  });
});

describe("feed query language", () => {
  it("include matches AND-wise", async () => {
    const body = await json(await handle(req("/api/items/get?flags=31&promoted=0&tags=katzen"), ["items", "get"]));
    const items = body.items as Array<{ id: number }>;
    expect(items.some((i) => i.id === itemId)).toBe(true);
  });

  it("exclude removes items", async () => {
    const body = await json(
      await handle(req("/api/items/get?flags=31&promoted=0&tags=" + encodeURIComponent("! katzen -hunde")), ["items", "get"]),
    );
    const items = body.items as Array<{ id: number }>;
    expect(items.some((i) => i.id === itemId)).toBe(true);
    const body2 = await json(
      await handle(req("/api/items/get?flags=31&promoted=0&tags=" + encodeURIComponent("! katzen -katzen")), ["items", "get"]),
    );
    expect((body2.items as unknown[]).length).toBe(0);
  });

  it("media exclusion filters videos", async () => {
    const body = await json(
      await handle(req("/api/items/get?flags=31&promoted=0&tags=" + encodeURIComponent("! katzen -\"video\"")), ["items", "get"]),
    );
    const items = body.items as Array<{ id: number }>;
    expect(items.some((i) => i.id === itemId)).toBe(false);
  });

  it("score filter applies net-votes threshold", async () => {
    const body = await json(
      await handle(req("/api/items/get?flags=31&promoted=0&tags=" + encodeURIComponent("! katzen s:5")), ["items", "get"]),
    );
    expect((body.items as unknown[]).length).toBe(0);
  });
});
