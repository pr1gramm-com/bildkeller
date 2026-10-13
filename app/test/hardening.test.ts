import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { db, schema } from "@bildkeller/db";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createItem, createTestUser, cookieFor, NOW } from "./helpers";
import { createSession, hashPassword } from "@/lib/auth";

type ReqInit = { method?: string; body?: BodyInit; headers?: Record<string, string> };
const req = (path: string, init?: ReqInit) => new NextRequest(`http://localhost:3000${path}`, init);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: Response) => (await res.json()) as Record<string, any>;
const names = (p: string) => p.replace("/api/", "").split("?")[0].split("/");
const call = (p: string, token?: string, headers: Record<string, string> = {}) =>
  handle(req(p, { headers: { ...(token ? cookieFor(token) : {}), ...headers } }), names(p));
const post = (p: string, form: Record<string, string>, token?: string, headers: Record<string, string> = {}) =>
  handle(
    req(p, {
      method: "POST",
      body: new URLSearchParams({ ...form, ...(token ? { _nonce: token.slice(0, 16) } : {}) }),
      headers: { "content-type": "application/x-www-form-urlencoded", ...(token ? cookieFor(token) : {}), ...headers },
    }),
    names(p),
  );

let u = { id: 0, token: "", name: "" };
beforeAll(async () => {
  const x = await createTestUser("hardener", { verified: true });
  u = { id: x.id, token: await createSession(x.id), name: x.name };
});

describe("vote counters stay consistent under concurrency", () => {
  it("parallel identical item votes leave counter == vote rows", async () => {
    const item = await createItem(u.id);
    await Promise.all(Array.from({ length: 12 }, () => post("/api/items/vote", { id: String(item.id), up: "1" }, u.token)));
    const row = (await db.select().from(schema.items).where(eq(schema.items.id, item.id)))[0];
    const rows = await db.select().from(schema.votes).where(and(eq(schema.votes.itemId, item.id), eq(schema.votes.up, true)));
    expect(row.up).toBe(rows.length);
    expect(row.down).toBe(0);
  });

  it("parallel tag votes keep tag counters equal to vote rows", async () => {
    const item = await createItem(u.id);
    await post("/api/tags/add", { itemId: String(item.id), tags: "race" }, u.token);
    const voters = await Promise.all(Array.from({ length: 6 }, async (_, i) => createSession((await createTestUser(`racer${Date.now()}${i}`, { verified: true })).id)));
    await Promise.all(voters.flatMap((t) => [1, 2, 3].map(() => post("/api/tags/vote", { itemId: String(item.id), tag: "race", up: "1" }, t))));
    const tag = (await db.select().from(schema.tags).where(eq(schema.tags.tag, "race")))[0];
    const it = (await db.select().from(schema.itemTags).where(and(eq(schema.itemTags.itemId, item.id), eq(schema.itemTags.tagId, tag.id))))[0];
    const votes = await db.select().from(schema.itemTagVotes).where(and(eq(schema.itemTagVotes.itemId, item.id), eq(schema.itemTagVotes.tagId, tag.id), eq(schema.itemTagVotes.up, true)));
    expect(it.up).toBe(votes.length);
  });
});

describe("/top pagination", () => {
  it("walks every promoted item exactly once even when promotion order != id order", async () => {
    const owner = await createTestUser(`pager${Date.now()}`, { verified: true });
    const ts = NOW();
    const ids: number[] = [];
    for (const offset of [5, 1, 4, 2, 3]) ids.push((await createItem(owner.id, { promoted: ts - offset })).id);
    const seen: number[] = [];
    let older = 0;
    for (let page = 0; page < 10; page++) {
      const r = await json(await call(`/api/items/get?flags=1&promoted=1&user=${owner.name}&limit=2${older ? `&older=${older}` : ""}`));
      const items = r.items as Array<{ id: number }>;
      seen.push(...items.map((i) => i.id));
      if (r.atEnd) break;
      older = items[items.length - 1].id;
    }
    expect(seen.sort((a, b) => a - b)).toEqual([...ids].sort((a, b) => a - b));
  });
});

describe("rate limiting and credentials", () => {
  it("login attempts are throttled per IP", async () => {
    const h = { "x-forwarded-for": "203.0.113.7" };
    let last = "";
    for (let i = 0; i < 25; i++) last = (await json(await post("/api/user/login", { name: "nobody", password: "wrong-password" }, undefined, h))).error;
    expect(last).toBe("rate limited");
  });

  it("comment spam is throttled per user", async () => {
    const item = await createItem(u.id);
    let last = "";
    for (let i = 0; i < 40; i++) last = (await json(await post("/api/comments/post", { itemId: String(item.id), parent: "0", content: `c${i}` }, u.token))).error;
    expect(last).toBe("rate limited");
  });

  it("hashPassword is async and verifiable", async () => {
    const h = await hashPassword("einlangespasswort");
    expect(h.startsWith("$argon2")).toBe(true);
  });
});

describe("sessions", () => {
  it("expire after a year", async () => {
    const old = await createTestUser("oldsession");
    const t = await createSession(old.id);
    await db.update(schema.sessions).set({ created: NOW() - 366 * 86400 }).where(eq(schema.sessions.token, t));
    expect((await json(await call("/api/user/validate", t))).error).toBe("not logged in");
  });

  it("changing the password revokes the other sessions", async () => {
    const x = await createTestUser("pwchanger");
    await db.update(schema.users).set({ passwordHash: await hashPassword("old-password-1") }).where(eq(schema.users.id, x.id));
    const a = await createSession(x.id);
    const b = await createSession(x.id);
    expect((await json(await post("/api/user/changepassword", { old: "old-password-1", new: "new-password-2" }, a))).error).toBeNull();
    expect((await json(await call("/api/user/validate", a))).name).toBe(x.name);
    expect((await json(await call("/api/user/validate", b))).error).toBe("not logged in");
  });
});

describe("registration races", () => {
  it("one invite code admits exactly one of several parallel registrations", async () => {
    const admin = await createTestUser("inviter", { verified: true, admin: true });
    const t = await createSession(admin.id);
    const code = (await json(await post("/api/user/invite", {}, t))).code as string;
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        post("/api/user/joinwithinvite", { name: `racer-${Date.now()}-${i}`, password: "password-123", invite: code }, undefined, { "x-forwarded-for": `198.51.100.${i + 1}` }).then(json),
      ),
    );
    expect(results.filter((r) => r.success === true)).toHaveLength(1);
  });
});

describe("moderation removes media", () => {
  it("deleting an item deletes its files", async () => {
    const root = path.resolve(process.env.MEDIA_DIR ?? "./data/media");
    await mkdir(path.join(root, "del"), { recursive: true });
    await writeFile(path.join(root, "del", "x.png"), "a");
    await writeFile(path.join(root, "del", "x.t.jpg"), "b");
    const item = await createItem(u.id, { image: "del/x.png", thumb: "del/x.t.jpg" });
    await post("/api/items/delete", { id: String(item.id) }, u.token);
    expect(existsSync(path.join(root, "del", "x.png"))).toBe(false);
    expect(existsSync(path.join(root, "del", "x.t.jpg"))).toBe(false);
  });
});

describe("inbox.conversations", () => {
  it("a spammer cannot push other conversations out of the list", async () => {
    const victim = await createTestUser("spamvictim", { verified: true });
    const vt = await createSession(victim.id);
    const friend = await createTestUser("spamfriend", { verified: true });
    const spammer = await createTestUser("spammer", { verified: true });
    await db.insert(schema.messages).values({ fromId: friend.id, toId: victim.id, content: "hi", created: NOW() - 10_000 });
    await db.insert(schema.messages).values(Array.from({ length: 1100 }, (_, i) => ({ fromId: spammer.id, toId: victim.id, content: `s${i}`, created: NOW() - 5000 + i })));
    const body = await json(await call("/api/inbox/conversations", vt));
    const list = body.conversations as Array<{ name: string; unreadCount: number }>;
    expect(list.map((c) => c.name)).toEqual([spammer.name, friend.name]); // by recency
    expect(list[0].unreadCount).toBe(1100);
  });
});

describe("input validation", () => {
  it("source must be an http(s) URL", async () => {
    const t = await createSession((await createTestUser("srcposter", { verified: true })).id);
    await db.insert(schema.uploads).values({ key: "srckey", userId: (await db.select().from(schema.sessions).where(eq(schema.sessions.token, t)))[0].userId, image: "a.png", thumb: "a.t.jpg", width: 1, height: 1, originalWidth: 1, originalHeight: 1, dhash: "srchash", created: NOW() });
    expect((await json(await post("/api/items/post", { key: "srckey", sfwstatus: "sfw", tags: "x", source: "javascript:alert(1)" }, t))).error).toBe("invalid");
  });

  it("ban duration must be a positive integer", async () => {
    const mod = await createTestUser("banmod", { verified: true, mod: true });
    const t = await createSession(mod.id);
    const target = await createTestUser("bantarget");
    expect((await json(await post("/api/admin/ban", { name: target.name, reason: "x", days: "abc" }, t))).error).toBe("invalid");
    expect((await json(await post("/api/admin/ban", { name: target.name, reason: "x", days: "-3" }, t))).error).toBe("invalid");
  });
});

void sql;
