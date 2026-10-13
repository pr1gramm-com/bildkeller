import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { db, schema } from "@bildkeller/db";
import { handle, register } from "@/lib/api/router";
import { fail, ok } from "@/lib/api/envelope";
import { assertNonce, createSession, encodeMeCookie, hashPassword } from "@/lib/auth";
import "@/lib/api/register-all";

let token = "";
const PASSWORD = "correct horse";

type ReqInit = { method?: string; body?: BodyInit; headers?: Record<string, string> };

function req(path: string, init?: ReqInit) {
  return new NextRequest(`http://localhost:3000${path}`, init);
}

async function json(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

beforeAll(async () => {
  register("test.nonce", async (ctx) => {
    if (!ctx.user) return fail("not logged in");
    assertNonce(ctx, ctx.user);
    return ok({});
  });
  const now = Math.floor(Date.now() / 1000);
  const [user] = await db
    .insert(schema.users)
    .values({ name: "alice", passwordHash: await hashPassword(PASSWORD), created: now })
    .returning();
  token = await createSession(user.id);
});

describe("auth", () => {
  it("user.login sets me-cookie with token and name", async () => {
    const res = await handle(
      req("/api/user/login", {
        method: "POST",
        body: new URLSearchParams({ name: "alice", password: PASSWORD }),
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
      ["user", "login"],
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);

    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("me=");
    const raw = cookie.split(";")[0].split("me=")[1];
    const map = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Record<string, string>;
    expect(map.id).toHaveLength(32);
    expect(map.n).toBe("alice");
  });

  it("user.login rejects wrong password", async () => {
    const res = await handle(
      req("/api/user/login", {
        method: "POST",
        body: new URLSearchParams({ name: "alice", password: "nope" }),
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
      ["user", "login"],
    );
    const body = await json(res);
    expect(body.success).toBeUndefined();
    expect(body.error).toBe("invalid credentials");
  });

  it("user.validate resolves the session from the me-cookie", async () => {
    const me = encodeMeCookie({ id: token });
    const res = await handle(req("/api/user/validate", { headers: { cookie: `me=${me}` } }), [
      "user",
      "validate",
    ]);
    const body = await json(res);
    expect(body.name).toBe("alice");
    expect(body.mark).toBe(2);
  });

  it("POST without _nonce fails with csrf", async () => {
    const me = encodeMeCookie({ id: token });
    const res = await handle(
      req("/api/test/nonce", {
        method: "POST",
        body: new URLSearchParams({}),
        headers: { "content-type": "application/x-www-form-urlencoded", cookie: `me=${me}` },
      }),
      ["test", "nonce"],
    );
    expect((await json(res)).error).toBe("csrf");
  });

  it("POST with correct _nonce (token prefix) passes", async () => {
    const me = encodeMeCookie({ id: token });
    const res = await handle(
      req("/api/test/nonce", {
        method: "POST",
        body: new URLSearchParams({ _nonce: token.slice(0, 16) }),
        headers: { "content-type": "application/x-www-form-urlencoded", cookie: `me=${me}` },
      }),
      ["test", "nonce"],
    );
    const body = await json(res);
    expect(body.error).toBeNull();
  });

  it("user.logout invalidates the session", async () => {
    const me = encodeMeCookie({ id: token });
    await handle(
      req("/api/user/logout", {
        method: "POST",
        body: new URLSearchParams({ _nonce: token.slice(0, 16) }),
        headers: { "content-type": "application/x-www-form-urlencoded", cookie: `me=${me}` },
      }),
      ["user", "logout"],
    );
    const res = await handle(req("/api/user/validate", { headers: { cookie: `me=${me}` } }), [
      "user",
      "validate",
    ]);
    const body = await json(res);
    expect(body.error).toBe("not logged in");
  });
});
