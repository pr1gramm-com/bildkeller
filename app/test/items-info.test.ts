import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db, schema } from "@bildkeller/db";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createItem, createTestUser, cookieFor, NOW } from "./helpers";
import { createSession } from "@/lib/auth";

const HAR_COMMENT_KEYS = [
  "id", "parent", "content", "created", "editedAt", "editCount", "up", "down",
  "confidence", "name", "mark", "blocked", "vote", "avatar",
].sort();

type ReqInit = { method?: string; body?: BodyInit; headers?: Record<string, string> };
function req(path: string, init?: ReqInit) {
  return new NextRequest(`http://localhost:3000${path}`, init);
}
async function json(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

let ownerToken = "";
let voterToken = "";
let itemId = 0;
let nsfwItemId = 0;

beforeAll(async () => {
  const owner = await createTestUser("infoowner", { verified: true });
  const voter = await createTestUser("infovoter", { verified: true });
  ownerToken = await createSession(owner.id);
  voterToken = await createSession(voter.id);

  const item = await createItem(owner.id, { created: NOW() });
  itemId = item.id;
  const nsfw = await createItem(owner.id, { flags: 2, created: NOW() });
  nsfwItemId = nsfw.id;

  await db.insert(schema.comments).values({
    itemId,
    parentId: 0,
    userId: voter.id,
    content: "erster!",
    created: NOW(),
  });
});

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

describe("items.info", () => {
  it("returns tags, comments, views with exact shapes", async () => {
    const body = await json(await handle(req(`/api/items/info?itemId=${itemId}`), ["items", "info"]));
    expect(body.error).toBeNull();
    expect(Object.keys(body).sort()).toEqual(
      ["tags", "comments", "views", "favorites", "collectionIds", "vote", "seen", "ts", "rt", "qc", "cache", "error"].sort(),
    );
    const comments = body.comments as Array<Record<string, unknown>>;
    expect(comments.length).toBe(1);
    expect(Object.keys(comments[0]).sort()).toEqual(HAR_COMMENT_KEYS);
    expect(comments[0].content).toBe("erster!");
    expect(typeof comments[0].confidence).toBe("number");
    expect(typeof body.views).toBe("number");
  });

  it("guest cannot see NSFW item info", async () => {
    const body = await json(await handle(req(`/api/items/info?itemId=${nsfwItemId}`), ["items", "info"]));
    expect(body.error).toBeTruthy();
  });
});

describe("items.vote", () => {
  it("up → counter 1", async () => {
    const body = await json(await post(`/api/items/vote`, { id: String(itemId), up: "1" }, voterToken));
    expect(body.error).toBeNull();
    const rows = await db.select().from(schema.items).where(eq(schema.items.id, itemId));
    expect(rows[0].up).toBe(1);
    expect(rows[0].down).toBe(0);
  });

  it("same vote again toggles off", async () => {
    await post(`/api/items/vote`, { id: String(itemId), up: "1" }, voterToken);
    const rows = await db.select().from(schema.items).where(eq(schema.items.id, itemId));
    expect(rows[0].up).toBe(0);
    const votes = await db.select().from(schema.votes).where(eq(schema.votes.itemId, itemId));
    expect(votes.length).toBe(0);
  });

  it("opposite vote switches direction, keeping one row", async () => {
    await post(`/api/items/vote`, { id: String(itemId), up: "1" }, voterToken);
    await post(`/api/items/vote`, { id: String(itemId), up: "0" }, voterToken);
    const rows = await db.select().from(schema.items).where(eq(schema.items.id, itemId));
    expect(rows[0].up).toBe(0);
    expect(rows[0].down).toBe(1);
    const votes = await db.select().from(schema.votes).where(eq(schema.votes.itemId, itemId));
    expect(votes.length).toBe(1);
    expect(votes[0].up).toBe(false);
  });

  it("promotion triggers at threshold via voting", async () => {
    const fresh = await createItem((await db.select().from(schema.users).where(eq(schema.users.name, "infoowner")).limit(1))[0].id, { created: NOW() });
    const voters = [];
    for (let i = 0; i < 3; i++) {
      const u = await createTestUser(`promoter${Date.now()}-${i}`, { verified: true });
      voters.push(await createSession(u.id));
    }
    for (const t of voters) {
      await post(`/api/items/vote`, { id: String(fresh.id), up: "1" }, t);
    }
    const rows = await db.select().from(schema.items).where(eq(schema.items.id, fresh.id));
    expect(rows[0].promoted).toBeGreaterThan(0);
  });
});

describe("items.ratelimited", () => {
  it("returns quota left", async () => {
    const body = await json(await handle(req("/api/items/ratelimited", { headers: cookieFor(voterToken) }), ["items", "ratelimited"]));
    expect(typeof body.left).toBe("number");
    expect(body.error).toBeNull();
  });
});
