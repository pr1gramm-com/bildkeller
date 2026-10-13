import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { handle, register } from "@/lib/api/router";
import { ok } from "@/lib/api/envelope";
import "@/lib/api/register-all";
import { createItem, createTestUser } from "./helpers";

const HAR_ITEM_KEYS = [
  "id", "promoted", "userId", "up", "down", "created", "image", "thumb", "fullsize",
  "preview", "width", "height", "originalWidth", "originalHeight", "audio", "source",
  "flags", "user", "mark", "repost", "variants",
].sort();

type ReqInit = { method?: string; body?: BodyInit; headers?: Record<string, string> };
function req(path: string, init?: ReqInit) {
  return new NextRequest(`http://localhost:3000${path}`, init);
}
async function json(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

let verifiedToken = "";
let blockedToken = "";
let otherUserId = 0;

beforeAll(async () => {
  register("test.silent", async () => ok({}));

  const owner = await createTestUser("feedowner", { verified: true });
  const verified = await createTestUser("feedverified", { verified: true });
  const blocked = await createTestUser("feedblocked", { verified: true });
  const blocker = await createTestUser("feedblocker", { verified: true });
  otherUserId = blocked.id;

  // verifizierter User blockt "blocked"
  const { db, schema } = await import("@bildkeller/db");
  await db.insert(schema.blocks).values({ userId: blocker.id, blockedUserId: blocked.id });

  const { createSession } = await import("@/lib/auth");
  verifiedToken = await createSession(verified.id);
  blockedToken = await createSession(blocker.id);

  const now = Math.floor(Date.now() / 1000);
  // Feed-Bestand: 5 SFW (3 promoted), 2 NSFW, 1 NSFP, 1 junk, 1 deleted, 2 vom blockierten User
  for (let i = 0; i < 5; i++) {
    await createItem(owner.id, { created: now - i, promoted: i < 3 ? now - i : 0 });
  }
  await createItem(owner.id, { flags: 2, created: now });
  await createItem(owner.id, { flags: 8, created: now });
  await createItem(owner.id, { junk: true, created: now });
  await createItem(owner.id, { deleted: true, created: now });
  await createItem(blocked.id, { created: now });
  await createItem(blocked.id, { created: now });
});

describe("items.get", () => {
  it("guest sees only SFW, no junk, no deleted", async () => {
    const body = await json(await handle(req("/api/items/get?flags=31&promoted=0"), ["items", "get"]));
    const items = body.items as Array<Record<string, unknown>>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => (i.flags as number) & 1)).toBe(true);
    expect(Object.keys(items[0]).sort()).toEqual(HAR_ITEM_KEYS);
    expect(body.atStart).toBe(true);
    expect(typeof body.atEnd).toBe("boolean");
  });

  it("verified user with flags=31 sees nsfw and nsfp", async () => {
    const body = await json(
      await handle(req("/api/items/get?flags=31&promoted=0", { headers: { cookie: `me=${Buffer.from(JSON.stringify({ id: verifiedToken })).toString("base64url")}` } }), ["items", "get"]),
    );
    const items = body.items as Array<Record<string, unknown>>;
    expect(items.some((i) => i.flags === 2)).toBe(true);
    expect(items.some((i) => i.flags === 8)).toBe(true);
  });

  it("promoted=1 returns only promoted items, sorted by promoted desc", async () => {
    const body = await json(await handle(req("/api/items/get?flags=1&promoted=1"), ["items", "get"]));
    const items = body.items as Array<Record<string, unknown>>;
    expect(items.length).toBe(3);
    const promoted = items.map((i) => i.promoted as number);
    expect([...promoted].sort((a, b) => b - a)).toEqual(promoted);
  });

  it("older=<id> paginates downward", async () => {
    const first = await json(await handle(req("/api/items/get?flags=1&promoted=0"), ["items", "get"]));
    const items = first.items as Array<{ id: number }>;
    const cursor = items[2].id;
    const second = await json(
      await handle(req(`/api/items/get?flags=1&promoted=0&older=${cursor}`), ["items", "get"]),
    );
    const rest = second.items as Array<{ id: number }>;
    expect(rest.every((i) => i.id < cursor)).toBe(true);
    expect(second.atStart).toBe(false);
  });

  it("show_junk=1 includes junk items", async () => {
    const withJunk = await json(await handle(req("/api/items/get?flags=1&promoted=0&show_junk=1"), ["items", "get"]));
    const withoutJunk = await json(await handle(req("/api/items/get?flags=1&promoted=0"), ["items", "get"]));
    expect((withJunk.items as unknown[]).length).toBeGreaterThan((withoutJunk.items as unknown[]).length);
  });

  it("filters blocked users for the requesting session", async () => {
    const body = await json(
      await handle(req("/api/items/get?flags=31&promoted=0", { headers: { cookie: `me=${Buffer.from(JSON.stringify({ id: blockedToken })).toString("base64url")}` } }), ["items", "get"]),
    );
    const items = body.items as Array<{ userId: number }>;
    expect(items.every((i) => i.userId !== otherUserId)).toBe(true);
  });
});
