import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db, schema } from "@bildkeller/db";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createItem, createTestUser, cookieFor } from "./helpers";
import { createSession, hashPassword } from "@/lib/auth";
import * as siteConfig from "@/lib/config";

type ReqInit = { method?: string; body?: BodyInit; headers?: Record<string, string> };
const req = (path: string, init?: ReqInit) => new NextRequest(`http://localhost:3000${path}`, init);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: Response) => (await res.json()) as Record<string, any>;

let mod = { token: "", id: 0 };
let user = { token: "", id: 0, name: "" };
let itemId = 0;

const post = (path: string, form: Record<string, string>, token?: string) =>
  handle(
    req(path, {
      method: "POST",
      body: new URLSearchParams({ ...form, ...(token ? { _nonce: token.slice(0, 16) } : {}) }),
      headers: { "content-type": "application/x-www-form-urlencoded", ...(token ? cookieFor(token) : {}) },
    }),
    path.replace("/api/", "").split("/"),
  );
const get = (path: string, token?: string) =>
  handle(req(path, token ? { headers: cookieFor(token) } : undefined), path.replace("/api/", "").split("?")[0].split("/"));

beforeAll(async () => {
  const m = await createTestUser("modmod", { verified: true, mod: true, admin: true });
  const u = await createTestUser("modvictim", { verified: false });
  mod = { token: await createSession(m.id), id: m.id };
  user = { token: await createSession(u.id), id: u.id, name: u.name };
  itemId = (await createItem(u.id)).id;
});

describe("registration with invites", () => {
  it("open registration admits a regular account without an invite", async () => {
    const config = vi.spyOn(siteConfig, "config").mockResolvedValueOnce(false);
    try {
      const res = await post("/api/user/joinwithinvite", { name: "opennewbie", password: "passw0rd!" });
      expect((await json(res)).success).toBe(true);
      expect(res.headers.get("set-cookie")).toContain("me=");
      const [created] = await db.select().from(schema.users).where(eq(schema.users.name, "opennewbie"));
      expect(created.admin).toBe(false);
      expect(created.mod).toBe(false);
      expect(created.inviteId).toBeNull();
      expect(created.verified).toBe(false);
    } finally {
      config.mockRestore();
    }
  });

  it("requires an invite code", async () => {
    const res = await json(await post("/api/user/joinwithinvite", { name: "newbie1", password: "passw0rd!", email: "n@x.de" }));
    expect(res.error).toBe("invite required");
  });

  it("rejects unknown codes, accepts a valid one once and logs in", async () => {
    expect((await json(await post("/api/user/joinwithinvite", { name: "newbie2", password: "passw0rd!", invite: "nope" }))).error).toBe("invalid invite");

    const made = await json(await post("/api/user/invite", {}, mod.token));
    const code = made.code as string;
    expect(code).toHaveLength(16);

    const res = await post("/api/user/joinwithinvite", { name: "newbie3", password: "passw0rd!", invite: code });
    const body = await json(res);
    expect(body.error).toBeNull();
    expect(body.success).toBe(true);
    expect(res.headers.get("set-cookie")).toContain("me=");

    const again = await json(await post("/api/user/joinwithinvite", { name: "newbie4", password: "passw0rd!", invite: code }));
    expect(again.error).toBe("invalid invite");
    const dup = await json(await post("/api/user/joinwithinvite", { name: "NEWBIE3", password: "passw0rd!", invite: (await json(await post("/api/user/invite", {}, mod.token))).code }));
    expect(dup.error).toBe("name taken");
  });

  it("age declaration verifies the user", async () => {
    await post("/api/user/ageVerified", {}, user.token);
    const row = (await db.select().from(schema.users).where(eq(schema.users.id, user.id)))[0];
    expect(row.verified).toBe(true);
    await db.update(schema.users).set({ verified: false }).where(eq(schema.users.id, user.id));
  });
});

describe("moderation", () => {
  it("report is visible to mods only", async () => {
    const r = await json(await post("/api/contact/report", { itemId: String(itemId), reason: "spam", message: "m" }, user.token));
    expect(r.error).toBeNull();
    expect((await json(await get("/api/admin/reports", user.token))).error).toBe("forbidden");
    const list = await json(await get("/api/admin/reports", mod.token));
    expect(list.reports.some((x: { itemId: number }) => x.itemId === itemId)).toBe(true);
  });

  it("mod deletes an item: it disappears from the feed", async () => {
    await post("/api/items/delete", { id: String(itemId) }, mod.token);
    const feed = await json(await get("/api/items/get?flags=1&promoted=0", undefined));
    expect(feed.items.some((i: { id: number }) => i.id === itemId)).toBe(false);
  });

  it("ban blocks login and kills the session", async () => {
    await db.update(schema.users).set({ passwordHash: await hashPassword("passw0rd!") }).where(eq(schema.users.id, user.id));
    const ban = await json(await post("/api/admin/ban", { name: user.name, reason: "test", days: "7" }, mod.token));
    expect(ban.error).toBeNull();
    expect((await json(await get("/api/user/validate", user.token))).error).toBe("not logged in");
    expect((await json(await post("/api/user/login", { name: user.name, password: "passw0rd!" }))).error).toBe("banned");
    await post("/api/admin/unban", { name: user.name }, mod.token);
    expect((await json(await get("/api/user/validate", user.token))).name).toBe(user.name);
  });

  it("non-mods cannot ban", async () => {
    expect((await json(await post("/api/admin/ban", { name: "modmod", reason: "x" }, user.token))).error).toBe("forbidden");
  });
});

describe("account deletion (GDPR)", () => {
  it("request → pending → confirm soft-deletes and ends sessions", async () => {
    const u = await createTestUser("gdprguy");
    const token = await createSession(u.id);
    await post("/api/user/requestAccountDeletion", {}, token);
    expect((await json(await get("/api/user/deletionStatus", token))).pending).toBe(true);
    await post("/api/user/confirmAccountDeletion", {}, token);
    const row = (await db.select().from(schema.users).where(eq(schema.users.id, u.id)))[0];
    expect(row.deleted).toBe(true);
    expect((await json(await get("/api/user/validate", token))).error).toBe("not logged in");
  });

  it("cancel removes the pending request", async () => {
    const u = await createTestUser("gdprcancel");
    const token = await createSession(u.id);
    await post("/api/user/requestAccountDeletion", {}, token);
    await post("/api/user/cancelAccountDeletion", {}, token);
    expect((await json(await get("/api/user/deletionStatus", token))).pending).toBe(false);
  });

  it("dataExport returns the user's own data", async () => {
    const out = await json(await get("/api/user/dataExport", user.token));
    expect(out.data.user.name).toBe(user.name);
  });
});
