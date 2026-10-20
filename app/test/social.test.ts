import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createItem, createTestUser, cookieFor } from "./helpers";
import { createSession } from "@/lib/auth";
import { updateSettings } from "@/lib/settings";

type ReqInit = { method?: string; body?: BodyInit; headers?: Record<string, string> };
const req = (path: string, init?: ReqInit) => new NextRequest(`http://localhost:3000${path}`, init);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: Response) => (await res.json()) as Record<string, any>;

let a = { token: "", name: "", id: 0 };
let b = { token: "", name: "", id: 0 };
let itemId = 0;

const post = (path: string, form: Record<string, string>, token: string) =>
  handle(
    req(path, {
      method: "POST",
      body: new URLSearchParams({ ...form, _nonce: token.slice(0, 16) }),
      headers: { "content-type": "application/x-www-form-urlencoded", ...cookieFor(token) },
    }),
    path.replace("/api/", "").split("/"),
  );
const get = (path: string, token?: string) =>
  handle(req(path, token ? { headers: cookieFor(token) } : undefined), path.replace("/api/", "").split("?")[0].split("/"));

beforeAll(async () => {
  const ua = await createTestUser("socialalice", { verified: true });
  const ub = await createTestUser("socialbob", { verified: true });
  a = { token: await createSession(ua.id), name: ua.name, id: ua.id };
  b = { token: await createSession(ub.id), name: ub.name, id: ub.id };
  itemId = (await createItem(ub.id)).id;
});

const PROFILE_KEYS = [
  "background", "badges", "blocked", "collectedCount", "collections", "commentCount", "commentLikesCount",
  "comments", "comments_likes", "curatorCollections", "followCount", "following", "likesArePublic", "pr0mium",
  "pr0miumGift", "subscribed", "tagCount", "uploadCount", "uploads", "user",
];

describe("profile", () => {
  it("shares comment favorites only when their owner enables public visibility", async () => {
    const comment = await json(await post("/api/comments/post", { itemId: String(itemId), content: "public favorites test" }, b.token));
    await post("/api/comments/fav", { id: String(comment.commentId) }, a.token);
    expect((await json(await get(`/api/profile/commentlikes?name=${a.name}`, b.token))).error).toBe("forbidden");
    await updateSettings(a.id, { likesArePublic: "true" });
    const shared = await json(await get(`/api/profile/commentlikes?name=${a.name}`));
    expect(shared.comments.some((c: { id: number }) => c.id === comment.commentId)).toBe(true);
    await updateSettings(a.id, { likesArePublic: "false" });
    expect((await json(await get(`/api/profile/commentlikes?name=${a.name}`))).error).toBe("forbidden");
    await post("/api/comments/unfav", { id: String(comment.commentId) }, a.token);
  });
  it("profile.info has the observed keys and lists uploads", async () => {
    const body = await json(await get(`/api/profile/info?name=${b.name}&flags=31`, a.token));
    expect(body.error).toBeNull();
    for (const k of PROFILE_KEYS) expect(body).toHaveProperty(k);
    expect(body.user.name).toBe(b.name);
    expect(body.uploadCount).toBe(1);
    expect(body.uploads[0].id).toBe(itemId);
    expect(body.following).toBe(false);
  });

  it("follow shows up as following and notifies the followee", async () => {
    await post("/api/profile/follow", { name: b.name }, a.token);
    const info = await json(await get(`/api/profile/info?name=${b.name}&flags=31`, a.token));
    expect(info.following).toBe(true);
    expect(info.followCount).toBe(1);
    const sync = await json(await get("/api/user/sync?offset=0", b.token));
    expect(sync.inbox.follows).toBe(1);
    await post("/api/profile/unfollow", { name: b.name }, a.token);
    expect((await json(await get(`/api/profile/info?name=${b.name}&flags=31`, a.token))).following).toBe(false);
  });
});

describe("inbox", () => {
  it("message creates a conversation with unread count that clears on read", async () => {
    await post("/api/inbox/post", { to: a.name, comment: "hallo alice" }, b.token);
    const conv = await json(await get("/api/inbox/conversations", a.token));
    expect(conv.conversations).toHaveLength(1);
    expect(conv.conversations[0]).toMatchObject({ name: b.name, unreadCount: 1, lastMessagePreview: "hallo alice" });
    const msgs = await json(await get(`/api/inbox/messages?with=${b.name}`, a.token));
    expect(msgs.messages).toHaveLength(1);
    expect(msgs.messages[0]).toMatchObject({ message: "hallo alice", sent: 0 });
    const after = await json(await get("/api/inbox/conversations", a.token));
    expect(after.conversations[0].unreadCount).toBe(0);
  });

  it("a blocked sender cannot message", async () => {
    await post("/api/profile/block", { name: b.name }, a.token);
    const res = await json(await post("/api/inbox/post", { to: a.name, comment: "noch eine" }, b.token));
    expect(res.error).toBe("blocked");
    await post("/api/profile/unblock", { name: b.name }, a.token);
  });
});

describe("collections", () => {
  it("auto-upvotes new favorites once and exposes the membership state", async () => {
    const target = await createItem(b.id);
    const first = await json(await get("/api/collections/get", a.token));
    const favorite = first.collections.find((c: { isDefault: number }) => c.isDefault === 1);
    await updateSettings(a.id, { favUpvote: "true" });
    for (let i = 0; i < 2; i++) await post("/api/collections/add", { collectionId: String(favorite.id), itemId: String(target.id) }, a.token);
    const info = await json(await get(`/api/items/info?itemId=${target.id}`, a.token));
    expect(info.collectionIds).toContain(favorite.id);
    expect(info.vote).toBe(true);
    const feed = await json(await get(`/api/items/get?id=${target.id}&user=${b.name}`, a.token));
    expect(feed.items.find((i: { id: number }) => i.id === target.id).up).toBe(1);
    await post("/api/collections/remove", { collectionId: String(favorite.id), itemId: String(target.id) }, a.token);
    expect((await json(await get(`/api/items/info?itemId=${target.id}`, a.token))).collectionIds).not.toContain(favorite.id);
    await updateSettings(a.id, { favUpvote: "false" });
  });
  it("default Favoriten exists; create, add item, follow", async () => {
    const first = await json(await get("/api/collections/get", a.token));
    expect(first.collections.some((c: { isDefault: number }) => c.isDefault === 1)).toBe(true);

    const created = await json(await post("/api/collections/create", { name: "Meine Katzen" }, b.token));
    const cid = Number(created.collectionId);
    expect(cid).toBeGreaterThan(0);
    await post("/api/collections/add", { collectionId: String(cid), itemId: String(itemId) }, b.token);
    const mine = await json(await get("/api/collections/get", b.token));
    const col = mine.collections.find((c: { id: number }) => c.id === cid);
    expect(col.itemCount).toBe(1);
    expect(col.items[0].id).toBe(itemId);

    await post("/api/collections/follow", { collectionId: String(cid) }, a.token);
    const followed = await json(await get("/api/user/collectionfollowlist", a.token));
    expect(followed.collections.some((c: { id: number }) => c.id === cid)).toBe(true);
  });

  it("only the owner may edit or delete", async () => {
    const created = await json(await post("/api/collections/create", { name: "fremd" }, b.token));
    const res = await json(await post("/api/collections/delete", { collectionId: String(created.collectionId) }, a.token));
    expect(res.error).toBe("forbidden");
  });
});

describe("blocks", () => {
  it("blocked users' comments are flagged in items.info", async () => {
    await post("/api/comments/post", { itemId: String(itemId), parent: "0", content: "von bob" }, b.token);
    await post("/api/profile/block", { name: b.name }, a.token);
    const info = await json(await get(`/api/items/info?itemId=${itemId}`, a.token));
    expect(info.comments.every((c: { blocked: boolean }) => c.blocked)).toBe(true);
    const list = await json(await get("/api/user/blocklist", a.token));
    expect(list.blocked.map((u: { name: string }) => u.name)).toContain(b.name);
  });
});
