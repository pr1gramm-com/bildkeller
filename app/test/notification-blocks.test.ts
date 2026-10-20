import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { db, schema } from "@bildkeller/db";
import { and, eq } from "drizzle-orm";
import { createSession } from "@/lib/auth";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createItem, createTestUser, cookieFor } from "./helpers";

let token = "", actorToken = "", owner = 0, actor = 0, item = 0;
const ownerName = "notification-block-owner";
beforeAll(async () => {
  owner = (await createTestUser(ownerName)).id; token = await createSession(owner);
  actor = (await createTestUser("notification-block-actor")).id; actorToken = await createSession(actor);
  item = (await createItem(owner)).id;
});
async function get(path: string) {
  return (await handle(new NextRequest(`http://localhost/api/${path}`, { headers: cookieFor(token) }), path.split("?")[0].split("/"))).json();
}
async function post(path: string, form: Record<string, string>, session = actorToken) {
  return (await handle(new NextRequest(`http://localhost/api/${path}`, { method: "POST", body: new URLSearchParams({ ...form, _nonce: session.slice(0, 16) }), headers: { ...cookieFor(session), "content-type": "application/x-www-form-urlencoded" } }), path.split("/"))).json();
}
const block = () => db.insert(schema.blocks).values({ userId: owner, blockedUserId: actor }).onConflictDoNothing();
const unblock = () => db.delete(schema.blocks).where(and(eq(schema.blocks.userId, owner), eq(schema.blocks.blockedUserId, actor)));

describe("notification blocking", () => {
  it("does not create mentions, replies or follow alerts from blocked accounts", async () => {
    await block();
    expect((await post("comments/post", { itemId: String(item), content: `blocked @${ownerName}` })).error).toBeNull();
    await post("profile/follow", { name: ownerName });
    const notes = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, owner));
    expect(notes).toEqual([]);
  });
  it("hides existing alerts and unread counts immediately after blocking", async () => {
    await unblock();
    await post("profile/unfollow", { name: ownerName });
    await post("profile/follow", { name: ownerName });
    await post("comments/post", { itemId: String(item), content: "visible comment before blocking" });
    await post("inbox/post", { to: ownerName, comment: "message before blocking" });
    const before = await get("user/sync");
    expect(before.inbox.comments).toBe(1); expect(before.inbox.follows).toBe(1); expect(before.inbox.messages).toBe(1);
    await block();
    const after = await get("user/sync");
    expect(after.inbox.comments).toBe(0); expect(after.inbox.follows).toBe(0); expect(after.inbox.notifications).toBe(0); expect(after.inbox.messages).toBe(0);
    expect((await get("inbox/all")).messages).toEqual([]);
    expect((await get("inbox/conversations")).conversations[0].unreadCount).toBe(0);
  });
  it("restores existing unread alerts after unblocking", async () => {
    await unblock();
    expect((await get("user/sync")).inbox.notifications).toBe(2);
    expect((await get("inbox/all")).messages).toHaveLength(2);
    expect((await get("user/sync")).inbox.notifications).toBe(0);
  });
});
