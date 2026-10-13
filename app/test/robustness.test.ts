import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createItem, createTestUser, cookieFor } from "./helpers";
import { createSession } from "@/lib/auth";

type ReqInit = { method?: string; body?: BodyInit; headers?: Record<string, string> };
const req = (path: string, init?: ReqInit) => new NextRequest(`http://localhost:3000${path}`, init);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: Response) => (await res.json()) as Record<string, any>;
const call = (path: string, init?: ReqInit) => handle(req(path, init), path.replace("/api/", "").split("?")[0].split("/"));

let token = "";
let itemId = 0;
beforeAll(async () => {
  const u = await createTestUser("robust", { verified: true });
  token = await createSession(u.id);
  itemId = (await createItem(u.id)).id;
});

const post = (path: string, form: Record<string, string>) =>
  call(path, {
    method: "POST",
    body: new URLSearchParams({ ...form, _nonce: token.slice(0, 16) }),
    headers: { "content-type": "application/x-www-form-urlencoded", ...cookieFor(token) },
  });

describe("no internal details leak, no 500s on hostile input", () => {
  it.each([
    ["sync offset 1e30", "/api/user/sync?offset=1e30"],
    ["sync offset Infinity", "/api/user/sync?offset=Infinity"],
    ["sync limit 1.5", "/api/user/sync?offset=0&limit=1.5"],
    ["items older huge", "/api/items/get?flags=1&older=99999999999999999999"],
    ["profile.comments before huge", "/api/profile/comments?name=robust&before=1e40"],
  ])("%s", async (_n, url) => {
    const body = await json(await call(url, { headers: cookieFor(token) }));
    expect(JSON.stringify(body)).not.toMatch(/Failed query|params:|select |insert /i);
  });

  it("comments.post with a non-numeric parent is rejected generically", async () => {
    const body = await json(await post("/api/comments/post", { itemId: String(itemId), parent: "abc", content: "x" }));
    expect(body.error).toBeTruthy();
    expect(body.error).not.toMatch(/Failed query|params:/);
  });

  it("a me-cookie that decodes to JSON null is just a guest", async () => {
    const body = await json(await call("/api/user/validate", { headers: { cookie: `me=${Buffer.from("null").toString("base64url")}` } }));
    expect(body.error).toBe("not logged in");
  });

  it("a JSON null body does not crash the dispatcher", async () => {
    const res = await call("/api/user/logout", { method: "POST", body: "null", headers: { "content-type": "application/json" } });
    expect(res.status).toBe(200);
  });
});
