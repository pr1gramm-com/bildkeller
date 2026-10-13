import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db, schema } from "@bildkeller/db";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createItem, createTestUser, cookieFor } from "./helpers";
import { createSession } from "@/lib/auth";

type ReqInit = { method?: string; body?: BodyInit; headers?: Record<string, string> };
const req = (path: string, init?: ReqInit) => new NextRequest(`http://localhost:3000${path}`, init);
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

let aliceToken = "";
let bobToken = "";
let aliceId = 0;
let bobId = 0;
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
  const alice = await createTestUser("cmtalice", { verified: true });
  const bob = await createTestUser("cmtbob", { verified: true });
  aliceId = alice.id;
  bobId = bob.id;
  aliceToken = await createSession(alice.id);
  bobToken = await createSession(bob.id);
  itemId = (await createItem(alice.id)).id;
});

describe("comments", () => {
  let rootId = 0;

  it("post creates a comment and mention notifies the mentioned user", async () => {
    const body = await json(
      await post("/api/comments/post", { itemId: String(itemId), parent: "0", content: "hi @cmtbob" }, aliceToken),
    );
    expect(body.error).toBeNull();
    rootId = Number(body.commentId);
    expect(rootId).toBeGreaterThan(0);
    const notes = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, bobId));
    expect(notes.filter((n) => n.type === "mention" && n.refId === rootId)).toHaveLength(1);
  });

  it("reply notifies the parent author (type comment), not oneself", async () => {
    await post("/api/comments/post", { itemId: String(itemId), parent: String(rootId), content: "antwort" }, bobToken);
    const forAlice = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, aliceId));
    expect(forAlice.some((n) => n.type === "comment")).toBe(true);
    await post("/api/comments/post", { itemId: String(itemId), parent: String(rootId), content: "selbst" }, aliceToken);
    const again = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, aliceId));
    expect(again.filter((n) => n.type === "comment")).toHaveLength(1);
  });

  it("edit twice keeps both previous versions in the history", async () => {
    await post("/api/comments/edit", { id: String(rootId), content: "v2" }, aliceToken);
    await post("/api/comments/edit", { id: String(rootId), content: "v3" }, aliceToken);
    const hist = await json(
      await handle(req(`/api/comments/getEditHistory?id=${rootId}`, { headers: cookieFor(aliceToken) }), [
        "comments",
        "getEditHistory",
      ]),
    );
    expect((hist.history as unknown[]).length).toBe(2);
    const row = (await db.select().from(schema.comments).where(eq(schema.comments.id, rootId)))[0];
    expect(row.content).toBe("v3");
    expect(row.editCount).toBe(2);
    expect(row.editedAt).not.toBeNull();
  });

  it("only the author can edit", async () => {
    const body = await json(await post("/api/comments/edit", { id: String(rootId), content: "hack" }, bobToken));
    expect(body.error).toBe("forbidden");
  });

  it("fav / unfav toggles the favorite row", async () => {
    await post("/api/comments/fav", { id: String(rootId) }, bobToken);
    expect(await db.select().from(schema.commentFavorites).where(eq(schema.commentFavorites.commentId, rootId))).toHaveLength(1);
    await post("/api/comments/unfav", { id: String(rootId) }, bobToken);
    expect(await db.select().from(schema.commentFavorites).where(eq(schema.commentFavorites.commentId, rootId))).toHaveLength(0);
  });

  it("rejects empty content", async () => {
    const body = await json(await post("/api/comments/post", { itemId: String(itemId), parent: "0", content: "  " }, aliceToken));
    expect(body.error).toBe("invalid");
  });
});
