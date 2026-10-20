import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";
import { createSession } from "@/lib/auth";
import { createTestUser, cookieFor } from "./helpers";
import { savedSearches, savedSearchHref } from "@/lib/saved-searches";
import { updateSettings } from "@/lib/settings";

let token = "";
let other = "";
beforeAll(async () => {
  token = await createSession((await createTestUser("saved-search-owner")).id);
  other = await createSession((await createTestUser("saved-search-other")).id);
});

async function request(action: string, session: string, form?: Record<string, string>, nonce = true) {
  return (await handle(new NextRequest(`http://localhost/api/bookmarks/${action}`, {
    method: form ? "POST" : "GET",
    headers: session ? cookieFor(session) : {},
    body: form ? new URLSearchParams({ ...form, ...(nonce ? { _nonce: session.slice(0, 16) } : {}) }) : undefined,
  }), ["bookmarks", action])).json();
}

describe("saved feed bookmarks", () => {
  it("serializes concurrent saves, deletes and unrelated settings changes", async () => {
    const owner = await createTestUser("concurrent-search-owner");
    const session = await createSession(owner.id);
    const searches = Array.from({ length: 8 }, (_, i) => ({ name: `Search ${i}`, tags: `tag${i}`, feed: "new" }));
    await Promise.all(searches.map((s) => request("saveSearch", session, s)));
    expect((await request("get", session)).searches).toHaveLength(8);
    await Promise.all([
      request("deleteSearch", session, searches[0]),
      request("saveSearch", session, { name: "extra", tags: "extra", feed: "top" }),
      updateSettings(owner.id, { themeId: "3" }),
    ]);
    const result = (await request("get", session)).searches;
    expect(result).toHaveLength(8);
    expect(result.some((s: { tags: string }) => s.tags === "tag0")).toBe(false);
    expect(result.some((s: { tags: string }) => s.tags === "extra")).toBe(true);
  });
  const search = { name: "Original Content", tags: "! 'original content' | oc", feed: "top" };

  it("persists per account, updates an existing query, and deletes", async () => {
    expect((await request("saveSearch", token, search)).error).toBeNull();
    expect((await request("get", token)).searches).toEqual([search]);
    expect((await request("get", other)).searches).toEqual([]);
    await request("saveSearch", token, { ...search, name: "OC" });
    expect((await request("get", token)).searches).toEqual([{ ...search, name: "OC" }]);
    await request("deleteSearch", token, search);
    expect((await request("get", token)).searches).toEqual([]);
  });

  it("rejects unauthenticated writes, missing CSRF nonce, and invalid feeds", async () => {
    expect((await request("saveSearch", "", search)).error).toBeTruthy();
    expect((await request("saveSearch", token, search, false)).error).toBeTruthy();
    expect((await request("deleteSearch", token, search, false)).error).toBeTruthy();
    expect((await request("saveSearch", token, { ...search, feed: "javascript:alert(1)" })).error).toBe("invalid");
    expect((await request("saveSearch", token, { ...search, tags: "" })).error).toBe("invalid");
  });

  it("handles malformed settings and encodes the query as a single route segment", () => {
    expect(savedSearches("null")).toEqual([]);
    expect(savedSearches("invalid")).toEqual([]);
    expect(savedSearches('[{"name":"x","tags":"x","feed":"https://example.com"}]')).toEqual([]);
    expect(savedSearchHref({ name: "test", tags: "foo/bar?#", feed: "new" })).toBe("/new/foo%2Fbar%3F%23");
    expect(savedSearchHref({ name: "year", tags: "2026", feed: "new" })).toBe("/new/'2026'");
  });
});
