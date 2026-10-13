import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { db, schema } from "@bildkeller/db";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createItem, createTestUser, cookieFor, NOW } from "./helpers";
import { createSession } from "@/lib/auth";
import { logEvent } from "@/lib/sync";

type ReqInit = { method?: string; body?: BodyInit; headers?: Record<string, string> };
const req = (path: string, init?: ReqInit) => new NextRequest(`http://localhost:3000${path}`, init);
const json = async (res: Response) => (await res.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let token = "";
let userId = 0;
let otherId = 0;

const sync = (offset: number) =>
  handle(req(`/api/user/sync?offset=${offset}&chunked=true&limit=100000`, { headers: cookieFor(token) }), ["user", "sync"]);
const decode = (log: string) => JSON.parse(Buffer.from(log, "base64").toString("utf8")) as unknown[];

beforeAll(async () => {
  const u = await createTestUser("syncer", { verified: true });
  const o = await createTestUser("syncother", { verified: true });
  userId = u.id;
  otherId = o.id;
  token = await createSession(u.id);

  // Inbox-Bestand: 1 mention, 2 comment, 1 follow (alle ungelesen), 1 ungelesene Nachricht
  const base = { userId, created: NOW() };
  await db.insert(schema.notifications).values([
    { ...base, type: "mention", refId: 1 },
    { ...base, type: "comment", refId: 2 },
    { ...base, type: "comment", refId: 3 },
    { ...base, type: "follow", refId: 4 },
  ]);
  await db.insert(schema.messages).values({ fromId: otherId, toId: userId, content: "hi", created: NOW() });

  // Benis: Item mit up=5/down=1 (x2) + Kommentar up=3/down=0
  const item = await createItem(userId, { up: 5, down: 1 });
  await db.insert(schema.comments).values({ itemId: item.id, userId, content: "c", created: NOW(), up: 3 });
});

describe("user.sync", () => {
  it("rejects guests", async () => {
    const body = await json(await handle(req("/api/user/sync"), ["user", "sync"]));
    expect(body.error).toBe("not logged in");
  });

  it("returns the observed shape", async () => {
    const body = await json(await sync(0));
    expect(Object.keys(body).sort()).toEqual(
      ["inbox", "log", "logLength", "hasMore", "nextOffset", "score", "settings", "ts", "cache", "rt", "qc", "error"].sort(),
    );
    expect(body.settings.layoutMode).toBe("modern");
  });

  it("delivers logged events after the offset and advances nextOffset", async () => {
    for (let i = 0; i < 3; i++) await logEvent(userId, "vote", { i });
    const first = await json(await sync(0));
    expect(decode(first.log)).toHaveLength(3);
    expect(first.hasMore).toBe(false);
    const again = await json(await sync(first.nextOffset));
    expect(decode(again.log)).toHaveLength(0);
    expect(again.nextOffset).toBe(first.nextOffset);
  });

  it("an absurdly large offset yields an empty log and the real log end", async () => {
    const real = await json(await sync(0));
    const body = await json(await sync(9_999_999_999));
    expect(body.error).toBeNull();
    expect(decode(body.log)).toHaveLength(0);
    expect(body.nextOffset).toBe(real.nextOffset);
  });

  it("counts unread inbox items and computes benis", async () => {
    const body = await json(await sync(0));
    expect(body.inbox).toMatchObject({ mentions: 1, comments: 2, follows: 1, messages: 1, digests: 0 });
    expect(body.score).toBe(2 * (5 - 1) + 3);
  });

  it("user.sitesettings persists a changed setting", async () => {
    await handle(
      req("/api/user/sitesettings", {
        method: "POST",
        body: new URLSearchParams({ themeId: "2", _nonce: token.slice(0, 16) }),
        headers: { "content-type": "application/x-www-form-urlencoded", ...cookieFor(token) },
      }),
      ["user", "sitesettings"],
    );
    const body = await json(await sync(0));
    expect(body.settings.themeId).toBe(2);
  });
});
