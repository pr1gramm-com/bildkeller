import { describe, expect, it } from "vitest";
import { feedPath, feedRoute, itemHref, itemIdFromPath, searchHref } from "@/lib/feed-route";

describe("reference feed URLs", () => {
  it("distinguishes numeric searches from item IDs and handles malformed encodings", () => {
    expect(feedPath(searchHref("new", "2026"))?.tags).toBe("'2026'");
    expect(itemIdFromPath(searchHref("new", "2026"))).toBeNull();
    expect(feedPath("/new/%ZZ")).toBeNull();
  });
  it("retains feed and multiword search across opening and reloading", () => {
    const route = feedRoute("top", ["! 'original content' | oc", "123"]);
    expect(route).toEqual({ base: "/top/!%20'original%20content'%20%7C%20oc", tags: "! 'original content' | oc", startAt: 123 });
    expect(itemIdFromPath(itemHref(route!.base, 456))).toBe(456);
  });
  it("supports plain feeds and existing item links", () => {
    expect(feedRoute("new")).toEqual({ base: "/new", tags: "", startAt: undefined });
    expect(feedRoute("junk", ["42"])?.startAt).toBe(42);
    expect(itemIdFromPath("/item/42")).toBe(42);
    expect(itemIdFromPath("/user/42")).toBeNull();
    expect(itemHref("/stalk", 42)).toBe("/item/42");
  });
  it("rejects malformed route shapes and unsafe IDs", () => {
    expect(feedRoute("top", ["tag", "other"])).toBeNull();
    expect(feedRoute("top", ["0"])).toBeNull();
    expect(feedRoute("top", ["9007199254740992"])).toBeNull();
    expect(feedRoute("top", ["a", "b", "1"])).toBeNull();
  });
});
