import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db, schema } from "@bildkeller/db";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createItem, createTestUser, cookieFor, NOW } from "./helpers";
import { createSession } from "@/lib/auth";

type ReqInit = { method?: string; body?: BodyInit; headers?: Record<string, string> };
const req = (path: string, init?: ReqInit) => new NextRequest(`http://localhost:3000${path}`, init);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: Response) => (await res.json()) as Record<string, any>;
const call = (path: string, token?: string) =>
  handle(req(path, token ? { headers: cookieFor(token) } : undefined), path.replace("/api/", "").split("?")[0].split("/"));
const post = (path: string, form: Record<string, string>, token: string) =>
  handle(
    req(path, {
      method: "POST",
      body: new URLSearchParams({ ...form, _nonce: token.slice(0, 16) }),
      headers: { "content-type": "application/x-www-form-urlencoded", ...cookieFor(token) },
    }),
    path.replace("/api/", "").split("/"),
  );

let owner = { id: 0, name: "", token: "" };
let plain = { id: 0, token: "" }; // unverified: sees sfw + nsfp only
let sfwItem = 0, nsfwItem = 0, deletedItem = 0, otherItem = 0;
let nsfwComment = 0, sfwComment = 0, deletedComment = 0;
let colId = 0;

beforeAll(async () => {
  const o = await createTestUser("visowner", { verified: true });
  const p = await createTestUser("visplain");
  owner = { id: o.id, name: o.name, token: await createSession(o.id) };
  plain = { id: p.id, token: await createSession(p.id) };
  sfwItem = (await createItem(o.id)).id;
  nsfwItem = (await createItem(o.id, { flags: 2 })).id;
  deletedItem = (await createItem(o.id, { deleted: true })).id;
  otherItem = (await createItem(o.id)).id;
  const mk = async (itemId: number, extra: Partial<typeof schema.comments.$inferInsert> = {}) =>
    (await db.insert(schema.comments).values({ itemId, userId: o.id, content: "c", created: NOW(), ...extra }).returning())[0].id;
  sfwComment = await mk(sfwItem);
  nsfwComment = await mk(nsfwItem);
  deletedComment = await mk(sfwItem, { deleted: true });
  await db.insert(schema.commentEdits).values({ commentId: nsfwComment, content: "alt", edited: NOW() });
  await db.insert(schema.commentEdits).values({ commentId: deletedComment, content: "geheim", edited: NOW() });

  // public collection containing sfw, nsfw and deleted items
  const created = await json(await post("/api/collections/create", { name: "gemischt" }, owner.token));
  colId = Number(created.collectionId);
  for (const id of [sfwItem, nsfwItem, deletedItem]) await db.insert(schema.collectionItems).values({ collectionId: colId, itemId: id, added: NOW() });
});

describe("write endpoints validate their target", () => {
  it("cannot edit deleted comments and applies the comment limit to edits", async () => {
    expect((await json(await post("/api/comments/edit", { id: String(deletedComment), content: "new" }, owner.token))).error).toBe("not found");
    expect((await json(await post("/api/comments/edit", { id: String(sfwComment), content: "x".repeat(10001) }, owner.token))).error).toBe("invalid");
  });
  it("cannot vote on an item the user may not see, nor on a deleted one", async () => {
    expect((await json(await post("/api/items/vote", { id: String(nsfwItem), up: "1" }, plain.token))).error).toBe("not found");
    expect((await json(await post("/api/items/vote", { id: String(deletedItem), up: "1" }, plain.token))).error).toBe("not found");
    expect((await json(await post("/api/items/vote", { id: "999999", up: "1" }, plain.token))).error).toBe("not found");
  });

  it("cannot comment on deleted/invisible items or with a parent from another item", async () => {
    expect((await json(await post("/api/comments/post", { itemId: String(deletedItem), parent: "0", content: "x" }, plain.token))).error).toBe("not found");
    expect((await json(await post("/api/comments/post", { itemId: String(nsfwItem), parent: "0", content: "x" }, plain.token))).error).toBe("not found");
    expect((await json(await post("/api/comments/post", { itemId: String(otherItem), parent: String(sfwComment), content: "x" }, plain.token))).error).toBe("invalid");
    expect((await json(await post("/api/comments/post", { itemId: String(sfwItem), parent: "abc", content: "x" }, plain.token))).error).toBe("invalid");
  });

  it("caps content length", async () => {
    expect((await json(await post("/api/comments/post", { itemId: String(sfwItem), parent: "0", content: "x".repeat(10_001) }, plain.token))).error).toBe("invalid");
    expect((await json(await post("/api/tags/add", { itemId: String(sfwItem), tags: "y".repeat(65) }, plain.token))).error).toBe("invalid");
  });

  it("comment votes/favs require a visible comment", async () => {
    expect((await json(await post("/api/comments/vote", { id: String(nsfwComment), up: "1" }, plain.token))).error).toBe("not found");
    expect((await json(await post("/api/comments/fav", { id: String(nsfwComment) }, plain.token))).error).toBe("not found");
  });
});

describe("read endpoints do not leak hidden content", () => {
  it("filters hidden items from notifications, highlights and followed comments", async () => {
    await db.insert(schema.notifications).values([
      { userId: plain.id, type: "comment", refId: nsfwComment, created: NOW() },
      { userId: plain.id, type: "comment", refId: deletedComment, created: NOW() },
      { userId: plain.id, type: "comment", refId: sfwComment, created: NOW() },
    ]);
    const notes = await json(await call("/api/inbox/comments", plain.token));
    expect(notes.messages.map((n: { commentId: number }) => n.commentId)).toContain(sfwComment);
    expect(notes.messages.map((n: { commentId: number }) => n.commentId)).not.toContain(nsfwComment);
    expect(notes.messages.map((n: { commentId: number }) => n.commentId)).not.toContain(deletedComment);
    expect((await json(await call("/api/inbox/digests", plain.token))).digests.map((i: { id: number }) => i.id)).not.toContain(nsfwItem);
    await post("/api/profile/follow", { name: owner.name }, plain.token);
    const followed = await json(await call("/api/inbox/stalk", plain.token));
    expect(followed.messages.map((n: { id: number }) => n.id)).not.toContain(nsfwComment);
    expect(followed.messages.map((n: { id: number }) => n.id)).not.toContain(deletedComment);
  });

  it("public collections remain readable by guests and filter item ratings", async () => {
    const collection = await json(await call(`/api/collections/get?id=${colId}`));
    expect(collection.error).toBeNull();
    expect(collection.collections[0].items.map((i: { id: number }) => i.id)).toEqual([sfwItem]);
  });

  it("blocked tags are excluded from the account feed", async () => {
    await post("/api/tags/add", { itemId: String(sfwItem), tags: "visibility-block-tag" }, owner.token);
    await post("/api/profile/blockTag", { tag: "visibility-block-tag" }, plain.token);
    const feed = await json(await call(`/api/items/get?user=${owner.name}`, plain.token));
    expect(feed.items.map((i: { id: number }) => i.id)).not.toContain(sfwItem);
    await post("/api/profile/unblockTag", { tag: "visibility-block-tag" }, plain.token);
  });
  it("edit history needs a visible, non-deleted comment", async () => {
    expect((await json(await call(`/api/comments/getEditHistory?id=${nsfwComment}`))).error).toBe("not found");
    expect((await json(await call(`/api/comments/getEditHistory?id=${deletedComment}`, owner.token))).error).toBe("not found");
    expect((await json(await call(`/api/comments/getEditHistory?id=${sfwComment}`))).error).toBeNull();
  });

  it("guest profile shows only visible items in collections and comments", async () => {
    const body = await json(await call(`/api/profile/info?name=${owner.name}&flags=31`));
    const col = body.collections.find((c: { id: number }) => c.id === colId);
    expect(col).toBeDefined();
    expect(col.items.map((i: { id: number }) => i.id)).toEqual([sfwItem]);
    expect(col.itemCount).toBe(1);
    expect(body.comments.map((c: { id: number }) => c.id)).not.toContain(nsfwComment);
    expect(body.uploads.map((u: { id: number }) => u.id)).not.toContain(deletedItem);
  });

  it("profile.comments hides comments on deleted/invisible items", async () => {
    const body = await json(await call(`/api/profile/comments?name=${owner.name}&flags=31`));
    const ids = body.comments.map((c: { id: number }) => c.id);
    expect(ids).toContain(sfwComment);
    expect(ids).not.toContain(nsfwComment);
  });

  it("collectionfollowlist drops collections that turned private", async () => {
    await post("/api/collections/follow", { collectionId: String(colId) }, plain.token);
    expect((await json(await call("/api/user/collectionfollowlist", plain.token))).collections.some((c: { id: number }) => c.id === colId)).toBe(true);
    await post("/api/collections/edit", { collectionId: String(colId), isPublic: "0" }, owner.token);
    expect((await json(await call("/api/user/collectionfollowlist", plain.token))).collections.some((c: { id: number }) => c.id === colId)).toBe(false);
    await post("/api/collections/edit", { collectionId: String(colId), isPublic: "1" }, owner.token);
  });

  it("tags.top ignores tags that only exist on hidden items", async () => {
    await db.insert(schema.tags).values({ tag: "nurnsfwtag" }).onConflictDoNothing();
    const tag = (await db.select().from(schema.tags).where(eq(schema.tags.tag, "nurnsfwtag")))[0];
    await db.insert(schema.itemTags).values({ itemId: nsfwItem, tagId: tag.id, up: 5 });
    expect((await json(await call("/api/tags/top"))).tags).not.toContain("nurnsfwtag");
  });
});
